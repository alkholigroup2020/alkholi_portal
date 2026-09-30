const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const express = require('express')
const babel = require('@babel/core')
const createApi = require('../../server/administration/createApi')
const {
  MUTATION_ROUTES,
} = require('../../server/administration/router/memberships')
const {
  createMemberships,
  validateEmployeeCode,
  MEMBERSHIPS,
  HR_EMPLOYEE_QUERY,
  HR_TITLE_QUERY,
  PORTAL_PICTURE_QUERY,
} = require('../../server/administration/services/memberships')
const {
  createDtrSetup,
} = require('../../server/administration/services/dtrSetup')
const {
  createRoleChecks,
  requireRole,
  ROLE_QUERIES,
} = require('../../server/shared/roles')
const { createAuth } = require('../../server/login/services/auth')
const { createSessions } = require('../../server/login/services/session')

const root = path.resolve(__dirname, '../..')
const ADMIN = 'ADM001'
const USER = 'USR001'
const TARGET = '00123'

const MODULE_TABLES = {
  portal: 'admin_members',
  'business-cards': 'business_card_admins',
  coc: 'coc_admins',
  elevators: 'elevators_users',
  'hr-surveys': 'hr_surveys_users',
  dtr: 'dtr_users',
}

const ROLE_TABLES = {
  portalAdmin: 'admin_members',
  businessCardsAdmin: 'business_card_admins',
  cocAdmin: 'coc_admins',
  elevatorsUser: 'elevators_users',
  hrSurveysUser: 'hr_surveys_users',
  dtrUser: 'dtr_users',
}

function memberRow(employeeID, extra = {}) {
  return {
    _id: employeeID.length,
    employeeID,
    fullName: `Name ${employeeID}`,
    title: 'Engineer',
    mailAddress: `${employeeID.toLowerCase()}@example.invalid`,
    profilePicPath: 'profile.png',
    hrPicture: false,
    portalPicture: true,
    branch: 'private branch',
    ...extra,
  }
}

// Mocked mssql: records every statement, its typed inputs, and the pool config.
function databaseFixture() {
  const portalConfig = { name: 'portal' }
  const hrConfig = { name: 'hr' }
  const calls = []
  const pools = []
  const state = {
    failAt: null,
    tables: Object.fromEntries(
      Object.values(MODULE_TABLES).map((table) => [table, []])
    ),
    hrEmployees: {
      [TARGET]: {
        employee_code: TARGET,
        branch_code: 'BR1',
        employee_name_eng: 'Target Employee',
        Email: 'target@example.invalid',
        position: '0042',
        employee_picture: 'hr-target.jpg',
        salary: 'private',
      },
    },
    titles: {
      'BR1:42': {
        system_desp_a: 'مهندس',
        system_desp_e: 'Engineer',
        private: 'x',
      },
    },
    portalPictures: {},
    addResultOverride: null,
    deleteRemaining: null,
    extraRecordset: false,
  }
  state.tables.admin_members.push(memberRow(ADMIN))

  const statementOwners = new Map()
  for (const [moduleName, entry] of MEMBERSHIPS) {
    for (const kind of ['exists', 'list', 'add', 'remove'])
      statementOwners.set(entry[kind], {
        kind,
        table: MODULE_TABLES[moduleName],
      })
  }
  for (const [role, statement] of ROLE_QUERIES)
    statementOwners.set(statement, { kind: 'role', table: ROLE_TABLES[role] })

  class ConnectionPool {
    constructor(config) {
      this.config = config
      this.closed = false
      pools.push(this)
    }

    async connect() {
      if (state.failAt === 'connect') throw new Error('private connection')
    }

    async close() {
      this.closed = true
      if (state.failAt === 'close') throw new Error('private cleanup')
    }

    request() {
      const pool = this
      const inputs = {}
      return {
        input(name, type, value) {
          inputs[name] = { type, value }
          return this
        },
        // eslint-disable-next-line require-await
        async query(statement) {
          const owner = statementOwners.get(statement)
          calls.push({ statement, inputs, config: pool.config.name, owner })
          if (
            state.failAt === 'query' ||
            (owner && state.failAt === owner.kind) ||
            state.failAt === statement
          )
            throw new Error('private SQL detail: dbo.secret_table')
          const value = (name) => inputs[name] && inputs[name].value
          if (statement === HR_EMPLOYEE_QUERY) {
            const row = state.hrEmployees[value('employeeCode')]
            return { recordset: row ? [row] : [] }
          }
          if (statement === HR_TITLE_QUERY) {
            const row = state.titles[`${value('branch')}:${value('position')}`]
            return { recordset: row ? [row] : [] }
          }
          if (statement === PORTAL_PICTURE_QUERY) {
            const found = state.portalPictures[value('employeeCode')]
            return {
              recordset:
                found === undefined ? [] : [{ portalProfilePicPath: found }],
            }
          }
          if (!owner) return { recordset: [{ legacy: true }] }
          const rows = state.tables[owner.table]
          const id = value('employeeCode') || value('employeeID')
          const count = rows.filter((row) => row.employeeID === id).length
          if (owner.kind === 'role')
            return { recordset: [{ hasRole: count > 0 }] }
          if (owner.kind === 'exists')
            return { recordset: [{ memberExists: count > 0 }] }
          if (owner.kind === 'list') return { recordset: rows }
          if (owner.kind === 'add') {
            if (state.addResultOverride) {
              if (state.addResultOverride instanceof Error)
                throw state.addResultOverride
              return state.addResultOverride
            }
            if (!count)
              rows.push({
                _id: rows.length + 100,
                employeeID: id,
                fullName: value('fullName'),
                title: value('title'),
                mailAddress: value('mailAddress'),
                profilePicPath: value('profilePicPath'),
                branch: value('branch'),
                hrPicture: value('hrPicture'),
                portalPicture: value('portalPicture'),
              })
            const result = [{ memberExists: count > 0 }]
            return {
              recordset: state.extraRecordset ? [{ procedure: 1 }] : result,
              recordsets: state.extraRecordset
                ? [[{ procedure: 1 }], result]
                : [result],
            }
          }
          if (owner.kind === 'remove') {
            const remaining =
              state.deleteRemaining === null ? 0 : state.deleteRemaining
            if (count && remaining === 0)
              state.tables[owner.table] = rows.filter(
                (row) => row.employeeID !== id
              )
            const result = [
              { memberCount: count, remainingCount: count ? remaining : 0 },
            ]
            return { recordset: result, recordsets: [result] }
          }
          throw new Error('unexpected statement')
        },
      }
    }
  }

  const sql = {
    ConnectionPool,
    VarChar: (length) => ({ name: 'varchar', length }),
    NVarChar: (length) => ({ name: 'nvarchar', length }),
    Bit: { name: 'bit' },
    Int: { name: 'int' },
  }
  return {
    calls,
    pools,
    state,
    sql,
    portalConfig,
    hrConfig,
    memberships: createMemberships({ sql, portalConfig, hrConfig }),
    roles: createRoleChecks({ sql, portalConfig }),
  }
}

