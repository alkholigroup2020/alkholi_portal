const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const jwt = require('jsonwebtoken')
const { createAuth } = require('../../server/login/services/auth')
const { createSessions } = require('../../server/login/services/session')
const { AuthError } = require('../../server/login/services/errors')
const createRouter = require('../../server/login/router/createRouter')

const key = 'test-only-key-never-used-by-the-application'
const user = {
  cn: "O'Neil",
  mail: 'test@example.invalid',
  sAMAccountName: 'Test',
  dn: 'CN=Test',
}
const moreInfo = { employee_code: '12345', Manager_Code: '67890' }

async function fixture(t) {
  const sessions = createSessions(key)
  const registered = new Set()
  const calls = { ad: [], credentials: [], revoked: [], saved: [] }
  const repository = {
    getMoreInfo: async () => moreInfo,
    getManagerInfo: async () => ({ Email: 'manager@example.invalid' }),
    saveLogin: async (data) => {
      calls.saved.push(data)
      registered.add(data.token)
    },
    getCredentials: async (employee) => {
      calls.credentials.push(employee)
      return { groupID: 'encrypted', mailAddress: user.mail }
    },
    isRegistered: async (identity) => registered.has(identity.token),
    revokeToken: async (token) => {
      calls.revoked.push(token)
      registered.delete(token)
    },
  }
  const auth = createAuth({
    sessions,
    repository,
    adAuth: async (...args) => {
      calls.ad.push(args)
      if (args[1] === 'wrong') throw new AuthError('wrongPassword')
      return user
    },
    cipher: {
      encrypt: (value) => `encrypted:${value}`,
      decrypt: () => 'unchanged password',
    },
  })
  const app = express()
  app.use('/login-api', createRouter(auth))
  app.get('/protected', auth.authorize, (req, res) =>
    res.json({ employeeCode: req.auth.employeeCode })
  )
  const server = await new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server))
  })
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections()
        server.close(resolve)
      })
  )
  async function request(path, body, token) {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}${path}`,
      {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }
    )
    const text = await response.text()
    return {
      status: response.status,
      body: text ? JSON.parse(text) : undefined,
    }
  }
  async function login(domain = 'alkholi') {
    return request('/login-api/login', {
      userAccount: ' TEST ',
      password: ' Keep Case ',
      domain,
      dc_ip: 'untrusted.example',
    })
  }
  return { calls, repository, sessions, registered, request, login }
}

test('login supports four domains, keeps password intact, and issues unique bounded identity tokens', async (t) => {
  const f = await fixture(t)
  const tokens = new Set()
  for (const domain of ['Alkholi', 'Buildingtek', 'Upmoc', 'Amos-sa']) {
    const response = await f.login(domain)
    assert.equal(response.status, 200)
    assert.deepEqual(
      Object.keys(response.body).sort(),
      [
        'domain',
        'managerInfo',
        'moreInfo',
        'token',
        'user',
        'userAccount',
      ].sort()
    )
    const identity = f.sessions.verify(response.body.token)
    assert.equal(identity.employeeCode, moreInfo.employee_code)
    assert.equal(identity.domain, domain.toLowerCase())
    assert.equal(identity.userAccount, 'test')
    assert.ok(response.body.token.length <= 300)
    assert.equal(jwt.decode(response.body.token).exp, undefined)
    tokens.add(response.body.token)
    assert.deepEqual(f.calls.ad.at(-1), [
      'test',
      ' Keep Case ',
      domain.toLowerCase(),
    ])
    assert.equal(
      f.calls.saved.at(-1).encryptedPassword,
      'encrypted: Keep Case '
    )
    assert.equal(
      (await f.request('/protected', undefined, response.body.token)).status,
      200
    )
  }
  assert.equal(tokens.size, 4)
})

test('invalid login values are rejected before LDAP and unknown errors are sanitized', async (t) => {
  const f = await fixture(t)
  for (const body of [
    null,
    {},
    { userAccount: 'test', password: '', domain: 'alkholi' },
    { userAccount: {}, password: 'test', domain: 'alkholi' },
    { userAccount: 'test', password: 'test', domain: '__proto__' },
  ]) {
    assert.equal((await f.request('/login-api/login', body)).status, 400)
  }
  assert.equal(f.calls.ad.length, 0)
  assert.deepEqual(
    await f.request('/login-api/login', {
      userAccount: 'test',
      password: 'wrong',
      domain: 'alkholi',
    }),
    { status: 401, body: { message: 'wrongPassword' } }
  )
  for (const code of ['hrDataMissing', 'hrTitleMissing', 'hrManagerMessing']) {
    f.repository.getMoreInfo = async () => {
      throw new AuthError(code, 404)
    }
    assert.deepEqual(await f.login(), { status: 404, body: { message: code } })
  }
  f.repository.getMoreInfo = async () => {
    throw new Error('secret SQL connection details')
  }
  assert.deepEqual(await f.login(), {
    status: 503,
    body: { message: 'serviceUnavailable' },
  })
})

test('session checks reject missing, legacy, malformed, expired, tampered and wrong-algorithm tokens', async (t) => {
  const f = await fixture(t)
  const good = (await f.login()).body.token
  const claims = jwt.decode(good)
  const tokens = [
    undefined,
    'bad',
    'x'.repeat(301),
    jwt.sign({ userID: 'test' }, key),
    jwt.sign({ ...claims, v: 0 }, key),
    jwt.sign({ ...claims, e: '' }, key),
    jwt.sign({ ...claims, exp: 1 }, key),
    jwt.sign(claims, 'wrong-key'),
    jwt.sign(claims, key, { algorithm: 'HS384' }),
    `${good.split('.')[0]}.${good.split('.')[1]}.bad`,
  ]
  for (const token of tokens) {
    if (token) f.registered.add(token)
    assert.equal((await f.request('/protected', undefined, token)).status, 401)
  }
  const unregistered = f.sessions.issue({
    employeeCode: '56789',
    userAccount: 'another',
    domain: 'alkholi',
  })
  assert.equal(
    (await f.request('/protected', undefined, unregistered)).status,
    401
  )
  f.repository.isRegistered = async () => {
    throw new Error('SQL unavailable')
  }
  assert.equal((await f.request('/protected', undefined, good)).status, 503)
})

test('reauthentication ignores spoofed body identity and requires registered bearer identity', async (t) => {
  const f = await fixture(t)
  const token = (await f.login()).body.token
  const spoofed = {
    mail: 'victim@example.invalid',
    userAccount: 'victim',
    domainName: 'upmoc',
    dc_ip: 'bad',
  }
  assert.equal(
    (await f.request('/login-api/reauthenticate', spoofed)).status,
    401
  )
  assert.equal(f.calls.credentials.length, 0)
  const response = await f.request('/login-api/reauthenticate', spoofed, token)
  assert.equal(response.status, 200)
  assert.deepEqual(f.calls.credentials, ['12345'])
  assert.deepEqual(f.calls.ad.at(-1), ['test', 'unchanged password', 'alkholi'])
  assert.equal(response.body.employeeCode, '12345')
  f.repository.getCredentials = async () => ({
    groupID: 'encrypted',
    mailAddress: 'different@example.invalid',
  })
  assert.equal(
    (await f.request('/login-api/reauthenticate', {}, token)).status,
    401
  )
})

test('logout revokes only its bearer, can repeat, and denies subsequent protected requests', async (t) => {
  const f = await fixture(t)
  const own = (await f.login()).body.token
  const other = (await f.login()).body.token
  assert.equal(
    (await f.request('/login-api/logoff', { token: other })).status,
    401
  )
  assert.equal(f.registered.has(other), true)
  assert.equal(
    (await f.request('/login-api/logoff', { token: other }, own)).status,
    200
  )
  assert.deepEqual(f.calls.revoked, [own])
  assert.equal((await f.request('/protected', undefined, own)).status, 401)
  assert.equal((await f.request('/protected', undefined, other)).status, 200)
  assert.equal((await f.request('/login-api/logoff', {}, own)).status, 200)
  f.repository.revokeToken = async () => {
    throw new Error('database credentials')
  }
  assert.deepEqual(await f.request('/login-api/logoff', {}, other), {
    status: 503,
    body: { message: 'serviceUnavailable' },
  })
})

test('tokens fitting normal schema bounds succeed; oversized claims fail before persistence', () => {
  const sessions = createSessions(key)
  const token = sessions.issue({
    employeeCode: '1'.repeat(20),
    userAccount: 'a'.repeat(20),
    domain: 'buildingtek',
  })
  assert.ok(token.length <= 300)
  assert.throws(
    () =>
      sessions.issue({
        employeeCode: '123',
        userAccount: 'a'.repeat(256),
        domain: 'alkholi',
      }),
    /accountDataInvalid/
  )
})
