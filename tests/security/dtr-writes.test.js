const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const babel = require('@babel/core')
const compiler = require('vue-template-compiler')
const {
  DAY_COLUMNS,
  entryVersion,
} = require('../../server/dtr/services/entryVersion')
const { parsePeriod } = require('../../server/dtr/services/dtrReads')
const {
  DAY_CODES,
  MEMBER_QUERY,
  LOCK_ENTRY,
  SAVE_UPDATE,
  SAVE_INSERT,
  SUBMIT,
  APPROVE,
  DECLINE,
} = require('../../server/dtr/services/dtrWrites')
const {
  httpFixture,
  WINTER,
  SHORT,
  LEAP,
  SPRING,
  ADM_DIV,
  MGR1,
} = require('./helpers/dtr-fixture')

const row = (f, code = 'E1', period = WINTER) =>
  f.state.entries.find(
    (entry) =>
      entry.EmployeeCode === code &&
      entry.StartDate === period.start &&
      entry.EndDate === period.end
  )
const days = (period) =>
  parsePeriod(period.start, period.end).days.map((date) => ({
    date,
    type: 'RA',
  }))
const target = (f, code = 'E1', period = WINTER) => ({
  employeeCode: code,
  version: entryVersion(row(f, code, period)),
})
const saveBody = (f, code = 'E1', period = WINTER) => ({
  ...period,
  ...target(f, code, period),
  dtrEntries: days(period),
})
const outcome = (res) => [res.status, res.body.message]
const snapshot = (f) => structuredClone(f.state.entries)
const post = (f, route, body, as = 'division') => f.request(route, { body, as })

test('DTR write statements are fixed, period-scoped and guarded inside transactions', () => {
  assert.match(LOCK_ENTRY, /WITH \(UPDLOCK, HOLDLOCK\)/)
  for (const statement of [LOCK_ENTRY, SAVE_UPDATE, SUBMIT, APPROVE, DECLINE]) {
    assert.match(
      statement,
      /EmployeeCode = @employeeCode AND StartDate = CONVERT\(date, @periodStart, 23\)/
    )
    assert.match(statement, /EndDate = CONVERT\(date, @periodEnd, 23\)/)
  }
  for (const statement of [APPROVE, DECLINE])
    assert.match(statement, /ApprovalStatus = 1 AND ManagerCode = @managerCode/)
  for (const statement of [SAVE_UPDATE, SUBMIT])
    assert.match(statement, /ApprovalStatus IN \(0, 2\)/)
  assert.match(SAVE_INSERT, /GETDATE\(\), @caller, 0, NULL, 0/)
  for (const statement of [SAVE_UPDATE, SUBMIT, APPROVE, DECLINE])
    assert.match(statement, /DATEADD\(millisecond, 4, ModifiedDate\)/)
  assert.match(MEMBER_QUERY, /dbo.dtr_users\s+WHERE employeeID = @caller/)
})

test('isolated HTTP completes draft, submit, decline, correction, resubmit and approval', async (t) => {
  const f = await httpFixture(t)
  const body = saveBody(f, 'E6')
  const saved = await post(f, '/save-dtr-data', body)
  assert.equal(saved.status, 200)
  assert.equal(row(f, 'E6').ModifiedBy, ADM_DIV)
  assert.equal(row(f, 'E6').ManagerCode, MGR1)
  assert.equal(saved.body.version, entryVersion(row(f, 'E6')))
  const calendar = await f.get('/employees/E6/calendar', WINTER)
  assert.equal(calendar.body.entry.version, saved.body.version)
  assert.deepEqual(
    Object.keys(calendar.body.entry).sort(),
    [
      'ApprovalStatus',
      'DeclineFlag',
      'DeclineMessage',
      'days',
      'version',
    ].sort()
  )
  assert.equal(
    (await post(f, '/submit', { ...WINTER, ...target(f, 'E6') })).status,
    200
  )
  const queue = await f.get('/pending-approvals', WINTER, { as: 'manager' })
  assert.equal(
    queue.body.find((entry) => entry.EmployeeCode === 'E6').version,
    entryVersion(row(f, 'E6'))
  )
  assert.equal(
    (
      await post(
        f,
        '/decline',
        { ...WINTER, ...target(f, 'E6'), declineMessage: "راجع اليوم '3'" },
        'manager'
      )
    ).status,
    200
  )
  assert.equal(row(f, 'E6').ApprovalStatus, 2)
  assert.equal(row(f, 'E6').DeclineFlag, true)
  const correction = saveBody(f, 'E6')
  correction.dtrEntries[0].type = 'AB'
  assert.equal((await post(f, '/save-dtr-data', correction)).status, 200)
  assert.equal(row(f, 'E6').ApprovalStatus, 0)
  assert.equal(row(f, 'E6').DeclineMessage, "راجع اليوم '3'")
  assert.equal(row(f, 'E6').DeclineFlag, true)
  assert.equal(
    (await post(f, '/submit', { ...WINTER, ...target(f, 'E6') })).status,
    200
  )
  assert.equal(row(f, 'E6').DeclineFlag, false)
  assert.equal(row(f, 'E6').DeclineMessage, null)
  assert.equal(
    (await post(f, '/approve', { ...WINTER, ...target(f, 'E6') }, 'manager'))
      .status,
    200
  )
  assert.equal(row(f, 'E6').ApprovalStatus, 3)
  assert.equal(row(f, 'E6').ModifiedBy, MGR1)
  assert.ok(f.pools.every((pool) => pool.closed))
  assert.ok(f.transactions.every((tx) => tx.isolation === 4 && !tx.active))
  assert.ok(
    f.calls
      .filter(
        (call) =>
          call.name !== 'role' &&
          !['entry', 'pending', 'assignments', 'one:division'].includes(
            call.name
          )
      )
      .every((call) => call.transaction)
  )
})