test('the six resource names map to fixed statements for their existing tables', async () => {
  assert.deepEqual([...MEMBERSHIPS.keys()], Object.keys(MODULE_TABLES))
  const f = databaseFixture()
  for (const [moduleName, table] of Object.entries(MODULE_TABLES)) {
    const entry = MEMBERSHIPS.get(moduleName)
    assert.ok(Object.isFrozen(entry))
    for (const kind of ['exists', 'list', 'add', 'remove']) {
      assert.match(entry[kind], new RegExp(`FROM dbo\\.${table}\\b`))
      assert.doesNotMatch(entry[kind], /SELECT \*/)
    }
    assert.match(
      entry.add,
      new RegExp(`EXEC dbo\\.${table}_addData @employeeID`)
    )
    assert.match(
      entry.remove,
      new RegExp(`EXEC dbo\\.${table}_deleteMember @memberID = @employeeID`)
    )
    for (const statement of [entry.add, entry.remove]) {
      assert.match(statement, /BEGIN TRANSACTION/)
      assert.match(statement, /WITH \(UPDLOCK, HOLDLOCK\)/)
      assert.match(statement, /ROLLBACK TRANSACTION/)
    }

    f.state.tables[table] = [memberRow('M1'), memberRow('M2')]
    const rows = await f.memberships.listMembers(moduleName)
    assert.deepEqual(
      rows.map((row) => Object.keys(row).sort()),
      Array(2).fill(
        [
          '_id',
          'employeeID',
          'fullName',
          'hrPicture',
          'mailAddress',
          'portalPicture',
          'profilePicPath',
          'title',
        ].sort()
      )
    )
    const call = f.calls.at(-1)
    assert.equal(call.statement, entry.list)
    assert.equal(call.config, 'portal')
    assert.deepEqual(call.inputs, {})
  }
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('unrecognized and prototype-like resource names are rejected before SQL', async () => {
  const f = databaseFixture()
  for (const name of [
    'Portal',
    'portal ',
    'admin_members',
    'dbo.admin_members',
    '__proto__',
    'constructor',
    'toString',
    'hasOwnProperty',
    'valueOf',
    '',
    undefined,
    null,
    ['portal'],
    { toString: () => 'portal' },
  ]) {
    await assert.rejects(f.memberships.listMembers(name), {
      message: 'invalidModule',
      statusCode: 400,
    })
    await assert.rejects(f.memberships.addMember(name, TARGET), {
      message: 'invalidModule',
    })
    await assert.rejects(f.memberships.deleteMember(name, TARGET), {
      message: 'invalidModule',
    })
  }
  assert.equal(f.pools.length, 0)
  assert.equal(f.calls.length, 0)
})

test('target employee codes are validated separately from caller identity', () => {
  for (const code of ['00123', 'X12345', 'Ab_-09', '1'.repeat(20)])
    assert.equal(validateEmployeeCode(code), code)
  for (const code of [
    "1' OR '1'='1",
    '1;DROP TABLE x',
    ' 00123',
    '00123 ',
    '1'.repeat(21),
    '',
    '١٢٣',
    'a/b',
    123,
    null,
    undefined,
    ['00123'],
    { code: '00123' },
  ]) {
    assert.throws(() => validateEmployeeCode(code), {
      message: 'invalidEmployeeCode',
      statusCode: 400,
    })
  }
})

test('adding a member binds observed SQL types and preserves the response shape', async () => {
  const f = databaseFixture()
  const result = await f.memberships.addMember('coc', TARGET)
  assert.deepEqual(result, {
    memberInfo: {
      employee_code: TARGET,
      branch_code: 'BR1',
      employee_name_eng: 'Target Employee',
      Email: 'target@example.invalid',
      position: '0042',
    },
    titleInfo: { system_desp_a: 'مهندس', system_desp_e: 'Engineer' },
    memberPicturePath: 'hr-target.jpg',
    hrPicture: true,
    portalPicture: false,
  })

  const byStatement = (statement) =>
    f.calls.find((call) => call.statement === statement)
  const entry = MEMBERSHIPS.get('coc')
  assert.deepEqual(byStatement(entry.exists).inputs, {
    employeeCode: { type: { name: 'varchar', length: 20 }, value: TARGET },
  })
  assert.equal(byStatement(HR_EMPLOYEE_QUERY).config, 'hr')
  assert.deepEqual(byStatement(HR_EMPLOYEE_QUERY).inputs, {
    employeeCode: { type: { name: 'varchar', length: 15 }, value: TARGET },
  })
  // Existing numeric position comparison is preserved: '0042' -> '42'.
  assert.deepEqual(byStatement(HR_TITLE_QUERY).inputs, {
    position: { type: { name: 'varchar', length: 15 }, value: '42' },
    branch: { type: { name: 'varchar', length: 10 }, value: 'BR1' },
  })
  assert.equal(byStatement(PORTAL_PICTURE_QUERY).config, 'portal')
  const add = byStatement(entry.add)
  assert.equal(add.config, 'portal')
  assert.deepEqual(add.inputs, {
    employeeID: { type: { name: 'varchar', length: 20 }, value: TARGET },
    fullName: {
      type: { name: 'varchar', length: 50 },
      value: 'Target Employee',
    },
    title: { type: { name: 'varchar', length: 150 }, value: 'Engineer' },
    profilePicPath: {
      type: { name: 'nvarchar', length: 300 },
      value: 'hr-target.jpg',
    },
    mailAddress: {
      type: { name: 'varchar', length: 50 },
      value: 'target@example.invalid',
    },
    branch: { type: { name: 'varchar', length: 50 }, value: 'BR1' },
    hrPicture: { type: { name: 'bit' }, value: true },
    portalPicture: { type: { name: 'bit' }, value: false },
  })
  for (const call of f.calls)
    assert.doesNotMatch(call.statement, /00123|Target/)
  assert.equal(f.state.tables.coc_admins.length, 1)
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('member pictures use portal, HR, then default fallbacks', async () => {
  const f = databaseFixture()
  f.state.portalPictures[TARGET] = 'portal-photo.png'
  let info = await f.memberships.getEmployeeInfo(TARGET)
  assert.deepEqual(
    [info.memberPicturePath, info.hrPicture, info.portalPicture],
    ['portal-photo.png', false, true]
  )
  f.state.portalPictures[TARGET] = null
  info = await f.memberships.getEmployeeInfo(TARGET)
  assert.deepEqual(
    [info.memberPicturePath, info.hrPicture, info.portalPicture],
    ['hr-target.jpg', true, false]
  )
  for (const picture of ['', null]) {
    f.state.hrEmployees[TARGET].employee_picture = picture
    info = await f.memberships.getEmployeeInfo(TARGET)
    assert.deepEqual(
      [info.memberPicturePath, info.hrPicture, info.portalPicture],
      ['profile.png', false, true]
    )
  }
  assert.equal(
    f.calls.some((call) => /addData|deleteMember/.test(call.statement)),
    false,
    'employee lookup must not mutate memberships'
  )
})

test('duplicates, missing HR data, oversized data and races are controlled', async () => {
  const f = databaseFixture()
  // Existing member: reported before any HR lookup (existing precedence).
  f.state.tables.dtr_users.push(memberRow(TARGET))
  await assert.rejects(f.memberships.addMember('dtr', TARGET), {
    message: 'memberExist',
    statusCode: 409,
  })
  assert.equal(
    f.calls.some((call) => call.statement === HR_EMPLOYEE_QUERY),
    false
  )

  for (const [mutate, message, statusCode] of [
    [(s) => delete s.hrEmployees[TARGET], 'employeeInfoMessing', 404],
    [(s) => (s.titles = {}), 'employeeInfoMessing', 404],
    [
      (s) => (s.hrEmployees[TARGET].position = 'abc'),
      'employeeInfoMessing',
      404,
    ],
    [(s) => (s.hrEmployees[TARGET].Email = null), 'employeeInfoMessing', 404],
    [
      (s) => (s.hrEmployees[TARGET].employee_name_eng = ' '),
      'employeeInfoMessing',
      404,
    ],
    [
      (s) => (s.hrEmployees[TARGET].employee_name_eng = 'N'.repeat(51)),
      'employeeInfoInvalid',
      422,
    ],
    [
      (s) => (s.hrEmployees[TARGET].Email = `${'e'.repeat(45)}@x.invalid`),
      'employeeInfoInvalid',
      422,
    ],
    [
      (s) => (s.titles['BR1:42'].system_desp_e = 'T'.repeat(151)),
      'employeeInfoInvalid',
      422,
    ],
  ]) {
    const g = databaseFixture()
    mutate(g.state)
    await assert.rejects(g.memberships.addMember('portal', TARGET), {
      message,
      statusCode,
    })
    assert.equal(
      g.calls.some((call) => call.statement === MEMBERSHIPS.get('portal').add),
      false,
      `${message} must stop before the insert`
    )
    assert.ok(g.pools.every((pool) => pool.closed))
  }

  // HR keys are varchar(15): a longer code is not truncated into a lookup.
  const long = databaseFixture()
  await assert.rejects(long.memberships.addMember('portal', 'A'.repeat(16)), {
    message: 'employeeInfoMessing',
  })
  assert.equal(
    long.calls.some((call) => call.statement === HR_EMPLOYEE_QUERY),
    false
  )

  // A concurrent insert between the pre-check and the locked insert.
  const race = databaseFixture()
  race.state.addResultOverride = {
    recordset: [{ memberExists: true }],
    recordsets: [[{ memberExists: true }]],
  }
  await assert.rejects(race.memberships.addMember('elevators', TARGET), {
    message: 'memberExist',
    statusCode: 409,
  })
  const key = databaseFixture()
  key.state.addResultOverride = Object.assign(new Error('dup'), {
    number: 2627,
  })
  await assert.rejects(key.memberships.addMember('hr-surveys', TARGET), {
    message: 'memberExist',
  })
  // Procedure result sets do not confuse the final status row.
  const extra = databaseFixture()
  extra.state.extraRecordset = true
  await extra.memberships.addMember('business-cards', TARGET)
  assert.equal(extra.state.tables.business_card_admins.length, 1)
})

test('deleting members reports missing rows and never claims unverified removal', async () => {
  const f = databaseFixture()
  f.state.tables.hr_surveys_users.push(memberRow(TARGET))
  assert.deepEqual(await f.memberships.deleteMember('hr-surveys', TARGET), {
    message: 'successfullyDeleted',
  })
  const call = f.calls.at(-1)
  assert.equal(call.statement, MEMBERSHIPS.get('hr-surveys').remove)
  assert.deepEqual(call.inputs, {
    employeeID: { type: { name: 'varchar', length: 20 }, value: TARGET },
  })
  assert.equal(f.state.tables.hr_surveys_users.length, 0)
  await assert.rejects(f.memberships.deleteMember('hr-surveys', TARGET), {
    message: 'notFound',
    statusCode: 404,
  })
  f.state.tables.coc_admins.push(memberRow(TARGET))
  f.state.deleteRemaining = 1
  await assert.rejects(f.memberships.deleteMember('coc', TARGET), {
    message: 'serviceUnavailable',
    statusCode: 503,
  })
  f.state.failAt = 'remove'
  await assert.rejects(f.memberships.deleteMember('coc', TARGET), {
    message: /private SQL detail/,
  })
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('role checks use each module table only and are evaluated per request', async () => {
  const f = databaseFixture()
  for (const [role, table] of Object.entries(ROLE_TABLES)) {
    assert.match(ROLE_QUERIES.get(role), new RegExp(`FROM dbo\\.${table} `))
    assert.equal(await f.roles.hasRole(role, ADMIN), table === 'admin_members')
    assert.deepEqual(f.calls.at(-1).inputs, {
      employeeCode: { type: { name: 'varchar', length: 20 }, value: ADMIN },
    })
  }
  f.state.tables.dtr_users.push(memberRow(USR_DTR()))
  assert.equal(await f.roles.hasRole('dtrUser', USR_DTR()), true)
  assert.equal(await f.roles.hasRole('portalAdmin', USR_DTR()), false)
  f.state.tables.admin_members = []
  assert.equal(await f.roles.hasRole('portalAdmin', ADMIN), false)
  await assert.rejects(f.roles.hasRole('__proto__', ADMIN), /Unknown role/)
  assert.throws(() => requireRole(f.roles, 'constructor'), /Unknown role/)
  assert.equal(await f.roles.hasRole('portalAdmin', 'A'.repeat(21)), false)
  f.state.failAt = 'role'
  await assert.rejects(f.roles.hasRole('portalAdmin', ADMIN))
  assert.ok(f.pools.every((pool) => pool.closed))
})

function USR_DTR() {
  return 'DTR001'
}

async function httpFixture(t) {
  const f = databaseFixture()
  const sessions = createSessions('administration-tests-only-key')
  const tokens = {
    admin: sessions.issue({
      employeeCode: ADMIN,
      userAccount: 'admin',
      domain: 'alkholi',
    }),
    user: sessions.issue({
      employeeCode: USER,
      userAccount: 'user',
      domain: 'alkholi',
    }),
  }
  const revoked = new Set()
  const auth = createAuth({
    sessions,
    repository: {
      isRegistered: async (identity) => !revoked.has(identity.token),
    },
    adAuth: async () => {},
    cipher: {},
  })
  const app = express()
  app.use(
    '/administration-api',
    createApi({
      authorize: auth.authorize,
      requirePortalAdmin: requireRole(f.roles, 'portalAdmin'),
      memberships: f.memberships,
      dtrSetup: createDtrSetup({
        sql: f.sql,
        portalConfig: f.portalConfig,
        hrConfig: f.hrConfig,
        getEmployeeInfo: f.memberships.getEmployeeInfo,
      }),
    })
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
  const base = `http://127.0.0.1:${server.address().port}/administration-api`
  async function request(suffix, { as = 'admin', method, body, headers } = {}) {
    const allHeaders = { ...(headers || {}) }
    if (as) allHeaders.Authorization = `Bearer ${tokens[as] || as}`
    if (body !== undefined) allHeaders['Content-Type'] = 'application/json'
    const response = await fetch(base + suffix, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: allHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    return {
      status: response.status,
      body: text ? JSON.parse(text) : null,
      cacheControl: response.headers.get('cache-control'),
    }
  }
  async function raw(suffix, body) {
    const response = await fetch(base + suffix, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.admin}`,
        'Content-Type': 'application/json',
      },
      body,
    })
    return { status: response.status, body: await response.json() }
  }
  return {
    ...f,
    request,
    raw,
    tokens,
    revoke: (token) => revoked.add(token),
  }
}

function allProtectedRequests() {
  const requests = Object.keys(MODULE_TABLES).map((name) => [
    `/members/${name}`,
    {},
  ])
  for (const [, addPath, deletePath] of MUTATION_ROUTES) {
    requests.push([addPath, { body: { code: TARGET } }])
    requests.push([deletePath, { body: { code: TARGET } }])
  }
  requests.push(['/get-employee-info', { body: { code: TARGET } }])
  return requests
}

test('portal administrators can list every resource and add/remove memberships', async (t) => {
  const f = await httpFixture(t)
  for (const [moduleName, table] of Object.entries(MODULE_TABLES)) {
    const listed = await f.request(`/members/${moduleName}`)
    assert.equal(listed.status, 200)
    assert.equal(listed.cacheControl, 'no-store')
    assert.deepEqual(
      listed.body.map((row) => row.employeeID),
      f.state.tables[table].map((row) => row.employeeID)
    )
    assert.ok(listed.body.every((row) => !('branch' in row)))
  }
  for (const [moduleName, addPath, deletePath] of MUTATION_ROUTES) {
    const table = MODULE_TABLES[moduleName]
    const before = f.state.tables[table].length
    const added = await f.request(addPath, { body: { code: TARGET } })
    assert.equal(added.status, 200, addPath)
    assert.equal(added.body.memberInfo.employee_code, TARGET)
    assert.equal(f.state.tables[table].length, before + 1)
    assert.deepEqual(await f.request(addPath, { body: { code: TARGET } }), {
      status: 409,
      body: { message: 'memberExist' },
      cacheControl: null,
    })
    const listed = await f.request(`/members/${moduleName}`)
    assert.ok(listed.body.some((row) => row.employeeID === TARGET))
    assert.deepEqual(
      (await f.request(deletePath, { body: { code: TARGET } })).body,
      { message: 'successfullyDeleted' }
    )
    assert.equal(f.state.tables[table].length, before)
    assert.deepEqual(await f.request(deletePath, { body: { code: TARGET } }), {
      status: 404,
      body: { message: 'notFound' },
      cacheControl: null,
    })
  }
  const info = await f.request('/get-employee-info', { body: { code: TARGET } })
  assert.equal(info.status, 200)
  assert.equal(info.body.titleInfo.system_desp_e, 'Engineer')
  assert.deepEqual(
    await f.request('/get-employee-info', { body: { code: 'NOPE01' } }),
    {
      status: 404,
      body: { message: 'employeeInfoMessing' },
      cacheControl: null,
    }
  )
  // The generic SQL routes were retired in Phase 5, even for administrators.
  const callsBefore = f.calls.length
  for (const suffix of ['/sql-call', '/hr-sql-call']) {
    const legacy = await f.request(suffix, { body: { query: 'SELECT 1' } })
    assert.deepEqual(
      [legacy.status, legacy.body],
      [404, { message: 'notFound' }]
    )
  }
  assert.equal(f.calls.length, callsBefore)
})

test('authenticated non-administrators are refused on every administration route', async (t) => {
  const f = await httpFixture(t)
  // The non-admin holds other module roles; none implies portal administration.
  for (const table of Object.values(MODULE_TABLES).slice(1))
    f.state.tables[table].push(memberRow(USER))
  for (const [suffix, options] of allProtectedRequests()) {
    const before = f.calls.length
    const response = await f.request(suffix, { ...options, as: 'user' })
    assert.deepEqual(
      [response.status, response.body],
      [403, { message: 'forbidden' }],
      suffix
    )
    const executed = f.calls.slice(before)
    assert.equal(executed.length, 1, `${suffix} ran only the role check`)
    assert.equal(executed[0].owner.kind, 'role')
    assert.equal(executed[0].inputs.employeeCode.value, USER)
  }
})

test('spoofed caller IDs and role flags cannot grant administration access', async (t) => {
  const f = await httpFixture(t)
  const spoof = {
    code: TARGET,
    employeeCode: ADMIN,
    employeeID: ADMIN,
    isPortalAdmin: true,
    auth: { employeeCode: ADMIN },
    query: 'SELECT 1',
  }
  for (const suffix of [
    `/members/portal?employeeCode=${ADMIN}&isPortalAdmin=true`,
    '/add-portal-admin',
    '/delete-portal-admin',
    '/get-employee-info',
  ]) {
    const response = await f.request(suffix, {
      as: 'user',
      body: suffix.startsWith('/members') ? undefined : spoof,
      headers: { 'X-Employee-Code': ADMIN, 'X-Portal-Admin': 'true' },
    })
    assert.equal(response.status, 403, suffix)
  }
  assert.equal(f.state.tables.admin_members.length, 1)
  // An administrator's target ID is validated and never becomes the caller.
  for (const code of ["1' OR 1=1 --", ADMIN + ' ', 'x'.repeat(21), 5, null]) {
    assert.deepEqual(await f.request('/add-portal-admin', { body: { code } }), {
      status: 400,
      body: { message: 'invalidEmployeeCode' },
      cacheControl: null,
    })
  }
  assert.equal(
    f.calls.some((call) => call.statement === HR_EMPLOYEE_QUERY),
    false
  )
})

test('missing, tampered and revoked sessions are rejected before role checks', async (t) => {
  const f = await httpFixture(t)
  for (const [suffix, options] of allProtectedRequests()) {
    for (const as of [null, 'not-a-token']) {
      const response = await f.request(suffix, { ...options, as })
      assert.deepEqual(
        [response.status, response.body],
        [401, { message: 'authFailed' }]
      )
    }
  }
  f.revoke(f.tokens.admin)
  assert.equal((await f.request('/members/portal')).status, 401)
  assert.equal(f.calls.length, 0)
})

test('revoked portal-admin membership takes effect on the next request', async (t) => {
  const f = await httpFixture(t)
  assert.equal((await f.request('/members/coc')).status, 200)
  f.state.tables.admin_members = []
  assert.deepEqual((await f.request('/members/coc')).body, {
    message: 'forbidden',
  })
  assert.equal(
    (await f.request('/add-coc-admin', { body: { code: TARGET } })).status,
    403
  )
  assert.equal(f.state.tables.coc_admins.length, 0)
})

test('invalid resources, SQL failures and unknown routes return controlled JSON', async (t) => {
  const f = await httpFixture(t)
  for (const name of [
    'unknown',
    '__proto__',
    '%5F%5Fproto%5F%5F',
    'constructor',
    'toString',
    'PORTAL',
    'admin_members',
    'portal%3BDROP',
  ]) {
    assert.deepEqual(await f.request(`/members/${name}`), {
      status: 400,
      body: { message: 'invalidModule' },
      cacheControl: 'no-store',
    })
    assert.equal(
      (await f.request(`/members/${name}`, { as: 'user' })).status,
      403
    )
  }
  assert.equal((await f.request('/members/')).status, 404)
  assert.equal((await f.request('/members/portal/extra')).status, 404)
  // Malformed percent-encoding and JSON bodies never reach SQL or return HTML.
  const callsBefore = f.calls.length
  assert.deepEqual((await f.request('/members/%E0%A4%A')).body, {
    message: 'invalidRequest',
  })
  for (const body of ['{"code":', 'not json']) {
    const response = await f.raw('/add-portal-admin', body)
    assert.deepEqual(response, {
      status: 400,
      body: { message: 'invalidRequest' },
    })
  }
  assert.equal(f.calls.length, callsBefore)
  assert.deepEqual(await f.request('/does-not-exist'), {
    status: 404,
    body: { message: 'notFound' },
    cacheControl: null,
  })

  for (const failAt of ['list', 'query', 'connect']) {
    f.state.failAt = failAt === 'query' ? HR_EMPLOYEE_QUERY : failAt
    const suffix = failAt === 'query' ? '/get-employee-info' : '/members/dtr'
    const response = await f.request(suffix, {
      body: failAt === 'query' ? { code: TARGET } : undefined,
    })
    // A connection failure also breaks the role check and is reported the same.
    assert.deepEqual(
      [response.status, response.body],
      [503, { message: 'serviceUnavailable' }]
    )
  }
  f.state.failAt = 'role'
  assert.deepEqual((await f.request('/members/portal')).body, {
    message: 'serviceUnavailable',
  })
  f.state.failAt = null
  assert.ok(f.pools.every((pool) => pool.closed))
})

// Frontend: execute the real Vuex modules with mocked Axios and i18n.
function loadModule(relative) {
  const filename = path.resolve(root, relative)
  const compiled = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    configFile: false,
    babelrc: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code
  const module = { exports: {} }
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: (specifier) =>
      specifier.startsWith('~/')
        ? loadModule(`${specifier.slice(2)}.js`)
        : require(specifier),
  })
  return module.exports
}

const STORES = [
  [
    'portalAdmins',
    'getPortalAdmins',
    'SET_PORTAL_ADMINS',
    'portal',
    'addPortalAdmin',
    'deletePortalAdmin',
    'portalAdmins',
  ],
  [
    'businessCardsAdmins',
    'getBusinessCardsAdmins',
    'SET_BUSINESS_CARDS_ADMINS',
    'business-cards',
    'addBusinessCardsAdmin',
    'deleteBusinessCardsAdmin',
    'bCards',
  ],
  [
    'cocAdmins',
    'getCOCAdmins',
    'SET_COC_ADMINS',
    'coc',
    'addCOCAdmin',
    'deleteCOCAdmin',
    'bCards',
  ],
  [
    'elevatorsAdmins',
    'getElevatorsAdmins',
    'SET_ELEVATORS_ADMINS',
    'elevators',
    'addElevatorsAdmin',
    'deleteElevatorsAdmin',
    'elevators',
  ],
  [
    'hrSurveys',
    'getHRSurveyUsers',
    'SET_HR_SURVEYS_USERS',
    'hr-surveys',
    'addHRSurveyUser',
    'deleteHRSurveyUser',
    'elevators',
  ],
  [
    'dtrUsers',
    'getDTRUsers',
    'SET_DTR_USERS',
    'dtr',
    'addDTRUser',
    'deleteDTRUser',
    'dtrApp',
  ],
]

function storeRuntime(axios) {
  const messages = {
    en: JSON.parse(fs.readFileSync(path.join(root, 'locales/en.json'), 'utf8')),
  }
  const lookup = (key) =>
    key.split('.').reduce((value, part) => value && value[part], messages.en)
  return {
    $config: { baseURL: 'https://portal.invalid' },
    $axios: axios,
    app: {
      i18n: {
        te: (key) => typeof lookup(key) === 'string',
        t: (key) => lookup(key) || key,
      },
    },
  }
}

test('the six list stores use the fixed endpoint and translate controlled errors', async () => {
  const en = JSON.parse(
    fs.readFileSync(path.join(root, 'locales/en.json'), 'utf8')
  )
  for (const [
    file,
    listAction,
    mutation,
    moduleName,
    addAction,
    deleteAction,
    ns,
  ] of STORES) {
    const store = loadModule(`store/administration/${file}.js`)
    const source = fs.readFileSync(
      path.join(root, `store/administration/${file}.js`),
      'utf8'
    )
    assert.doesNotMatch(source, /sql-call|SELECT|query:/i, file)

    const requests = []
    const rows = [memberRow('M1')]
    const runtime = storeRuntime({
      get: async (url, config) => {
        requests.push({ method: 'get', url, config })
        return { status: 200, data: rows }
      },
      post: () => assert.fail('list must not POST'),
    })
    const commits = []
    const notifications = []
    const context = {
      commit: (...args) => commits.push(args),
      dispatch: async (name, value) => notifications.push(value),
    }
    await store.actions[listAction].call(runtime, context)
    assert.deepEqual(requests, [
      {
        method: 'get',
        url: `https://portal.invalid/administration-api/members/${moduleName}`,
        config: undefined,
      },
    ])
    assert.deepEqual(commits, [[mutation, rows]])
    assert.equal(notifications.length, 0)

    // 403 after revocation: list is cleared and a translated message shown.
    commits.length = 0
    runtime.$axios.get = async () => {
      const error = new Error('Request failed')
      error.response = { status: 403, data: { message: 'forbidden' } }
      throw error
    }
    await store.actions[listAction].call(runtime, context)
    // Values created inside the VM realm are compared structurally.
    assert.deepEqual(JSON.parse(JSON.stringify(commits)), [[mutation, []]])
    assert.equal(
      notifications.at(-1).message,
      en.errorMessages.administration.members.forbidden
    )
    // Network failure without a response does not throw.
    runtime.$axios.get = async () => {
      throw new Error('Network Error')
    }
    await store.actions[listAction].call(runtime, context)
    assert.equal(
      notifications.at(-1).message,
      en.errorMessages.login.serviceUnavailable
    )

    // Mutations keep their URLs, payloads and translated notifications.
    const posts = []
    runtime.$axios.post = async (url, body) => {
      posts.push({ url, body })
      const error = new Error('Request failed')
      error.response = { status: 409, data: { message: 'memberExist' } }
      throw error
    }
    await store.actions[addAction].call(runtime, context, { code: TARGET })
    assert.equal(
      notifications.at(-1).message,
      en.errorMessages.administration[ns].memberExist
    )
    runtime.$axios.post = async (url, body) => {
      posts.push({ url, body })
      throw new Error('Network Error')
    }
    await store.actions[deleteAction].call(runtime, context, { code: TARGET })
    assert.equal(
      notifications.at(-1).message,
      en.errorMessages.login.serviceUnavailable
    )
    assert.deepEqual(
      posts.map(({ body }) => body),
      [{ code: TARGET }, { code: TARGET }]
    )
    const routes = MUTATION_ROUTES.find(([name]) => name === moduleName)
    assert.deepEqual(
      posts.map(({ url }) => url),
      [
        `https://portal.invalid/administration-api${routes[1]}`,
        `https://portal.invalid/administration-api${routes[2]}`,
      ]
    )
  }

  const dtrSetup = loadModule('store/administration/dtrSetup.js')
  const notifications = []
  const runtime = storeRuntime({
    post: async () => {
      const error = new Error('Request failed')
      error.response = { status: 403, data: { message: 'forbidden' } }
      throw error
    },
  })
  await dtrSetup.actions.getEmployeeInfo.call(
    runtime,
    {
      commit: () => {},
      dispatch: async (name, value) => notifications.push(value),
    },
    { code: TARGET }
  )
  assert.equal(
    notifications[0].message,
    en.errorMessages.administration.dtrSetup.forbidden
  )
})

test('English and Arabic contain every administration error code', () => {
  const codes = {
    members: ['forbidden', 'authFailed', 'invalidModule', 'serviceUnavailable'],
    dtrSetup: [
      'employeeInfoMessing',
      'invalidEmployeeCode',
      'employeeInfoInvalid',
      'forbidden',
      'authFailed',
      'serviceUnavailable',
    ],
  }
  for (const ns of ['bCards', 'elevators', 'portalAdmins', 'dtrApp'])
    codes[ns] = [
      'memberExist',
      'employeeInfoMessing',
      'notFound',
      'invalidEmployeeCode',
      'employeeInfoInvalid',
      'forbidden',
      'authFailed',
      'serviceUnavailable',
    ]
  for (const locale of ['en', 'ar']) {
    const messages = JSON.parse(
      fs.readFileSync(path.join(root, `locales/${locale}.json`), 'utf8')
    ).errorMessages
    assert.equal(typeof messages.login.serviceUnavailable, 'string')
    for (const [ns, keys] of Object.entries(codes))
      for (const key of keys)
        assert.equal(
          typeof messages.administration[ns][key],
          'string',
          `${locale}:${ns}.${key}`
        )
  }
})

test('no frontend caller of the retired administration SQL routes remains', () => {
  const found = []
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(vue|js)$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8')
        if (/administration-api\/(hr-)?sql-call/.test(text))
          found.push(path.relative(root, full).replaceAll('\\', '/'))
      }
    }
  }
  for (const directory of ['pages', 'components', 'store', 'layouts', 'utils'])
    walk(path.join(root, directory))
  assert.deepEqual(found, [])
})
