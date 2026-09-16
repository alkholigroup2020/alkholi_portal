const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const {
  createAdAuth,
  escapeFilter,
} = require('../../server/login/utils/createAdAuth')

function fixture(mode = 'success') {
  let destroyed = 0
  const calls = { binds: [], searches: [], options: [] }
  const client = new EventEmitter()
  client.destroy = () => {
    destroyed++
  }
  client.bind = (dn, password, callback) => {
    calls.binds.push({ dn, password })
    if (mode === 'timeout') return
    setImmediate(() => {
      if (mode === 'client-error')
        return client.emit('error', new Error('private network detail'))
      callback(
        (mode === 'admin-error' && dn === 'service') ||
          (mode === 'password-error' && dn !== 'service')
          ? new Error('bind error')
          : null
      )
    })
  }
  client.search = (base, options, callback) => {
    if (mode === 'search-throw') throw new Error('socket closed')
    calls.searches.push({ base, options })
    const response = new EventEmitter()
    callback(
      mode === 'search-error' ? new Error('search failed') : null,
      response
    )
    if (mode === 'search-error') return
    setImmediate(() => {
      if (mode === 'response-error')
        return response.emit('error', new Error('search failed'))
      if (mode !== 'missing-user')
        response.emit('searchEntry', {
          object: {
            dn: 'CN=Test',
            mail: 'test@example.invalid',
            sAMAccountName: 'test',
          },
        })
      response.emit('end', { status: mode === 'bad-status' ? 1 : 0 })
    })
  }
  const ldap = {
    createClient: (options) => {
      calls.options.push(options)
      return client
    },
  }
  return {
    authenticate: createAdAuth({
      ldap,
      adminDN: 'service',
      adminPassword: 'test-only',
      timeoutMs: mode === 'timeout' ? 15 : 2000,
    }),
    calls,
    destroyed: () => destroyed,
  }
}

test('LDAP filter metacharacters are escaped, controller is server-owned, and password is unchanged', async () => {
  assert.equal(escapeFilter('a*()\\\0'), 'a\\2a\\28\\29\\5c\\00')
  const f = fixture()
  await f.authenticate(
    'a*)(x=*)',
    ' Keep Case ',
    'buildingtek',
    'untrusted-host'
  )
  assert.deepEqual(f.calls.options[0].url, ['ldaps://10.11.10.11:636'])
  assert.equal(
    f.calls.searches[0].options.filter,
    '(sAMAccountName=a\\2a\\29\\28x=\\2a\\29)'
  )
  assert.equal(f.calls.binds[1].password, ' Keep Case ')
  assert.equal(f.destroyed(), 1)
})

for (const [mode, error] of [
  ['admin-error', 'adConnectionError'],
  ['client-error', 'adConnectionError'],
  ['timeout', 'adConnectionError'],
  ['search-throw', 'adConnectionError'],
  ['search-error', 'authFailed'],
  ['response-error', 'authFailed'],
  ['bad-status', 'authFailed'],
  ['missing-user', 'wrongUser'],
  ['password-error', 'wrongPassword'],
]) {
  test(`LDAP ${mode} rejects safely and closes the connection`, async () => {
    const f = fixture(mode)
    await assert.rejects(f.authenticate('test', 'password', 'alkholi'), {
      message: error,
    })
    assert.equal(f.destroyed(), 1)
  })
}

test('empty password and unsupported domains never open an LDAP connection', async () => {
  const f = fixture()
  await assert.rejects(f.authenticate('test', '', 'alkholi'))
  await assert.rejects(f.authenticate('test', 'password', '__proto__'))
  assert.equal(f.calls.options.length, 0)
})