test('all write routes require a registered session and current DTR membership', async (t) => {
  const f = await httpFixture(t)
  for (const route of [
    '/save-dtr-data',
    '/submit',
    '/approve',
    '/decline',
    '/bulk-submit',
    '/bulk-approve',
  ]) {
    for (const as of [null, 'bad-token'])
      assert.equal((await post(f, route, {}, as)).status, 401)
    assert.deepEqual(outcome(await post(f, route, {}, 'nonMember')), [
      403,
      'forbidden',
    ])
  }
  f.revoke(f.tokens.division)
  assert.equal((await post(f, '/save-dtr-data', saveBody(f))).status, 401)
  assert.equal(f.state.writes, undefined)
  assert.ok(f.calls.every((call) => call.name === 'role'))
})

test('membership revoked between the route guard and write is refused in the transaction', async (t) => {
  const f = await httpFixture(t)
  f.state.revokeAfterRole = true
  const before = snapshot(f)
  assert.deepEqual(outcome(await post(f, '/save-dtr-data', saveBody(f))), [
    403,
    'forbidden',
  ])
  assert.deepEqual(f.names(), ['role', 'memberWrite'])
  assert.deepEqual(snapshot(f), before)
})

test('assignment scope is reused at every level; missing, inactive and unrelated employees cannot be written', async (t) => {
  const f = await httpFixture(t)
  for (const as of ['division', 'department', 'project', 'subProject']) {
    assert.equal((await post(f, '/save-dtr-data', saveBody(f), as)).status, 200)
  }
  for (const [as, employeeCode] of [
    ['division', 'E4'],
    ['division', 'E8'],
    ['division', 'E3'],
    ['division', 'NOPE'],
    ['subProject', 'E2'],
    ['project', 'E9'],
    ['none', 'E1'],
    ['bad', 'E1'],
    ['longCode', 'E1'],
  ]) {
    const before = snapshot(f)
    assert.deepEqual(
      outcome(await post(f, '/save-dtr-data', saveBody(f, employeeCode), as)),
      [403, 'forbidden']
    )
    const version = target(f, employeeCode).version || '0'.repeat(64)
    assert.equal(
      (await post(f, '/submit', { ...WINTER, employeeCode, version }, as))
        .status,
      403
    )
    assert.deepEqual(snapshot(f), before)
  }
})

test('forged editor, manager, employee details, SQL and final-status fields are rejected', async (t) => {
  const f = await httpFixture(t)
  const before = snapshot(f)
  for (const [key, value] of Object.entries({
    managerCode: 'M200',
    dtrAdmin: 'Manager',
    employeeName: 'Fake',
    employeePicture: 'fake.jpg',
    ApprovalStatus: 3,
    approvalStatus: 3,
    query: 'UPDATE secret',
    parameters: {},
  })) {
    assert.deepEqual(
      outcome(
        await post(f, '/save-dtr-data', { ...saveBody(f), [key]: value })
      ),
      [400, 'invalidRequest']
    )
    assert.deepEqual(
      outcome(
        await post(
          f,
          '/approve',
          { ...WINTER, ...target(f, 'E2'), [key]: value },
          'manager'
        )
      ),
      [400, 'invalidRequest']
    )
  }
  assert.deepEqual(snapshot(f), before)
  assert.ok(f.calls.every((call) => call.name === 'role'))
})

test('pending and approved entries cannot be saved or reopened; only the recorded manager decides pending entries', async (t) => {
  const f = await httpFixture(t)
  for (const code of ['E2', 'E5']) {
    assert.deepEqual(
      outcome(await post(f, '/save-dtr-data', saveBody(f, code))),
      [409, 'stateConflict']
    )
    assert.deepEqual(
      outcome(await post(f, '/submit', { ...WINTER, ...target(f, code) })),
      [409, 'stateConflict']
    )
  }
  for (const action of ['approve', 'decline']) {
    const body = {
      ...WINTER,
      ...target(f, 'E2'),
      ...(action === 'decline' ? { declineMessage: 'Fix this' } : {}),
    }
    assert.equal((await post(f, '/' + action, body)).status, 403)
    assert.equal((await post(f, '/' + action, body, 'manager2')).status, 403)
    for (const code of ['E1', 'E7'])
      assert.equal(
        (
          await post(
            f,
            '/' + action,
            { ...body, ...target(f, code) },
            'manager'
          )
        ).status,
        409
      )
  }
  // An inactive employee's pending entry can still be decided by its manager.
  assert.equal(
    (await post(f, '/approve', { ...WINTER, ...target(f, 'E3') }, 'manager'))
      .status,
    200
  )
})

test('stale saves, duplicate creation and simultaneous decisions have one winner', async (t) => {
  const f = await httpFixture(t)
  const body = saveBody(f)
  const results = await Promise.all([
    post(f, '/save-dtr-data', body),
    post(f, '/save-dtr-data', body),
  ])
  assert.deepEqual(results.map((res) => res.status).sort(), [200, 409])
  assert.equal((await post(f, '/save-dtr-data', body)).status, 409)
  const fresh = saveBody(f, 'E6')
  assert.deepEqual(
    (
      await Promise.all([
        post(f, '/save-dtr-data', fresh),
        post(f, '/save-dtr-data', fresh),
      ])
    )
      .map((res) => res.status)
      .sort(),
    [200, 409]
  )
  assert.equal(
    f.state.entries.filter((entry) => entry.EmployeeCode === 'E6').length,
    1
  )
  const decision = { ...WINTER, ...target(f, 'E2') }
  const decisions = await Promise.all([
    post(f, '/approve', decision, 'manager'),
    post(f, '/decline', { ...decision, declineMessage: 'Fix' }, 'manager'),
  ])
  assert.deepEqual(decisions.map((res) => res.status).sort(), [200, 409])
  const accepted = structuredClone(row(f, 'E2'))
  assert.equal((await post(f, '/approve', decision, 'manager')).status, 409)
  assert.deepEqual(row(f, 'E2'), accepted)
})

test('old versions remain stale after decline, correction and resubmission to the same status', async (t) => {
  const f = await httpFixture(t)
  const old = { ...WINTER, ...target(f, 'E2') }
  assert.equal(
    (await post(f, '/decline', { ...old, declineMessage: 'Fix' }, 'manager'))
      .status,
    200
  )
  assert.equal((await post(f, '/save-dtr-data', saveBody(f, 'E2'))).status, 200)
  assert.equal(
    (await post(f, '/submit', { ...WINTER, ...target(f, 'E2') })).status,
    200
  )
  assert.equal((await post(f, '/approve', old, 'manager')).status, 409)
  assert.equal(row(f, 'E2').ApprovalStatus, 1)
})

test('mixed unauthorized, stale, missing or duplicate bulk targets change no records', async (t) => {
  const f = await httpFixture(t)
  for (const [route, as, targets, status] of [
    ['/bulk-submit', 'division', [target(f), target(f, 'E4')], 403],
    ['/bulk-submit', 'division', [target(f), target(f, 'E2')], 409],
    [
      '/bulk-submit',
      'division',
      [target(f), { employeeCode: 'E6', version: '0'.repeat(64) }],
      409,
    ],
    [
      '/bulk-submit',
      'division',
      [target(f), { ...target(f, 'E7'), version: '0'.repeat(64) }],
      409,
    ],
    ['/bulk-approve', 'manager', [target(f, 'E2'), target(f, 'E4')], 403],
    ['/bulk-approve', 'manager', [target(f, 'E2'), target(f)], 409],
    [
      '/bulk-approve',
      'manager',
      [target(f, 'E2'), { ...target(f, 'E3'), version: '0'.repeat(64) }],
      409,
    ],
    [
      '/bulk-submit',
      'division',
      [target(f), { ...target(f), employeeCode: 'e1' }],
      400,
    ],
    ['/bulk-submit', 'division', [], 400],
    [
      '/bulk-approve',
      'manager',
      [target(f, 'E2'), { employeeCode: "E2');--", version: '0'.repeat(64) }],
      400,
    ],
  ]) {
    const before = snapshot(f)
    assert.equal(
      (await post(f, route, { ...WINTER, targets }, as)).status,
      status
    )
    assert.deepEqual(snapshot(f), before)
  }
  assert.equal(f.state.writes, undefined)
})

test('bulk submissions and approvals are atomic and use one typed binding per target', async (t) => {
  const f = await httpFixture(t)
  const targets = [target(f, 'E7'), target(f)]
  assert.deepEqual(
    (await post(f, '/bulk-submit', { ...WINTER, targets })).body,
    { message: 'dtrUpdated', affected: 2 }
  )
  assert.equal(row(f, 'E7').DeclineFlag, false)
  assert.equal(
    (
      await post(
        f,
        '/bulk-approve',
        { ...WINTER, targets: [target(f), target(f, 'E7')] },
        'manager'
      )
    ).status,
    200
  )
  for (const code of ['E1', 'E7']) assert.equal(row(f, code).ApprovalStatus, 3)
  const writes = f.calls.filter((call) =>
    ['submit', 'approve'].includes(call.name)
  )
  assert.equal(writes.length, 4)
  for (const call of writes) {
    assert.ok(
      !call.statement.includes("'E1'") && !call.statement.includes("'E7'")
    )
    assert.deepEqual(call.inputs.employeeCode.type, {
      name: 'varchar',
      length: 10,
    })
    assert.deepEqual(call.inputs.caller.type, { name: 'nvarchar', length: 20 })
    assert.deepEqual(call.inputs.periodStart.type, {
      name: 'varchar',
      length: 10,
    })
    assert.ok(call.transaction.committed)
    if (call.name === 'approve')
      assert.equal(call.inputs.managerCode.value, MGR1)
  }
})

test('a second bulk write failure or affected-row conflict rolls back the first write', async (t) => {
  for (const route of ['/bulk-submit', '/bulk-approve']) {
    const f = await httpFixture(t)
    const codes = route === '/bulk-submit' ? ['E1', 'E7'] : ['E2', 'E3']
    const before = snapshot(f)
    f.state.failWriteAt = 2
    assert.deepEqual(
      outcome(
        await post(
          f,
          route,
          { ...WINTER, targets: codes.map((code) => target(f, code)) },
          route === '/bulk-submit' ? 'division' : 'manager'
        )
      ),
      [503, 'serviceUnavailable']
    )
    assert.deepEqual(snapshot(f), before)
    assert.ok(
      f.transactions
        .filter((tx) => tx.pool.config.name === 'portal')
        .every((tx) => tx.rolledBack)
    )
    f.state.failWriteAt = null
    f.state.zeroAffected = true
    assert.equal(
      (
        await post(
          f,
          route,
          { ...WINTER, targets: codes.map((code) => target(f, code)) },
          route === '/bulk-submit' ? 'division' : 'manager'
        )
      ).status,
      409
    )
    assert.deepEqual(snapshot(f), before)
    assert.ok(f.pools.every((pool) => pool.closed))
  }
})

test('all month lengths, leap years and unordered day inputs map to fixed 21st-to-20th columns', async (t) => {
  const f = await httpFixture(t)
  for (const period of [WINTER, SHORT, LEAP, SPRING]) {
    const beforeOtherPeriods = snapshot(f).filter(
      (entry) => entry.StartDate !== period.start
    )
    f.state.entries = f.state.entries.filter(
      (entry) =>
        !(entry.EmployeeCode === 'E6' && entry.StartDate === period.start)
    )
    const body = saveBody(f, 'E6', period)
    body.dtrEntries.reverse().forEach((entry, index) => {
      entry.type = DAY_CODES[index % DAY_CODES.length]
    })
    assert.equal((await post(f, '/save-dtr-data', body)).status, 200)
    const saved = row(f, 'E6', period)
    for (const day of DAY_COLUMNS)
      assert.equal(
        saved[day],
        body.dtrEntries.find((entry) => entry.date === day)?.type ?? null
      )
    const binding = f.calls.filter((call) => call.name === 'saveInsert').at(-1)
    for (const day of DAY_COLUMNS)
      assert.deepEqual(binding.inputs['day' + day].type, {
        name: 'nvarchar',
        length: 5,
      })
    assert.deepEqual(
      snapshot(f).filter((entry) => entry.StartDate !== period.start),
      beforeOtherPeriods
    )
  }
  const saved = row(f, 'E6', SHORT)
  assert.equal(saved[29], null)
  assert.equal(saved[30], null)
  assert.equal(saved[31], null)
})

test('missing, duplicate, invalid and out-of-period day values, dates and versions are refused', async (t) => {
  const f = await httpFixture(t)
  const valid = saveBody(f)
  const invalidBodies = [
    { ...valid, dtrEntries: valid.dtrEntries.slice(1) },
    { ...valid, dtrEntries: [...valid.dtrEntries, valid.dtrEntries[0]] },
    {
      ...valid,
      dtrEntries: valid.dtrEntries.map((entry) => ({ ...entry, date: 21 })),
    },
    ...[null, 'RA ', 'ra', 'HACK', 0, ['RA']].map((type) => ({
      ...valid,
      dtrEntries: valid.dtrEntries.map((entry) => ({ ...entry, type })),
    })),
    {
      ...valid,
      dtrEntries: valid.dtrEntries.map((entry) => ({
        ...entry,
        date: String(entry.date),
      })),
    },
    {
      ...saveBody(f, 'E6', SHORT),
      dtrEntries: days(SHORT).map((entry, index) =>
        index === 0 ? { date: 31, type: 'RA' } : entry
      ),
    },
  ]
  for (const body of invalidBodies)
    assert.deepEqual(outcome(await post(f, '/save-dtr-data', body)), [
      400,
      'invalidDays',
    ])
  for (const body of [
    { ...valid, start: '2026-12-21', end: '2026-01-20' },
    { ...valid, start: '2026-010-21' },
  ])
    assert.equal((await post(f, '/save-dtr-data', body)).status, 400)
  for (const version of [undefined, '', {}, [], 'x'.repeat(64)])
    assert.deepEqual(
      outcome(await post(f, '/save-dtr-data', { ...valid, version })),
      [400, 'invalidVersion']
    )
  assert.ok(f.calls.every((call) => call.name === 'role'))
  assert.equal(f.state.writes, undefined)
})

test('decline text is bounded, preserves Unicode/apostrophes and is bound as nvarchar', async (t) => {
  const f = await httpFixture(t)
  const body = { ...WINTER, ...target(f, 'E2') }
  for (const declineMessage of ['', ' ', null, [], 'x'.repeat(301)])
    assert.deepEqual(
      outcome(
        await post(f, '/decline', { ...body, declineMessage }, 'manager')
      ),
      [400, 'invalidDeclineMessage']
    )
  const declineMessage = "  راجع 'اليوم' " + 'ح'.repeat(270)
  assert.equal(
    (await post(f, '/decline', { ...body, declineMessage }, 'manager')).status,
    200
  )
  assert.equal(row(f, 'E2').DeclineMessage, declineMessage)
  assert.deepEqual(
    f.calls.find((call) => call.name === 'decline').inputs.declineMessage,
    { type: { name: 'nvarchar', length: 300 }, value: declineMessage }
  )
})

test('missing/oversized trusted HR data fails without truncation or writes', async (t) => {
  const f = await httpFixture(t)
  const employee = f.state.employees.find(
    (entry) => entry.employee_code === 'E1'
  )
  const original = { ...employee }
  for (const [key, value] of [
    ['Manager_Code', null],
    ['Manager_Code', 'x'.repeat(11)],
    ['employee_name_eng', 'x'.repeat(101)],
    ['employee_name_eng', null],
    ['employee_picture', 'x'.repeat(301)],
  ]) {
    Object.assign(employee, original, { [key]: value })
    assert.deepEqual(outcome(await post(f, '/save-dtr-data', saveBody(f))), [
      422,
      'employeeInfoInvalid',
    ])
  }
  assert.equal(f.state.writes, undefined)
  Object.assign(employee, original, { employee_picture: null })
  assert.equal((await post(f, '/save-dtr-data', saveBody(f))).status, 200)
  assert.equal(row(f).employeePicture, null)
  employee.employee_picture = ''
  assert.equal((await post(f, '/save-dtr-data', saveBody(f))).status, 200)
  assert.equal(row(f).employeePicture, '')
})

test('connection, transaction, scope and write failures return sanitized errors and close every pool', async (t) => {
  for (const failAt of [
    'connect:portal',
    'connect:hr',
    'begin',
    'memberWrite',
    'assignments',
    'one:division',
    'lockEntry',
    'saveUpdate',
    'commit',
  ]) {
    const f = await httpFixture(t)
    const before = snapshot(f)
    f.state.failAt = failAt
    assert.deepEqual(
      outcome(await post(f, '/save-dtr-data', saveBody(f))),
      [503, 'serviceUnavailable'],
      failAt
    )
    assert.deepEqual(snapshot(f), before, failAt)
    assert.ok(
      f.pools.every((pool) => pool.closed),
      failAt
    )
    assert.ok(
      f.transactions.every((tx) => !tx.active),
      failAt
    )
  }
})

test('all retired DTR SQL gateways return HTTP 404 for all callers/methods and run no SQL', async (t) => {
  const f = await httpFixture(t)
  for (const route of [
    '/sql-call',
    '/sql-params-call',
    '/hr-sql-call',
    '/SQL-PARAMS-CALL/',
  ])
    for (const as of ['division', 'manager', 'nonMember', null])
      for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
        assert.deepEqual(
          outcome(
            await f.request(route, {
              as,
              method,
              ...(method === 'GET'
                ? {}
                : { body: { query: 'SELECT 1', parameters: {} } }),
            })
          ),
          [404, 'notFound']
        )
  assert.equal(f.calls.length, 0)
  assert.equal(f.pools.length, 0)
  for (const route of [
    '/submit',
    '/approve',
    '/decline',
    '/bulk-submit',
    '/bulk-approve',
    '/save-dtr-data',
  ])
    assert.equal((await f.request(route, { method: 'GET' })).status, 404)
  assert.equal((await post(f, '/submit', '{')).status, 400)
  assert.equal((await f.get('/employees/E1%ZZ/calendar', WINTER)).status, 400)
})

const root = path.resolve(__dirname, '../..')
const plain = (value) => JSON.parse(JSON.stringify(value))
function load(relative, component = false) {
  let source = fs.readFileSync(path.join(root, relative), 'utf8')
  if (component) source = compiler.parseComponent(source).script.content
  const module = { exports: {} }
  const code = babel.transformSync(source, {
    configFile: false,
    babelrc: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code
  vm.runInNewContext(code, {
    module,
    Date,
    exports: module.exports,
    require: (name) =>
      name.startsWith('~/') ? load(name.slice(2) + '.js') : require(name),
  })
  return component ? module.exports.default : module.exports
}
function client(component) {
  const posts = []
  const events = []
  const notifications = []
  const c = {
    ...component.data(),
    ...component.methods,
    $config: { baseURL: '' },
    $t: (key) => key,
    $emit: (...args) => events.push(args),
    $axios: {
      post: async (url, body) => {
        posts.push([url, plain(body)])
        return { status: 200, data: { version: 'b'.repeat(64) } }
      },
    },
    $store: {
      app: { i18n: { te: () => true, t: (key) => key } },
      dispatch: async (name, value) => {
        if (name === 'appNotifications/addNotification')
          notifications.push(value)
      },
    },
  }
  return { c, posts, events, notifications }
}

test('calendar save and single-submit send only workflow inputs, retain versions, and preserve feedback', async () => {
  const component = load('components/dtr/dtr-table/employeeCalendar.vue', true)
  const { c, posts, events, notifications } = client(component)
  Object.assign(c, {
    employeeCode: 'E1',
    startDate: new Date(2026, 1, 21),
    endDate: new Date(2026, 2, 20),
    calendarLoaded: true,
    entryVersion: 'a'.repeat(64),
    entryStatus: 2,
  })
  component.created.call(c)
  c.prepareDataArray()
  await c.saveData()
  assert.equal(posts[0][0], '/dtr-api/save-dtr-data')
  assert.deepEqual(
    Object.keys(posts[0][1]).sort(),
    ['employeeCode', 'start', 'end', 'version', 'dtrEntries'].sort()
  )
  assert.equal(posts[0][1].version, 'a'.repeat(64))
  assert.equal(posts[0][1].dtrEntries.length, 28)
  assert.equal(c.changeOccurs, false)
  assert.equal(c.entryVersion, 'b'.repeat(64))
  await c.sendSingleForApproval()
  assert.deepEqual(posts[1], [
    '/dtr-api/submit',
    { employeeCode: 'E1', ...SHORT, version: 'b'.repeat(64) },
  ])
  assert.deepEqual(events, [['employeeDataSaved', 'E1'], ['closePanel']])
  assert.equal(notifications.length, 2)
  assert.equal(c.overlay, false)
  assert.equal(c.entryStatus, 1)
})

test('calendar blocks failed reads/unsaved submissions and keeps edits with translated conflict or network feedback', async () => {
  const component = load('components/dtr/dtr-table/employeeCalendar.vue', true)
  const { c, posts, events, notifications } = client(component)
  Object.assign(c, {
    employeeCode: 'E1',
    startDate: new Date(2026, 1, 21),
    endDate: new Date(2026, 2, 20),
    changeOccurs: true,
  })
  component.created.call(c)
  await c.saveData()
  await c.sendSingleForApproval()
  assert.deepEqual(posts, [])
  c.calendarLoaded = true
  await c.sendSingleForApproval()
  assert.deepEqual(posts, [])
  c.$axios.post = async () => {
    throw Object.assign(new Error('private SQL detail'), {
      response: { status: 409, data: { message: 'stateConflict' } },
    })
  }
  await c.saveData()
  assert.equal(c.changeOccurs, true)
  assert.equal(c.calendarLoaded, false)
  assert.equal(c.overlay, false)
  assert.deepEqual(events, [])
  assert.equal(notifications.at(-1).message, 'errorMessages.dtr.stateConflict')
  c.calendarLoaded = true
  c.$store.app.i18n.te = () => false
  c.$axios.post = async () => {
    throw new Error('Network Error')
  }
  await c.saveData()
  assert.equal(
    notifications.at(-1).message,
    'errorMessages.login.serviceUnavailable'
  )
  for (const entryStatus of [1, 3])
    assert.equal(
      component.computed.disabledStatus.call({
        ...c,
        calendarLoaded: true,
        entryStatus,
      }),
      true
    )
})

test('DTR table and approvals callers use explicit operations with versions and refresh after stale decisions', async () => {
  const table = client(load('pages/dtr/dtr-table/index.vue', true))
  Object.assign(table.c, {
    startDate: '21-12-2025',
    endDate: '20-01-2026',
    allEmployeesData: [
      { employee_code: 'E1', version: 'a'.repeat(64), statusColor: 'yellow' },
    ],
    getRecordsStatus: async () => {},
  })
  await table.c.sendForApproval()
  assert.deepEqual(table.posts, [
    [
      '/dtr-api/bulk-submit',
      { ...WINTER, targets: [{ employeeCode: 'E1', version: 'a'.repeat(64) }] },
    ],
  ])
  const approvals = client(load('pages/dtr/approvals/index.vue', true))
  Object.assign(approvals.c, {
    dtrAppStartDate: '21-12-2025',
    dtrAppEndDate: '20-01-2026',
    employeesWaitingApproval: [{ EmployeeCode: 'E2', version: 'a'.repeat(64) }],
    declineMSG: 'Fix',
  })
  await approvals.c.singleDecline('E2')
  assert.deepEqual(approvals.posts[0], [
    '/dtr-api/decline',
    {
      ...WINTER,
      employeeCode: 'E2',
      version: 'a'.repeat(64),
      declineMessage: 'Fix',
    },
  ])
  assert.deepEqual(plain(approvals.c.employeesWaitingApproval), [])
  approvals.c.employeesWaitingApproval = [
    { EmployeeCode: 'E2', version: 'b'.repeat(64) },
  ]
  await approvals.c.singleApproval('E2')
  assert.equal(approvals.posts[1][0], '/dtr-api/approve')
  approvals.c.employeesWaitingApproval = [
    { EmployeeCode: 'E2', version: 'b'.repeat(64) },
  ]
  await approvals.c.approveAll()
  assert.deepEqual(approvals.posts[2], [
    '/dtr-api/bulk-approve',
    { ...WINTER, targets: [{ employeeCode: 'E2', version: 'b'.repeat(64) }] },
  ])
  let refreshed = 0
  approvals.c.getEmployeesWaitingForApproval = async () => {
    refreshed++
  }
  approvals.c.$axios.post = async () => {
    throw Object.assign(new Error('Conflict'), {
      response: { status: 409, data: { message: 'stateConflict' } },
    })
  }
  await approvals.c.singleApproval('E2')
  assert.equal(refreshed, 1)
  assert.equal(approvals.c.overlay, false)
  assert.equal(
    approvals.notifications.at(-1).message,
    'errorMessages.dtr.stateConflict'
  )
})

test('calendar reload restores the latest version and days after a conflict without an extra save', async () => {
  const component = load('components/dtr/dtr-table/employeeCalendar.vue', true)
  const { c, posts } = client(component)
  Object.assign(c, {
    employeeCode: 'E1',
    startDate: new Date(2026, 1, 21),
    endDate: new Date(2026, 2, 20),
    entryVersion: 'a'.repeat(64),
    changeOccurs: true,
    calendarLoaded: false,
  })
  component.created.call(c)
  c.weeks
    .flat()
    .filter((day) => !day.empty)
    .forEach((day) => {
      day.type = 'AB'
    })
  c.$store.dispatch = async () => ({
    EmployeeCode: 'E1',
    entry: {
      version: 'b'.repeat(64),
      ApprovalStatus: 1,
      DeclineMessage: null,
      days: {
        ...Object.fromEntries(
          days(SHORT).map((entry) => [entry.date, entry.type])
        ),
        25: 'SV',
      },
    },
  })
  await c.getSavedData()
  assert.equal(c.entryVersion, 'b'.repeat(64))
  assert.equal(c.entryStatus, 1)
  assert.equal(c.changeOccurs, false)
  assert.equal(c.calendarLoaded, true)
  assert.equal(c.dtrEntriesArray.length, 28)
  assert.equal(c.dtrEntriesArray.find((day) => day.date === 25).type, 'SV')
  assert.deepEqual(posts, [])
})

test('manager dialogs keep the selected row and displayed version across cached panels and queue refreshes', async () => {
  const component = load('pages/dtr/approvals/index.vue', true)
  const { c, posts } = client(component)
  Object.assign(c, {
    dtrAppStartDate: '21-12-2025',
    dtrAppEndDate: '20-01-2026',
    employeesWaitingApproval: [
      { EmployeeCode: 'E2', version: 'a'.repeat(64) },
      { EmployeeCode: 'E3', version: 'c'.repeat(64) },
    ],
  })
  c.openDecision(c.employeesWaitingApproval[0])
  assert.equal(c.confirmationDialog, true)
  assert.equal(c.declineDialog, false)
  c.employeesWaitingApproval[0].version = 'b'.repeat(64)
  await c.singleApproval(c.selectedEntry.EmployeeCode)
  assert.deepEqual(posts[0], [
    '/dtr-api/approve',
    { ...WINTER, employeeCode: 'E2', version: 'a'.repeat(64) },
  ])
  c.openDecision(c.employeesWaitingApproval[0], true)
  assert.equal(c.selectedEntry.EmployeeCode, 'E3')
  assert.equal(c.confirmationDialog, false)
  assert.equal(c.declineDialog, true)
  c.declineMSG = 'Fix'
  await c.singleDecline(c.selectedEntry.EmployeeCode)
  assert.deepEqual(posts[1], [
    '/dtr-api/decline',
    {
      ...WINTER,
      employeeCode: 'E3',
      version: 'c'.repeat(64),
      declineMessage: 'Fix',
    },
  ])
})

test('submission rejects incomplete/unknown stored day codes atomically and accepts every UI day code', async (t) => {
  const f = await httpFixture(t)
  for (const value of [null, 'OTHER', 'RA ']) {
    row(f, 'E7')[1] = value
    const before = snapshot(f)
    assert.deepEqual(
      outcome(
        await post(f, '/bulk-submit', {
          ...WINTER,
          targets: [target(f), target(f, 'E7')],
        })
      ),
      [400, 'invalidDays']
    )
    assert.deepEqual(snapshot(f), before)
  }
  const source = fs.readFileSync(
    path.join(root, 'components/dtr/dtr-table/employeeCalendar.vue'),
    'utf8'
  )
  const optionCodes = [...source.matchAll(/<option value="([^"]+)"/g)].map(
    (match) => match[1]
  )
  assert.deepEqual(optionCodes, DAY_CODES)
  assert.equal(f.state.writes, undefined)
})

test('real Vuetify calendar renders draft, pending, approved and reload controls in English and Arabic RTL', async () => {
  const Vue = require('vue')
  const Vuetify = require('vuetify')
  Vue.use(Vuetify)
  const relative = 'components/dtr/dtr-table/employeeCalendar.vue'
  const component = load(relative, true)
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
  const render = compiler.compileToFunctions(
    compiler.parseComponent(source).template.content
  )
  for (const locale of ['en', 'ar']) {
    const messages = JSON.parse(
      fs.readFileSync(path.join(root, 'locales/' + locale + '.json'), 'utf8')
    )
    const translate = (key) =>
      key.split('.').reduce((value, part) => value && value[part], messages) ||
      key
    for (const entryStatus of [0, 1, 2, 3, null]) {
      const instance = new Vue({
        ...component,
        ...render,
        vuetify: new Vuetify({ rtl: locale === 'ar' }),
        propsData: {
          employeeCode: 'E1',
          startDate: new Date(2026, 1, 21),
          endDate: new Date(2026, 2, 20),
          statusColor: 'yellow',
          declineFlag: false,
        },
        data: () => ({
          ...component.data(),
          calendarLoaded: entryStatus !== null,
          entryStatus,
          declineMessage: entryStatus === 2 ? 'Fixture reason' : null,
        }),
        methods: { ...component.methods, $t: translate },
        render(h) {
          return h('v-app', [render.render.call(this, h)])
        },
      })
      const html = await require('vue-server-renderer')
        .createRenderer()
        .renderToString(instance)
      assert.equal((html.match(/<select/g) || []).length, 28)
      assert.equal(
        (html.match(/<select[^>]*disabled="disabled"/g) || []).length,
        [1, 3, null].includes(entryStatus) ? 28 : 0
      )
      assert.equal(
        html.includes(translate('dtrApp.dtrPage.sendForApproval')),
        [0, 2].includes(entryStatus)
      )
      assert.equal(
        html.includes(translate('dtrApp.dtrPage.reload')),
        entryStatus === null
      )
      if (entryStatus === 2)
        assert.ok(html.includes(translate('dtrApp.dtrPage.declineMessage')))
      assert.ok(
        html.includes(
          locale === 'ar' ? 'v-application--is-rtl' : 'v-application--is-ltr'
        )
      )
      instance.$destroy()
    }
  }
})

test('workflow confirmations, decline labels, reload and success feedback have English and Arabic translations', () => {
  const keys = [
    'dtrPage.reload',
    'dtrPage.confirmSubmit',
    'dtrPage.declineMessage',
    'dtrPage.successApproval',
    'dtrPage.successDecline',
    'approvalPage.confirmApprove',
    'approvalPage.confirmDecline',
    'approvalPage.approve',
    'approvalPage.decline',
  ]
  const messages = ['en', 'ar'].map(
    (locale) =>
      JSON.parse(
        fs.readFileSync(path.join(root, 'locales/' + locale + '.json'), 'utf8')
      ).dtrApp
  )
  for (const key of keys) {
    const translations = messages.map((message) =>
      key.split('.').reduce((value, part) => value[part], message)
    )
    assert.ok(
      translations.every((value) => typeof value === 'string' && value.length)
    )
    assert.notEqual(translations[0], translations[1], key)
  }
  const approvals = fs.readFileSync(
    path.join(root, 'pages/dtr/approvals/index.vue'),
    'utf8'
  )
  assert.doesNotMatch(approvals, /bCards\.confirmationMessage/)
  assert.match(approvals, /approvalPage\.confirmApprove/)
  assert.match(approvals, /approvalPage\.confirmDecline/)
})
