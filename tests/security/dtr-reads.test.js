const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const express = require('express')
const babel = require('@babel/core')
const compiler = require('vue-template-compiler')
const createApi = require('../../server/dtr/createApi')
const {
  createDtrReads,
  DtrError,
  parsePeriod,
  validateEmployeeCode,
  assignmentScope,
  DAY_COLUMNS,
  ASSIGNMENTS_QUERY,
  SCOPE_LIST_QUERIES,
  SCOPE_EMPLOYEE_QUERIES,
  PERIOD_ENTRIES_QUERY,
  ENTRY_QUERY,
  PENDING_APPROVALS_QUERY,
} = require('../../server/dtr/services/dtrReads')
const {
  EMPLOYEE_SCOPES,
  EMPLOYEE_QUERIES,
  LEVELS,
} = require('../../server/administration/services/dtrSetup')
const {
  createRoleChecks,
  requireRole,
  ROLE_QUERIES,
} = require('../../server/shared/roles')
const { createAuth } = require('../../server/login/services/auth')
const { createSessions } = require('../../server/login/services/session')

const root = path.resolve(__dirname, '../..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

// Callers. Everyone but NON_MEMBER is in dbo.dtr_users.
const ADM_DIV = 'A100'
const ADM_DEP = 'A200'
const ADM_PRJ = 'A300'
const ADM_SUB = 'A400'
const ADM_MIX = 'A500'
const ADM_NONE = 'A600'
const ADM_BAD = 'A700'
const MGR1 = 'M100'
const MGR2 = 'M200'
const NON_MEMBER = 'N100'
const LONG_CODE = 'LONGCODE123456'
const CALLERS = {
  division: ADM_DIV,
  department: ADM_DEP,
  project: ADM_PRJ,
  subProject: ADM_SUB,
  mixed: ADM_MIX,
  none: ADM_NONE,
  bad: ADM_BAD,
  manager: MGR1,
  manager2: MGR2,
  nonMember: NON_MEMBER,
  longCode: LONG_CODE,
}

// 31, 28, 29 (leap year) and 30 day periods; WINTER crosses the year.
const WINTER = { start: '2025-12-21', end: '2026-01-20' }
const SHORT = { start: '2026-02-21', end: '2026-03-20' }
const LEAP = { start: '2024-02-21', end: '2024-03-20' }
const SPRING = { start: '2026-04-21', end: '2026-05-20' }

const U = 'undefined'

function codeRow(branch, type, code, major, section, division) {
  return {
    branch_code: branch,
    system_code_type: type,
    system_code: code,
    major_code: major,
    section_code: section,
    division_code: division,
  }
}

function employee(code, branch, department, section, division, unit, extra) {
  return {
    employee_code: code,
    branch_code: branch,
    department,
    section,
    Division: division,
    Unit: unit,
    employee_name_eng: `Employee ${code}`,
    employee_name_a: `موظف ${code}`,
    employee_picture: `${code}.jpg`,
    Manager_Code: MGR1,
    Email: `${code.toLowerCase()}@example.invalid`,
    salary: 'private',
    nationality: 'private',
    active: true,
    ...extra,
  }
}

function assignment(
  id,
  employeeCode,
  branch,
  division,
  department,
  project,
  sub
) {
  return {
    id,
    employeeCode,
    adminName: 'private',
    adminEmail: 'private',
    isDTRAdmin: 0,
    isApprover: 0,
    branchName: branch,
    divisionCode: division,
    departmentCode: department === undefined ? U : department,
    projectCode: project === undefined ? U : project,
    subProjectCode: sub === undefined ? U : sub,
  }
}

let nextEntryId = 1
function entry(employeeCode, period, status, manager, extra = {}) {
  const row = {
    id: nextEntryId++,
    EmployeeCode: employeeCode,
    employeeName: `Employee ${employeeCode}`,
    employeePicture: `${employeeCode}.jpg`,
    ManagerCode: manager,
    StartDate: period.start,
    EndDate: period.end,
    ModifiedDate: 'private',
    ModifiedBy: 'private',
    ApprovalStatus: status,
    DeclineMessage: null,
    DeclineFlag: null,
  }
  const days = parsePeriod(period.start, period.end).days
  for (const day of DAY_COLUMNS) row[day] = days.includes(day) ? 'RA' : null
  return { ...row, ...extra }
}

const sameCode = (left, right) =>
  String(left).trimEnd().toUpperCase() === String(right).trimEnd().toUpperCase()

// Mocked mssql. Each fixed statement is interpreted over in-memory HR and
// portal data with the rules the browser used to apply; every call is
// recorded with its typed inputs and the configuration of its pool.
function databaseFixture() {
  const portalConfig = { name: 'portal' }
  const hrConfig = { name: 'hr' }
  const calls = []
  const pools = []
  const state = {
    failAt: null,
    members: [
      ADM_DIV,
      ADM_DEP,
      ADM_PRJ,
      ADM_SUB,
      ADM_MIX,
      ADM_NONE,
      ADM_BAD,
      MGR1,
      MGR2,
      LONG_CODE,
    ],
    assignments: [
      assignment(1, ADM_DIV, 'BR1', '1'),
      assignment(2, ADM_DEP, 'BR1', '1', '10'),
      assignment(3, ADM_PRJ, 'BR1', '1', '10', '100'),
      assignment(4, ADM_SUB, 'BR1', '1', '10', '100', '01'),
      // Overlapping and repeated scopes, in two branches.
      assignment(5, ADM_MIX, 'BR1', '2'),
      assignment(6, ADM_MIX, 'BR1', '1', '10'),
      assignment(7, ADM_MIX, 'BR1', '1', '10', '100'),
      assignment(8, ADM_MIX, 'BR1', '1', '10'),
      assignment(9, ADM_MIX, 'BR2', '1'),
      // Patterns the old page could not resolve to any employee.
      assignment(10, ADM_BAD, 'BR1', '1', undefined, '100'),
      assignment(11, ADM_BAD, 'BR1', '1', undefined, undefined, '01'),
      assignment(12, ADM_BAD, 'BR1', '1', '10', undefined, '01'),
      assignment(13, ADM_BAD, U, '1'),
      assignment(14, ADM_BAD, 'BR1', ''),
      assignment(15, ADM_BAD, 'BR1', '1', 'Undefined'),
      assignment(16, ADM_BAD, 'A-BRANCH-NAME-LONGER-THAN-HR', '1'),
      assignment(17, ADM_BAD, 'BR1', null),
      // Holds an assignment and approvals but is not a DTR member.
      assignment(18, NON_MEMBER, 'BR1', '1'),
    ],
    codes: [
      // BR1 and BR2 deliberately share every code.
      ...['BR1', 'BR2'].flatMap((branch) => [
        codeRow(branch, '41', '1', '0', null, null),
        codeRow(branch, '42', '10', '1', null, null),
        codeRow(branch, '71', '100', '1', '10', ''),
        codeRow(branch, '72', '01', '1', '10', '100'),
      ]),
      codeRow('BR1', '41', '2', '0', null, null),
      codeRow('BR1', '42', '11', '1', null, null),
      codeRow('BR1', '71', '101', '1', '11', ''),
      codeRow('BR1', '72', '02', '1', '10', '100'),
    ],
    employees: [
      employee('E1', 'BR1', '1', '10', '100', '01'),
      employee('E2', 'BR1', '1', '10', '100', ''),
      employee('E3', 'BR1', '1', '10', '100', '01', { active: false }),
      employee('E4', 'BR2', '1', '10', '100', '01', { Manager_Code: MGR2 }),
      employee('E5', 'BR1', '1', '', '', ''),
      employee('E6', 'BR1', '1', '11', '101', ''),
      employee('E7', 'BR1', '1', '10', '100', '02'),
      employee('E8', 'BR1', '2', '', '', ''),
      // Project code of department 10 but another section: listed by the
      // department rule, not by the project rule (existing behavior).
      employee('E9', 'BR1', '1', '99', '100', '01'),
    ],
    entries: [
      entry('E1', WINTER, 0, MGR1, { 25: 'AB', 3: 'UP<20' }),
      entry('E2', WINTER, 1, MGR1, { 1: 'SV' }),
      entry('E7', WINTER, 2, MGR1, {
        DeclineFlag: true,
        DeclineMessage: 'Fix day 3',
      }),
      entry('E5', WINTER, 3, MGR2),
      entry('E4', WINTER, 1, MGR2),
      entry('E8', WINTER, 1, MGR1),
      // Pending entry of an employee who is inactive now.
      entry('E3', WINTER, 1, MGR1),
      // A stale value in a column the 28-day period does not have.
      entry('E1', SHORT, 1, MGR1, { 30: 'AB', 28: 'AV' }),
      entry('E1', LEAP, 0, MGR1, { 29: 'HA' }),
      entry('E2', SPRING, 1, MGR2),
      entry('E1', SPRING, 1, NON_MEMBER),
    ],
    legacy: new Map(),
  }

  const active = () => state.employees.filter((row) => row.active)
  const typed = (type, v, match) =>
    state.codes.filter(
      (row) =>
        row.system_code_type === type &&
        row.branch_code === v.branch &&
        match(row)
    )

  // The loops of the old DTR table page, one per assignment level.
  const legacyScope = {
    division: (v) =>
      active().filter(
        (row) => row.branch_code === v.branch && row.department === v.division
      ),
    department: (v) => {
      const projects = typed(
        '71',
        v,
        (row) =>
          row.major_code === v.division && row.section_code === v.department
      )
      return active().filter((row) =>
        projects.some(
          (project) =>
            row.branch_code === v.branch &&
            row.department === project.major_code &&
            row.Division === project.system_code
        )
      )
    },
    project: (v) => {
      const subProjects = typed(
        '72',
        v,
        (row) =>
          row.major_code === v.division &&
          row.section_code === v.department &&
          row.division_code === v.project
      )
      return active().filter((row) =>
        subProjects.some(
          (sub) =>
            row.branch_code === v.branch &&
            row.department === sub.major_code &&
            row.Division === sub.division_code &&
            row.section === sub.section_code &&
            row.Unit === sub.system_code
        )
      )
    },
    'sub-project': (v) =>
      active().filter(
        (row) =>
          row.branch_code === v.branch &&
          row.department === v.division &&
          row.Division === v.project &&
          row.section === v.department &&
          row.Unit === v.subProject
      ),
  }

  const inPeriod = (row, v) =>
    row.StartDate === v.periodStart && row.EndDate === v.periodEnd
  const byCode = (left, right) =>
    left.employee_code.localeCompare(right.employee_code)

  const handlers = new Map()
  const names = new Map()
  function register(name, statement, handler) {
    handlers.set(statement, handler)
    names.set(statement, name)
  }
  register('role', ROLE_QUERIES.get('dtrUser'), (v) => [
    { hasRole: state.members.includes(v.employeeCode) },
  ])
  register('assignments', ASSIGNMENTS_QUERY, (v) =>
    state.assignments
      .filter((row) => sameCode(row.employeeCode, v.employeeCode))
      .sort((left, right) => left.id - right.id)
  )
  for (const level of LEVELS.keys()) {
    register(`list:${level}`, SCOPE_LIST_QUERIES.get(level), (v) =>
      legacyScope[level](v).sort(byCode)
    )
    register(`one:${level}`, SCOPE_EMPLOYEE_QUERIES.get(level), (v) =>
      legacyScope[level](v).filter((row) =>
        sameCode(row.employee_code, v.employeeCode)
      )
    )
    // The Phase 5 list, for comparing both services on the same data.
    register(`setup:${level}`, EMPLOYEE_QUERIES.get(level), (v) =>
      legacyScope[level](v)
    )
  }
  register('periodEntries', PERIOD_ENTRIES_QUERY, (v) =>
    state.entries.filter((row) => inPeriod(row, v))
  )
  register('entry', ENTRY_QUERY, (v) =>
    state.entries
      .filter(
        (row) => inPeriod(row, v) && sameCode(row.EmployeeCode, v.employeeCode)
      )
      .slice(0, 1)
  )
  register('pending', PENDING_APPROVALS_QUERY, (v) =>
    state.entries
      .filter(
        (row) =>
          inPeriod(row, v) &&
          row.ApprovalStatus === 1 &&
          sameCode(row.ManagerCode, v.managerCode)
      )
      .sort((left, right) => left.id - right.id)
  )

  class ConnectionPool {
    constructor(config) {
      this.config = config
      this.closed = false
      pools.push(this)
    }

    // eslint-disable-next-line require-await
    async connect() {
      if (
        state.failAt === 'connect' ||
        state.failAt === `connect:${this.config.name}`
      )
        throw new Error('private connection detail')
    }

    // eslint-disable-next-line require-await
    async close() {
      this.closed = true
    }

    request() {
      const pool = this
      const inputs = {}
      return {
        input(name, type, value) {
          // The legacy gateway binds untyped values: input(name, value).
          inputs[name] =
            arguments.length === 2
              ? { type: null, value: type }
              : { type, value }
          return this
        },
        async query(statement) {
          const name = names.get(statement) || 'legacy'
          calls.push({ name, statement, inputs, config: pool.config.name })
          await new Promise((resolve) => setImmediate(resolve))
          if (state.failAt === statement || state.failAt === name)
            throw new Error('private SQL detail: dtr.secret_table')
          const values = Object.fromEntries(
            Object.entries(inputs).map(([key, input]) => [key, input.value])
          )
          if (state.legacy.has(statement))
            return state.legacy.get(statement)(values)
          const handler = handlers.get(statement)
          if (!handler) throw new Error('statement is not server-owned')
          const recordset = handler(values)
          return { recordset, recordsets: [recordset] }
        },
      }
    }
  }

  const sql = {
    ConnectionPool,
    VarChar: (length) => ({ name: 'varchar', length }),
    NVarChar: (length) => ({ name: 'nvarchar', length }),
  }
  return {
    calls,
    pools,
    state,
    sql,
    portalConfig,
    hrConfig,
    names: () => calls.map((call) => call.name),
    roles: createRoleChecks({ sql, portalConfig }),
    dtrReads: createDtrReads({ sql, portalConfig, hrConfig }),
  }
}

async function httpFixture(t) {
  const f = databaseFixture()
  const sessions = createSessions('dtr-reads-tests-only-key')
  const tokens = {}
  for (const [name, employeeCode] of Object.entries(CALLERS))
    tokens[name] = sessions.issue({
      employeeCode,
      userAccount: name.toLowerCase(),
      domain: 'alkholi',
    })
  const revoked = new Set()
  const auth = createAuth({
    sessions,
    repository: {
      isRegistered: async (identity) => !revoked.has(identity.token),
    },
    adAuth: async () => {},
    cipher: {},
  })
  // Stands in for the untouched legacy save router.
  const saves = []
  const legacyActions = express.Router()
  legacyActions.post('/save-dtr-data', (req, res) => {
    saves.push({ caller: req.auth && req.auth.employeeCode, body: req.body })
    res.send([1])
  })
  const app = express()
  app.use(
    '/dtr-api',
    createApi({
      authorize: auth.authorize,
      requireDtrUser: requireRole(f.roles, 'dtrUser'),
      dtrReads: f.dtrReads,
      legacySql: { sql: f.sql, portalConfig: f.portalConfig },
      legacyActions,
    })
  )
  // Anything the API does not answer would reach the page renderer.
  app.use((req, res) => res.status(418).send('<html>nuxt</html>'))
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
  const base = `http://127.0.0.1:${server.address().port}/dtr-api`
  async function request(
    suffix,
    { as = 'division', method, body, headers } = {}
  ) {
    const allHeaders = { ...(headers || {}) }
    if (as) allHeaders.Authorization = `Bearer ${tokens[as] || as}`
    if (body !== undefined) allHeaders['Content-Type'] = 'application/json'
    const response = await fetch(base + suffix, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: allHeaders,
      body:
        body === undefined
          ? undefined
          : typeof body === 'string'
          ? body
          : JSON.stringify(body),
    })
    const text = await response.text()
    let parsed = text
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {}
    return {
      status: response.status,
      body: parsed,
      cacheControl: response.headers.get('cache-control'),
    }
  }
  const get = (suffix, query, options) =>
    request(
      query ? `${suffix}?${new URLSearchParams(query).toString()}` : suffix,
      options
    )
  return {
    ...f,
    request,
    get,
    tokens,
    saves,
    revoke: (token) => revoked.add(token),
  }
}

const codesOf = (rows, key = 'employee_code') => rows.map((row) => row[key])
const NOT_FOUND = [404, { message: 'employeeNotFound' }]
const outcome = (response) => [response.status, response.body]

// What each assignment level resolved to on the old page, for this fixture.
const EXPECTED_SCOPE = {
  division: ['E1', 'E2', 'E5', 'E6', 'E7', 'E9'],
  department: ['E1', 'E2', 'E7', 'E9'],
  project: ['E1', 'E7'],
  subProject: ['E1'],
}

test('statements are fixed, typed and reuse the DTR setup hierarchy rules', () => {
  assert.deepEqual(
    [...SCOPE_LIST_QUERIES.keys()],
    ['division', 'department', 'project', 'sub-project']
  )
  assert.deepEqual([...SCOPE_EMPLOYEE_QUERIES.keys()], [...LEVELS.keys()])
  for (const [level, scope] of EMPLOYEE_SCOPES) {
    // The exact FROM/WHERE text of the Phase 5 employee lists. Both lists ask
    // for a fresh plan: a cached one timed out on large HR departments.
    assert.ok(
      EMPLOYEE_QUERIES.get(level).endsWith(`${scope}\n  OPTION (RECOMPILE)`),
      level
    )
    for (const statement of [
      SCOPE_LIST_QUERIES.get(level),
      SCOPE_EMPLOYEE_QUERIES.get(level),
    ]) {
      assert.ok(statement.includes(scope), level)
      assert.match(
        statement,
        /B\.stop_val_flag = 0 AND A\.branch_code = @branch/
      )
      assert.match(statement, /A\.department = @division/)
      assert.doesNotMatch(statement, /SELECT \*|MenaITech|Email|\$\{/)
    }
    assert.match(
      SCOPE_EMPLOYEE_QUERIES.get(level),
      /AND A\.employee_code = @employeeCode$/
    )
    assert.doesNotMatch(SCOPE_EMPLOYEE_QUERIES.get(level), /OPTION/)
    assert.match(
      SCOPE_LIST_QUERIES.get(level),
      /ORDER BY A\.employee_code\s+OPTION \(RECOMPILE\)$/
    )
    assert.doesNotMatch(SCOPE_LIST_QUERIES.get(level), /Manager_Code/)
  }
  assert.match(
    ASSIGNMENTS_QUERY,
    /FROM dtr\.adminAssignment\s+WHERE employeeCode = @employeeCode\s+ORDER BY id$/
  )
  const period =
    /StartDate = CONVERT\(date, @periodStart, 23\)\s+AND EndDate = CONVERT\(date, @periodEnd, 23\)/
  for (const statement of [
    PERIOD_ENTRIES_QUERY,
    ENTRY_QUERY,
    PENDING_APPROVALS_QUERY,
  ]) {
    assert.match(statement, /FROM dtr\.dtrEntries/)
    assert.match(statement, period)
    assert.doesNotMatch(statement, /SELECT \*|alkholiPortal|\$\{|ModifiedBy/)
  }
  assert.match(ENTRY_QUERY, /WHERE EmployeeCode = @employeeCode AND StartDate/)
  assert.match(
    PENDING_APPROVALS_QUERY,
    /WHERE ManagerCode = @managerCode AND ApprovalStatus = 1\s+AND StartDate/
  )
  assert.match(PENDING_APPROVALS_QUERY, /ORDER BY id$/)
  // Period order of the stored day columns: 21..31 then 1..20.
  assert.deepEqual(
    [...DAY_COLUMNS],
    [
      ...Array.from({ length: 11 }, (_, index) => 21 + index),
      ...Array.from({ length: 20 }, (_, index) => 1 + index),
    ]
  )
  const columns = DAY_COLUMNS.map((day) => `[${day}]`).join(', ')
  assert.ok(ENTRY_QUERY.includes(columns))
  assert.ok(PENDING_APPROVALS_QUERY.includes(columns))

  // The service never sees a request object, and every statement handed to
  // mssql is a module constant or a lookup keyed by a server-derived level.
  const service = read('server/dtr/services/dtrReads.js')
  assert.doesNotMatch(service, /\breq\b|\.body|process\.env|\.execute\(/)
  const statements = [...service.matchAll(/\.query\(\s*([^)\s]+)/g)].map(
    (match) => match[1]
  )
  assert.equal(statements.length, 6)
  for (const argument of statements)
    assert.match(
      argument,
      /^(?:[A-Z_]+|SCOPE_(?:LIST|EMPLOYEE)_QUERIES\.get\(scope\.level)$/,
      argument
    )
  // Every route takes the caller from the verified session.
  const router = read('server/dtr/router/dtrReads.js')
  assert.equal((router.match(/router\.get\(/g) || []).length, 5)
  assert.equal((router.match(/\.\.\.memberOnly,/g) || []).length, 5)
  assert.equal(
    (router.match(/dtrReads\.\w+\(\s*req\.auth\.employeeCode/g) || []).length,
    5
  )
  assert.doesNotMatch(router, /req\.body|router\.(post|put|patch|delete)\(/)
})

test('periods are the 21st to the 20th of the next month, with 28 to 31 days', () => {
  const lengths = {}
  for (const year of [2024, 2025, 2026])
    for (let month = 1; month <= 12; month++) {
      const start = `${year}-${String(month).padStart(2, '0')}-21`
      const endMonth = month === 12 ? 1 : month + 1
      const endYear = month === 12 ? year + 1 : year
      const end = `${endYear}-${String(endMonth).padStart(2, '0')}-20`
      const period = parsePeriod(start, end)
      assert.equal(period.start, start)
      assert.equal(period.end, end)
      assert.equal(period.days[0], 21)
      assert.equal(period.days.at(-1), 20)
      assert.equal(new Set(period.days).size, period.days.length)
      // The days are exactly the calendar days from start to end.
      const expected = []
      for (
        const day = new Date(Date.UTC(year, month - 1, 21));
        day <= new Date(Date.UTC(endYear, endMonth - 1, 20));
        day.setUTCDate(day.getUTCDate() + 1)
      )
        expected.push(day.getUTCDate())
      assert.deepEqual(period.days, expected, start)
      lengths[start] = period.days.length
    }
  assert.equal(lengths['2024-02-21'], 29)
  assert.equal(lengths['2025-02-21'], 28)
  assert.equal(lengths['2026-02-21'], 28)
  assert.equal(lengths['2026-04-21'], 30)
  assert.equal(lengths['2025-12-21'], 31)
  assert.deepEqual(
    parsePeriod('2026-02-21', '2026-03-20').days.slice(0, 9),
    [21, 22, 23, 24, 25, 26, 27, 28, 1]
  )
  assert.deepEqual(
    parsePeriod('2024-02-21', '2024-03-20').days.slice(7, 10),
    [28, 29, 1]
  )

  for (const [start, end] of [
    ['2026-01-20', '2026-02-20'],
    ['2026-01-21', '2026-02-21'],
    ['2026-01-21', '2026-01-20'],
    ['2026-01-21', '2026-03-20'],
    ['2026-01-21', '2027-02-20'],
    // The year bug of the old pages: a December start with the end year.
    ['2026-12-21', '2026-01-20'],
    ['2025-12-21', '2025-01-20'],
    // The old unpadded month text.
    ['2026-09-21', '2026-010-20'],
    ['2026-010-21', '2026-011-20'],
    ['2026-13-21', '2027-01-20'],
    ['2026-00-21', '2026-01-20'],
    ['1999-12-21', '2000-01-20'],
    ['2101-01-21', '2101-02-20'],
    ['21-01-2026', '20-02-2026'],
    ['2026-1-21', '2026-2-20'],
    ['2026-01-21T00:00:00Z', '2026-02-20'],
    [' 2026-01-21', '2026-02-20'],
    ["2026-01-21' OR 1=1 --", '2026-02-20'],
    ['2026-01-21', undefined],
    [undefined, '2026-02-20'],
    [['2026-01-21', '2026-01-21'], '2026-02-20'],
    [20260121, 20260220],
    [null, null],
    [{}, {}],
  ])
    assert.throws(
      () => parsePeriod(start, end),
      (error) =>
        error instanceof DtrError &&
        error.message === 'invalidPeriod' &&
        error.statusCode === 400,
      `${start} ${end}`
    )
})

test('stored assignments resolve to one level or to nothing, never wider', () => {
  const stored = (department, project, sub, branch = 'BR1', division = '1') =>
    assignmentScope(
      assignment(1, 'X', branch, division, department, project, sub)
    )
  assert.deepEqual(stored(), {
    level: 'division',
    path: { branch: 'BR1', division: '1' },
  })
  assert.deepEqual(stored('10'), {
    level: 'department',
    path: { branch: 'BR1', division: '1', department: '10' },
  })
  assert.deepEqual(stored('10', '100'), {
    level: 'project',
    path: { branch: 'BR1', division: '1', department: '10', project: '100' },
  })
  assert.deepEqual(stored('10', '100', '01'), {
    level: 'sub-project',
    path: {
      branch: 'BR1',
      division: '1',
      department: '10',
      project: '100',
      subProject: '01',
    },
  })
  // Stored codes are data, not identifiers: unusual characters stay usable.
  assert.deepEqual(stored('A B', "O'1"), {
    level: 'project',
    path: { branch: 'BR1', division: '1', department: 'A B', project: "O'1" },
  })

  for (const row of [
    assignment(1, 'X', 'BR1', '1', undefined, '100'),
    assignment(1, 'X', 'BR1', '1', undefined, undefined, '01'),
    assignment(1, 'X', 'BR1', '1', '10', undefined, '01'),
    assignment(1, 'X', 'BR1', '1', undefined, '100', '01'),
    assignment(1, 'X', U, '1'),
    assignment(1, 'X', 'BR1', U),
    assignment(1, 'X', 'BR1', ''),
    assignment(1, 'X', 'BR1', '   '),
    assignment(1, 'X', '', '1'),
    assignment(1, 'X', 'BR1', '1', 'Undefined'),
    assignment(1, 'X', 'BR1', '1', 'UNDEFINED', '100'),
    assignment(1, 'X', 'BR1', '12345678901'),
    assignment(1, 'X', 'ELEVEN-CHAR', '1'),
    assignment(1, 'X', 'BR1', null),
    assignment(1, 'X', 'BR1', 1),
    { ...assignment(1, 'X', 'BR1', '1'), departmentCode: null },
    { ...assignment(1, 'X', 'BR1', '1'), subProjectCode: undefined },
    { branchName: 'BR1', divisionCode: '1' },
    null,
    undefined,
    'BR1',
  ])
    assert.equal(assignmentScope(row), null, JSON.stringify(row))

  for (const value of [
    '',
    'E1 ',
    "E1'",
    'E1;--',
    '12345678901',
    U,
    'UNDEFINED',
    'E1/..',
    'موظف',
    1,
    null,
    undefined,
    ['E1'],
    { code: 'E1' },
  ])
    assert.throws(
      () => validateEmployeeCode(value),
      (error) =>
        error instanceof DtrError &&
        error.message === 'invalidEmployeeCode' &&
        error.statusCode === 400,
      String(value)
    )
  for (const value of ['E1', '00123', 'a-b_c', '1234567890'])
    assert.equal(validateEmployeeCode(value), value)
})

test('assigned employees match the old page at every assignment level', async (t) => {
  const f = await httpFixture(t)
  const setup = require('../../server/administration/services/dtrSetup')
  const dtrSetup = setup.createDtrSetup({
    sql: f.sql,
    portalConfig: f.portalConfig,
    hrConfig: f.hrConfig,
    getEmployeeInfo: async () => {
      throw new Error('not used')
    },
  })
  const paths = {
    division: ['division', { branch: 'BR1', division: '1' }],
    department: [
      'department',
      { branch: 'BR1', division: '1', department: '10' },
    ],
    project: [
      'project',
      { branch: 'BR1', division: '1', department: '10', project: '100' },
    ],
    subProject: [
      'sub-project',
      {
        branch: 'BR1',
        division: '1',
        department: '10',
        project: '100',
        subProject: '01',
      },
    ],
  }
  for (const [as, expected] of Object.entries(EXPECTED_SCOPE)) {
    f.calls.length = 0
    const response = await f.get('/assigned-employees', undefined, { as })
    assert.equal(response.status, 200, as)
    assert.equal(response.cacheControl, 'no-store')
    assert.deepEqual(codesOf(response.body), expected, as)
    // Only the fields the table renders; no HR private columns.
    for (const row of response.body)
      assert.deepEqual(Object.keys(row), [
        'employee_code',
        'employee_name_eng',
        'employee_name_a',
        'employee_picture',
      ])
    assert.deepEqual(response.body[0], {
      employee_code: 'E1',
      employee_name_eng: 'Employee E1',
      employee_name_a: 'موظف E1',
      employee_picture: 'E1.jpg',
    })
    const [level, levelPath] = paths[as]
    assert.deepEqual(f.names(), ['role', 'assignments', `list:${level}`])
    // The caller is the session employee; the path comes from the stored row.
    assert.deepEqual(f.calls[1].inputs, {
      employeeCode: {
        type: { name: 'varchar', length: 10 },
        value: CALLERS[as],
      },
    })
    assert.equal(f.calls[1].config, 'portal')
    assert.equal(f.calls[2].config, 'hr')
    assert.deepEqual(
      f.calls[2].inputs,
      Object.fromEntries(
        Object.entries(levelPath).map(([field, value]) => [
          field,
          { type: { name: 'varchar', length: 10 }, value },
        ])
      )
    )
    // Same employees as the DTR setup list of that path (Phase 5).
    assert.deepEqual(
      codesOf(await dtrSetup.listEmployees(level, levelPath)).sort(),
      [...expected].sort(),
      level
    )
  }

  // Inactive employees and equal codes of another branch stay out.
  const division = (await f.get('/assigned-employees')).body
  assert.ok(!codesOf(division).includes('E3'))
  assert.ok(!codesOf(division).includes('E4'))
  assert.ok(!codesOf(division).includes('E8'))
  // An employee leaves the list as soon as HR marks them inactive.
  f.state.employees.find((row) => row.employee_code === 'E5').active = false
  assert.ok(!codesOf((await f.get('/assigned-employees')).body).includes('E5'))
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('overlapping assignments list each employee once; empty scope stays empty', async (t) => {
  const f = await httpFixture(t)
  const mixed = await f.get('/assigned-employees', undefined, { as: 'mixed' })
  assert.equal(mixed.status, 200)
  // Division BR1/2, department BR1/1/10 (twice), project BR1/1/10/100 and
  // division BR2/1: first-seen order, nobody repeated, nobody dropped.
  assert.deepEqual(codesOf(mixed.body), ['E8', 'E1', 'E2', 'E7', 'E9', 'E4'])
  // The repeated department row is resolved once.
  assert.deepEqual(f.names(), [
    'role',
    'assignments',
    'list:division',
    'list:department',
    'list:project',
    'list:division',
  ])
  assert.deepEqual(
    f.calls
      .filter((call) => call.name === 'list:division')
      .map((call) => [call.inputs.branch.value, call.inputs.division.value]),
    [
      ['BR1', '2'],
      ['BR2', '1'],
    ]
  )

  for (const as of ['none', 'bad', 'manager', 'longCode']) {
    f.calls.length = 0
    const response = await f.get('/assigned-employees', undefined, { as })
    assert.deepEqual(outcome(response), [200, []], as)
    // No HR statement runs for an empty scope, so nothing can widen it.
    assert.ok(
      f.calls.every((call) => call.config === 'portal'),
      as
    )
    const entries = await f.get('/period-entries', WINTER, { as })
    assert.deepEqual(outcome(entries), [200, []], as)
    assert.ok(!f.names().includes('periodEntries'), as)
  }
  // A caller code that cannot be stored in the assignment table is not bound.
  f.calls.length = 0
  await f.get('/assigned-employees', undefined, { as: 'longCode' })
  assert.deepEqual(f.names(), ['role'])

  // Removing the assignment empties the list on the next request.
  f.state.assignments = f.state.assignments.filter(
    (row) => row.employeeCode !== ADM_DIV
  )
  assert.deepEqual(outcome(await f.get('/assigned-employees')), [200, []])
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('period entries cover assigned employees only, for the requested period', async (t) => {
  const f = await httpFixture(t)
  const winter = await f.get('/period-entries', WINTER)
  assert.equal(winter.status, 200)
  assert.equal(winter.cacheControl, 'no-store')
  // E4 (other branch), E8 (other division) and inactive E3 also have entries.
  assert.deepEqual(
    winter.body.sort((left, right) =>
      left.EmployeeCode.localeCompare(right.EmployeeCode)
    ),
    [
      { EmployeeCode: 'E1', ApprovalStatus: 0, DeclineFlag: false },
      { EmployeeCode: 'E2', ApprovalStatus: 1, DeclineFlag: false },
      { EmployeeCode: 'E5', ApprovalStatus: 3, DeclineFlag: false },
      { EmployeeCode: 'E7', ApprovalStatus: 2, DeclineFlag: true },
    ]
  )
  assert.deepEqual(f.names(), [
    'role',
    'assignments',
    'list:division',
    'periodEntries',
  ])
  assert.deepEqual(f.calls[3].inputs, {
    periodStart: { type: { name: 'varchar', length: 10 }, value: WINTER.start },
    periodEnd: { type: { name: 'varchar', length: 10 }, value: WINTER.end },
  })

  // Each level sees its own employees' entries.
  for (const [as, expected] of [
    ['department', ['E1', 'E2', 'E7']],
    ['project', ['E1', 'E7']],
    ['subProject', ['E1']],
    ['mixed', ['E1', 'E2', 'E4', 'E7', 'E8']],
  ])
    assert.deepEqual(
      codesOf(
        (await f.get('/period-entries', WINTER, { as })).body,
        'EmployeeCode'
      ).sort(),
      expected,
      as
    )

  // Other periods are separate; a period without entries is empty.
  assert.deepEqual((await f.get('/period-entries', SHORT)).body, [
    { EmployeeCode: 'E1', ApprovalStatus: 1, DeclineFlag: false },
  ])
  assert.deepEqual(
    (await f.get('/period-entries', { start: '2026-06-21', end: '2026-07-20' }))
      .body,
    []
  )

  // One employee: assigned ones answer, with the HR spelling of the code.
  f.calls.length = 0
  assert.deepEqual(
    outcome(await f.get('/period-entries', { ...WINTER, employeeCode: 'e7' })),
    [200, [{ EmployeeCode: 'E7', ApprovalStatus: 2, DeclineFlag: true }]]
  )
  assert.deepEqual(f.names(), ['role', 'assignments', 'one:division', 'entry'])
  assert.deepEqual(f.calls[2].inputs.employeeCode, {
    type: { name: 'varchar', length: 10 },
    value: 'e7',
  })
  assert.deepEqual(
    outcome(await f.get('/period-entries', { ...WINTER, employeeCode: 'E6' })),
    [200, []]
  )

  // A guessed, unknown, inactive or other-branch code is refused alike, and
  // no entry is read for it.
  for (const [as, employeeCode] of [
    ['division', 'E8'],
    ['division', 'E4'],
    ['division', 'E3'],
    ['division', 'NOPE'],
    ['subProject', 'E2'],
    ['project', 'E9'],
    ['none', 'E1'],
    ['bad', 'E1'],
    ['manager', 'E2'],
    ['longCode', 'E1'],
  ]) {
    f.calls.length = 0
    const response = await f.get(
      '/period-entries',
      { ...WINTER, employeeCode },
      { as }
    )
    assert.deepEqual(outcome(response), NOT_FOUND, `${as} ${employeeCode}`)
    assert.ok(!f.names().includes('entry'), `${as} ${employeeCode}`)
    assert.ok(!f.names().includes('periodEntries'))
  }
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('calendar details need an assignment or a pending approval', async (t) => {
  const f = await httpFixture(t)
  const calendar = (employeeCode, period, as) =>
    f.get(`/employees/${employeeCode}/calendar`, period, { as })

  const draft = await calendar('E1', WINTER, 'division')
  assert.equal(draft.status, 200)
  assert.equal(draft.cacheControl, 'no-store')
  assert.deepEqual(Object.keys(draft.body), ['EmployeeCode', 'entry'])
  assert.equal(draft.body.EmployeeCode, 'E1')
  assert.deepEqual(Object.keys(draft.body.entry), [
    'ApprovalStatus',
    'DeclineFlag',
    'DeclineMessage',
    'days',
  ])
  assert.equal(draft.body.entry.ApprovalStatus, 0)
  assert.equal(draft.body.entry.DeclineMessage, null)
  // 31 days: 21 December to 20 January.
  assert.equal(Object.keys(draft.body.entry.days).length, 31)
  assert.equal(draft.body.entry.days[25], 'AB')
  assert.equal(draft.body.entry.days[3], 'UP<20')
  assert.equal(draft.body.entry.days[31], 'RA')
  // Nothing about the manager, the editor or other columns leaves the server.
  assert.doesNotMatch(JSON.stringify(draft.body), /M100|private|Modified|id"/)

  const declined = await calendar('E7', WINTER, 'project')
  assert.deepEqual(
    [
      declined.body.entry.ApprovalStatus,
      declined.body.entry.DeclineFlag,
      declined.body.entry.DeclineMessage,
    ],
    [2, true, 'Fix day 3']
  )

  // Every assignment level reads its employee through its own scope statement.
  for (const [as, level] of [
    ['division', 'division'],
    ['department', 'department'],
    ['project', 'project'],
    ['subProject', 'sub-project'],
  ]) {
    f.calls.length = 0
    const response = await calendar('E1', WINTER, as)
    assert.equal(response.status, 200, as)
    assert.equal(response.body.entry.days[25], 'AB')
    assert.deepEqual(f.names(), [
      'role',
      'entry',
      'assignments',
      `one:${level}`,
    ])
    assert.equal(
      (await f.get('/employees/E1', undefined, { as })).body.Manager_Code,
      MGR1
    )
  }

  // Short months and leap years return exactly the days of the period.
  const short = await calendar('E1', SHORT, 'division')
  assert.deepEqual(Object.keys(short.body.entry.days).map(Number), [
    ...Array.from({ length: 20 }, (_, i) => i + 1),
    21,
    22,
    23,
    24,
    25,
    26,
    27,
    28,
  ])
  assert.equal(short.body.entry.days[28], 'AV')
  // The stale value stored under day 30 is not part of a 28-day period.
  assert.doesNotMatch(JSON.stringify(short.body), /"30"|"29"|"31"/)
  const leap = await calendar('E1', LEAP, 'division')
  assert.equal(Object.keys(leap.body.entry.days).length, 29)
  assert.equal(leap.body.entry.days[29], 'HA')
  const spring = await calendar('E2', SPRING, 'division')
  assert.equal(Object.keys(spring.body.entry.days).length, 30)
  assert.equal(spring.body.entry.days[31], undefined)

  // An assigned employee without a saved entry.
  f.calls.length = 0
  assert.deepEqual(outcome(await calendar('e6', WINTER, 'division')), [
    200,
    { EmployeeCode: 'E6', entry: null },
  ])
  assert.deepEqual(f.names(), ['role', 'entry', 'assignments', 'one:division'])
  assert.deepEqual(f.calls[1].inputs, {
    employeeCode: { type: { name: 'varchar', length: 10 }, value: 'e6' },
    periodStart: { type: { name: 'varchar', length: 10 }, value: WINTER.start },
    periodEnd: { type: { name: 'varchar', length: 10 }, value: WINTER.end },
  })

  // The recorded manager of a pending entry may read it without assignment,
  // including for an employee who is inactive now.
  f.calls.length = 0
  const pending = await calendar('E2', WINTER, 'manager')
  assert.equal(pending.status, 200)
  assert.equal(pending.body.entry.ApprovalStatus, 1)
  assert.equal(pending.body.entry.days[1], 'SV')
  assert.deepEqual(f.names(), ['role', 'entry'])
  assert.equal((await calendar('E3', WINTER, 'manager')).status, 200)
  assert.equal((await calendar('E4', WINTER, 'manager2')).status, 200)

  // Not pending, another manager's, another period, no entry, or unknown:
  // one answer for all, whether or not an entry exists.
  for (const [employeeCode, period, as] of [
    ['E1', WINTER, 'manager'], // draft
    ['E7', WINTER, 'manager'], // declined
    ['E5', WINTER, 'manager2'], // approved
    ['E4', WINTER, 'manager'], // pending for the other manager
    ['E2', WINTER, 'manager2'],
    ['E2', SHORT, 'manager'], // no entry in that period
    ['E6', WINTER, 'manager'],
    ['NOPE', WINTER, 'manager'],
    ['E8', WINTER, 'division'], // outside the assigned division
    ['E4', WINTER, 'division'], // same codes, other branch
    ['E3', WINTER, 'division'], // inactive
    ['E2', WINTER, 'subProject'],
    ['E1', WINTER, 'none'],
    ['E1', WINTER, 'bad'],
    ['E1', WINTER, 'longCode'],
  ])
    assert.deepEqual(
      outcome(await calendar(employeeCode, period, as)),
      NOT_FOUND,
      `${employeeCode} ${period.start} ${as}`
    )

  // Once approved or declined the manager loses access; the assignee keeps it.
  f.state.entries.find(
    (row) => row.EmployeeCode === 'E2' && row.StartDate === WINTER.start
  ).ApprovalStatus = 3
  assert.deepEqual(outcome(await calendar('E2', WINTER, 'manager')), NOT_FOUND)
  assert.equal((await calendar('E2', WINTER, 'division')).status, 200)
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('employee details are limited to assigned employees', async (t) => {
  const f = await httpFixture(t)
  const details = await f.get('/employees/E1')
  assert.deepEqual(outcome(details), [
    200,
    {
      employee_code: 'E1',
      employee_name_eng: 'Employee E1',
      employee_picture: 'E1.jpg',
      Manager_Code: MGR1,
    },
  ])
  assert.equal(details.cacheControl, 'no-store')
  assert.deepEqual(f.names(), ['role', 'assignments', 'one:division'])
  // The second matching scope is used when the first does not contain the code.
  f.calls.length = 0
  assert.equal(
    (await f.get('/employees/E4', undefined, { as: 'mixed' })).body
      .Manager_Code,
    MGR2
  )
  assert.deepEqual(f.names(), [
    'role',
    'assignments',
    'one:division',
    'one:department',
    'one:project',
    'one:division',
  ])

  for (const [employeeCode, as] of [
    ['E8', 'division'],
    ['E4', 'division'],
    ['E3', 'division'],
    ['NOPE', 'division'],
    ['E2', 'subProject'],
    ['E1', 'none'],
    ['E1', 'bad'],
    // Approving an entry does not expose the employee's HR details.
    ['E2', 'manager'],
    ['E5', 'mixed'],
  ])
    assert.deepEqual(
      outcome(await f.get(`/employees/${employeeCode}`, undefined, { as })),
      NOT_FOUND,
      `${employeeCode} ${as}`
    )

  // Two HR rows for one code cannot be resolved: fail closed.
  f.state.employees.push(employee('E1', 'BR1', '1', '10', '100', '01'))
  assert.deepEqual(outcome(await f.get('/employees/E1')), [
    503,
    { message: 'serviceUnavailable' },
  ])
  // The list still shows that code once.
  assert.deepEqual(
    codesOf((await f.get('/assigned-employees')).body).filter(
      (code) => code === 'E1'
    ),
    ['E1']
  )
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('pending approvals belong to the signed-in manager and the requested period', async (t) => {
  const f = await httpFixture(t)
  const queue = await f.get('/pending-approvals', WINTER, { as: 'manager' })
  assert.equal(queue.status, 200)
  assert.equal(queue.cacheControl, 'no-store')
  // E1 is a draft, E7 declined, E4/E5 belong to the other manager.
  assert.deepEqual(codesOf(queue.body, 'EmployeeCode'), ['E2', 'E8', 'E3'])
  for (const row of queue.body) {
    assert.deepEqual(Object.keys(row), [
      'EmployeeCode',
      'employeeName',
      'employeePicture',
      'ApprovalStatus',
      'days',
    ])
    assert.equal(row.ApprovalStatus, 1)
    assert.equal(Object.keys(row.days).length, 31)
  }
  assert.deepEqual(
    [queue.body[0].employeeName, queue.body[0].employeePicture],
    ['Employee E2', 'E2.jpg']
  )
  assert.equal(queue.body[0].days[1], 'SV')
  assert.deepEqual(f.names(), ['role', 'pending'])
  assert.deepEqual(f.calls[1].inputs, {
    managerCode: { type: { name: 'nvarchar', length: 10 }, value: MGR1 },
    periodStart: { type: { name: 'varchar', length: 10 }, value: WINTER.start },
    periodEnd: { type: { name: 'varchar', length: 10 }, value: WINTER.end },
  })

  assert.deepEqual(
    codesOf(
      (await f.get('/pending-approvals', WINTER, { as: 'manager2' })).body,
      'EmployeeCode'
    ),
    ['E4']
  )
  const short = await f.get('/pending-approvals', SHORT, { as: 'manager' })
  assert.deepEqual(codesOf(short.body, 'EmployeeCode'), ['E1'])
  assert.equal(Object.keys(short.body[0].days).length, 28)
  assert.deepEqual(
    codesOf(
      (await f.get('/pending-approvals', SPRING, { as: 'manager2' })).body,
      'EmployeeCode'
    ),
    ['E2']
  )
  // An assignment does not make someone an approver.
  for (const as of ['division', 'mixed', 'none', 'longCode'])
    assert.deepEqual(
      outcome(await f.get('/pending-approvals', WINTER, { as })),
      [200, []],
      as
    )

  // A caller-selected manager, in any part of the request, is never used.
  for (const name of [
    'managerCode',
    'ManagerCode',
    'manager',
    'employeeCode',
  ]) {
    f.calls.length = 0
    const response = await f.get(
      '/pending-approvals',
      { ...WINTER, [name]: MGR1 },
      { as: 'manager2', headers: { 'X-Manager-Code': MGR1 } }
    )
    assert.deepEqual(codesOf(response.body, 'EmployeeCode'), ['E4'], name)
    assert.equal(f.calls[1].inputs.managerCode.value, MGR2)
  }
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('changing manager, employee or path parameters cannot widen access', async (t) => {
  const f = await httpFixture(t)
  const spoof = {
    employeeCode: ADM_DIV,
    adminCode: ADM_DIV,
    managerCode: MGR1,
    branch: 'BR1',
    branchName: 'BR1',
    division: '1',
    divisionCode: '1',
    department: '10',
    level: 'division',
    query: 'SELECT * FROM dtr.dtrEntries',
  }
  // The sub-project administrator claims a division and another identity.
  f.calls.length = 0
  const list = await f.get('/assigned-employees', spoof, {
    as: 'subProject',
    headers: { 'X-Employee-Code': ADM_DIV },
  })
  assert.deepEqual(codesOf(list.body), ['E1'])
  assert.equal(f.calls[1].inputs.employeeCode.value, ADM_SUB)
  assert.deepEqual(f.names(), ['role', 'assignments', 'list:sub-project'])

  // Without assignments the same parameters produce nothing.
  assert.deepEqual(
    outcome(await f.get('/assigned-employees', spoof, { as: 'none' })),
    [200, []]
  )
  const { employeeCode, ...withoutEmployee } = spoof
  assert.deepEqual(
    outcome(
      await f.get(
        '/period-entries',
        { ...WINTER, ...withoutEmployee },
        { as: 'none' }
      )
    ),
    [200, []]
  )
  assert.deepEqual(
    codesOf(
      (
        await f.get(
          '/period-entries',
          { ...WINTER, ...withoutEmployee },
          { as: 'subProject' }
        )
      ).body,
      'EmployeeCode'
    ),
    ['E1']
  )
  assert.equal(employeeCode, ADM_DIV)

  // Repeated or structured values are rejected, not reinterpreted.
  for (const suffix of [
    `/period-entries?start=${WINTER.start}&end=${WINTER.end}&employeeCode=E1&employeeCode=E8`,
    `/period-entries?start=${WINTER.start}&end=${WINTER.end}&employeeCode[]=E8`,
    `/period-entries?start=${WINTER.start}&end=${WINTER.end}&employeeCode[code]=E8`,
    `/period-entries?start=${WINTER.start}&end=${WINTER.end}&employeeCode=`,
  ]) {
    const response = await f.request(suffix, { as: 'subProject' })
    assert.deepEqual(
      outcome(response),
      [400, { message: 'invalidEmployeeCode' }],
      suffix
    )
  }
  for (const suffix of [
    `/period-entries?start=${WINTER.start}&start=${SHORT.start}&end=${WINTER.end}`,
    `/pending-approvals?start[]=${WINTER.start}&end=${WINTER.end}`,
    `/employees/E1/calendar?start=${WINTER.start}&end[x]=${WINTER.end}`,
  ])
    assert.deepEqual(
      outcome(await f.request(suffix)),
      [400, { message: 'invalidPeriod' }],
      suffix
    )

  // Read routes answer GET only; a body cannot stand in for the session.
  for (const suffix of [
    '/assigned-employees',
    '/period-entries',
    '/pending-approvals',
    '/employees/E8',
    '/employees/E8/calendar',
  ])
    for (const method of ['POST', 'PUT', 'DELETE'])
      assert.deepEqual(
        outcome(
          await f.request(suffix, {
            method,
            body: method === 'DELETE' ? undefined : { ...spoof, ...WINTER },
          })
        ),
        [404, { message: 'notFound' }],
        `${method} ${suffix}`
      )
})

const READ_ROUTES = [
  '/assigned-employees',
  `/period-entries?start=${WINTER.start}&end=${WINTER.end}`,
  `/period-entries?start=${WINTER.start}&end=${WINTER.end}&employeeCode=E1`,
  `/pending-approvals?start=${WINTER.start}&end=${WINTER.end}`,
  '/employees/E1',
  `/employees/E1/calendar?start=${WINTER.start}&end=${WINTER.end}`,
]

test('sessions and DTR membership are required on every read route', async (t) => {
  const f = await httpFixture(t)
  for (const suffix of READ_ROUTES) {
    // Missing, malformed and tampered sessions stop before any SQL.
    for (const as of [
      null,
      'not-a-token',
      `${f.tokens.division.slice(0, -2)}xx`,
    ]) {
      f.calls.length = 0
      const response = await f.request(suffix, { as })
      assert.deepEqual(
        outcome(response),
        [401, { message: 'authFailed' }],
        `${suffix} ${as}`
      )
      assert.equal(f.calls.length, 0)
    }
    // An employee with an assignment and approvals but no DTR membership.
    f.calls.length = 0
    const forbidden = await f.request(suffix, { as: 'nonMember' })
    assert.deepEqual(
      outcome(forbidden),
      [403, { message: 'forbidden' }],
      suffix
    )
    assert.deepEqual(f.names(), ['role'])
    assert.equal(f.calls[0].inputs.employeeCode.value, NON_MEMBER)
    // Members are answered.
    assert.equal((await f.request(suffix)).status, 200, suffix)
  }

  // Membership is evaluated on every request.
  f.state.members = f.state.members.filter((code) => code !== ADM_DIV)
  for (const suffix of READ_ROUTES)
    assert.equal((await f.request(suffix)).status, 403, suffix)
  f.state.members.push(ADM_DIV)
  assert.equal((await f.request(READ_ROUTES[0])).status, 200)

  // A revoked session is refused before the role check.
  f.revoke(f.tokens.division)
  for (const suffix of READ_ROUTES) {
    f.calls.length = 0
    assert.deepEqual(outcome(await f.request(suffix)), [
      401,
      { message: 'authFailed' },
    ])
    assert.equal(f.calls.length, 0)
  }
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('invalid periods, codes and SQL failures get controlled responses', async (t) => {
  const f = await httpFixture(t)
  const periodRoutes = [
    '/period-entries',
    '/pending-approvals',
    '/employees/E1/calendar',
  ]
  for (const suffix of periodRoutes)
    for (const period of [
      {},
      { start: WINTER.start },
      { end: WINTER.end },
      { start: '2026-12-21', end: '2026-01-20' },
      { start: '2026-09-21', end: '2026-010-20' },
      { start: '21-12-2025', end: '20-01-2026' },
      { start: '2026-01-20', end: '2026-02-19' },
      { start: "2026-01-21' OR '1'='1", end: '2026-02-20' },
      { start: '2026-02-30', end: '2026-03-20' },
    ]) {
      f.calls.length = 0
      const response = await f.get(suffix, period)
      assert.deepEqual(
        outcome(response),
        [400, { message: 'invalidPeriod' }],
        `${suffix} ${JSON.stringify(period)}`
      )
      // Only the membership check ran.
      assert.deepEqual(f.names(), ['role'])
    }

  for (const code of [
    'E1%27',
    'E1%3B--',
    '12345678901',
    'undefined',
    'E%201',
  ]) {
    for (const suffix of [
      `/employees/${code}`,
      `/employees/${code}/calendar?start=${WINTER.start}&end=${WINTER.end}`,
      `/period-entries?start=${WINTER.start}&end=${WINTER.end}&employeeCode=${code}`,
    ]) {
      f.calls.length = 0
      assert.deepEqual(
        outcome(await f.request(suffix)),
        [400, { message: 'invalidEmployeeCode' }],
        suffix
      )
      assert.deepEqual(f.names(), ['role'])
    }
  }
  // Malformed percent-encoding and unknown routes: JSON, never the renderer.
  assert.deepEqual(outcome(await f.request('/employees/%E0%A4%A/calendar')), [
    400,
    { message: 'invalidRequest' },
  ])
  for (const suffix of [
    '/does-not-exist',
    '/employees',
    '/employees/E1/calendar/extra',
    '/assigned-employees/E1',
  ])
    assert.deepEqual(outcome(await f.request(suffix)), [
      404,
      { message: 'notFound' },
    ])

  // Every statement and both connections: 503 with no database text.
  const failures = [
    ['/assigned-employees', ['assignments', 'list:division', 'connect:hr']],
    [
      `/period-entries?start=${WINTER.start}&end=${WINTER.end}`,
      ['assignments', 'list:division', 'periodEntries', 'connect:hr'],
    ],
    [
      `/period-entries?start=${WINTER.start}&end=${WINTER.end}&employeeCode=E1`,
      ['assignments', 'one:division', 'entry', 'connect:hr'],
    ],
    ['/employees/E1', ['assignments', 'one:division', 'connect:hr']],
    [
      `/employees/E1/calendar?start=${WINTER.start}&end=${WINTER.end}`,
      ['entry', 'assignments', 'one:division', 'connect:hr'],
    ],
  ]
  for (const [suffix, points] of failures)
    for (const failAt of [...points, 'connect', 'role']) {
      f.state.failAt = failAt
      const response = await f.request(suffix)
      assert.deepEqual(
        outcome(response),
        [503, { message: 'serviceUnavailable' }],
        `${suffix} ${failAt}`
      )
      assert.doesNotMatch(JSON.stringify(response.body), /private|secret|dtr\./)
    }
  for (const failAt of ['pending', 'connect', 'role']) {
    f.state.failAt = failAt
    assert.deepEqual(
      outcome(await f.get('/pending-approvals', WINTER, { as: 'manager' })),
      [503, { message: 'serviceUnavailable' }],
      failAt
    )
  }
  f.state.failAt = null
  assert.equal((await f.request('/assigned-employees')).status, 200)
  // Pools are closed after failures too.
  assert.ok(f.pools.length > 40)
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('retired DTR SQL endpoints return 404 and execute nothing', async (t) => {
  const f = await httpFixture(t)
  for (const suffix of [
    '/sql-call',
    '/sql-call/',
    '/SQL-CALL',
    '/hr-sql-call',
    '/hr-sql-call/',
    '/HR-SQL-CALL',
    '/open-sql-call',
    '/employees/sql-call/extra',
  ])
    for (const as of ['division', 'manager', 'nonMember', null])
      for (const options of [
        { body: { query: 'SELECT 1' } },
        { body: { query: 'SELECT 1', parameters: {} } },
        { body: {} },
        { method: 'GET' },
        { method: 'PUT', body: { query: 'SELECT 1' } },
        { method: 'DELETE' },
      ]) {
        const response = await f.request(suffix, { ...options, as })
        assert.deepEqual(
          outcome(response),
          [404, { message: 'notFound' }],
          `${options.method || 'POST'} ${suffix} as ${as}`
        )
      }
  // Not even a session or role lookup happened.
  assert.equal(f.calls.length, 0)
  assert.equal(f.pools.length, 0)

  // The module no longer has a gateway to the HR database at all.
  const legacy = read('server/dtr/router/sqlCalls.js')
  assert.deepEqual(
    [...legacy.matchAll(/router\.(\w+)\(\s*'([^']+)'/g)].map((match) => [
      match[1],
      match[2],
    ]),
    [['post', '/sql-params-call']]
  )
  assert.doesNotMatch(legacy, /hrSQL|hrConfig|hrDB|require\('mssql'\)/)
  const main = read('server/dtr/main.js')
  assert.match(main, /legacySql: \{ sql, portalConfig \}/)
  assert.match(
    main,
    /requireRole\(\s*createRoleChecks\(\{ sql, portalConfig \}\),\s*'dtrUser'\s*\)/
  )
  const api = read('server/dtr/createApi.js')
  assert.doesNotMatch(api + main, /sql-call'|hr-sql-call/)
})

test('legacy write routes kept for Phase 8 still work, now for DTR members only', async (t) => {
  const f = await httpFixture(t)
  // The exact request the DTR table sends for "send for approval".
  const statement = `
                UPDATE [dtr].[dtrEntries]
                SET [ApprovalStatus] = @approvalStatus
                WHERE [EmployeeCode] IN ('E1','E2')
                AND [StartDate] = @startDate
                AND [EndDate] = @endDate
              `
  const parameters = {
    approvalStatus: 1,
    startDate: WINTER.start,
    endDate: WINTER.end,
  }
  const executed = []
  f.state.legacy.set(statement, (values) => {
    executed.push(values)
    return { recordset: undefined, rowsAffected: [2] }
  })
  const body = { query: statement, parameters }

  for (const as of [null, 'not-a-token']) {
    assert.equal(
      (await f.request('/sql-params-call', { body, as })).status,
      401
    )
    assert.equal(
      (await f.request('/save-dtr-data', { body: { employeeCode: 'E1' }, as }))
        .status,
      401
    )
  }
  assert.equal(f.calls.length, 0)
  assert.deepEqual(
    outcome(await f.request('/sql-params-call', { body, as: 'nonMember' })),
    [403, { message: 'forbidden' }]
  )
  assert.deepEqual(
    outcome(
      await f.request('/save-dtr-data', {
        body: { employeeCode: 'E1' },
        as: 'nonMember',
      })
    ),
    [403, { message: 'forbidden' }]
  )
  assert.deepEqual(executed, [])
  assert.deepEqual(f.saves, [])
  assert.deepEqual(f.names(), ['role', 'role'])

  // Members: both legacy callers behave as before.
  const sent = await f.request('/sql-params-call', { body })
  assert.equal(sent.status, 200)
  assert.deepEqual(executed, [parameters])
  const saved = await f.request('/save-dtr-data', {
    body: { employeeCode: 'E1', dtrEntries: [] },
  })
  assert.deepEqual(outcome(saved), [200, [1]])
  assert.deepEqual(f.saves, [
    { caller: ADM_DIV, body: { employeeCode: 'E1', dtrEntries: [] } },
  ])
  // The approvals page writes through the same gateway as a manager.
  assert.equal(
    (await f.request('/sql-params-call', { body, as: 'manager' })).status,
    200
  )
  assert.ok(f.pools.every((pool) => pool.closed))

  // The real save router is still the one mounted in production, unchanged.
  assert.match(
    read('server/dtr/main.js'),
    /const dtrActions = require\('\.\/router\/dtr-actions\.js'\)[\s\S]+legacyActions: dtrActions/
  )
  assert.match(
    read('server/dtr/router/dtr-actions.js'),
    /router\.post\('\/save-dtr-data', auth, async \(req, res\) => \{/
  )
  const api = read('server/dtr/createApi.js')
  assert.match(api, /api\.post\('\/save-dtr-data', \.\.\.memberOnly\)/)
  assert.ok(
    api.indexOf("api.post('/save-dtr-data', ...memberOnly)") <
      api.indexOf('api.use(legacyActions)')
  )
})

// Frontend: run the real helper, store and component scripts with mocks.
function transform(source) {
  return babel.transformSync(source, {
    configFile: false,
    babelrc: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code
}

function loadModule(relative, source, globals = {}) {
  const filename = path.resolve(root, relative)
  const module = { exports: {} }
  vm.runInNewContext(transform(source || fs.readFileSync(filename, 'utf8')), {
    module,
    exports: module.exports,
    require: (specifier) =>
      specifier.startsWith('~/')
        ? loadModule(`${specifier.slice(2)}.js`, undefined, globals)
        : require(specifier),
    ...globals,
  })
  return module.exports
}

function loadComponent(relative, globals) {
  const script = compiler.parseComponent(read(relative)).script.content
  return loadModule(relative, script, globals).default
}

const plain = (value) => JSON.parse(JSON.stringify(value))

function rejection(status, message) {
  const error = new Error('Request failed')
  error.response = { status, data: { message } }
  return error
}

const pad = (value) => String(value).padStart(2, '0')

test('period helper keeps the 21st-to-20th sequence across months and years', () => {
  const { periodStartingIn, periodContaining, shiftPeriod, periodParts } =
    loadModule('utils/dtr-period.js')

  for (const year of [2024, 2025, 2026])
    for (let month = 1; month <= 12; month++) {
      const endMonth = month === 12 ? 1 : month + 1
      const endYear = month === 12 ? year + 1 : year
      const expected = {
        start: `21-${pad(month)}-${year}`,
        end: `20-${pad(endMonth)}-${endYear}`,
      }
      assert.deepEqual(plain(periodStartingIn(year, month)), expected)
      // Every day of the period maps back to it, whatever the month length.
      const first = Date.UTC(year, month - 1, 21)
      const last = Date.UTC(endYear, endMonth - 1, 20)
      for (let time = first; time <= last; time += 24 * 60 * 60 * 1000) {
        const day = new Date(time)
        assert.deepEqual(
          plain(
            periodContaining(
              day.getUTCFullYear(),
              day.getUTCMonth() + 1,
              day.getUTCDate()
            )
          ),
          expected,
          day.toISOString()
        )
      }
      // The server accepts exactly what the helper produces.
      const iso = (text) => text.split('-').reverse().join('-')
      assert.ok(parsePeriod(iso(expected.start), iso(expected.end)))
      assert.deepEqual(plain(periodParts(expected.start, expected.end)), {
        startMonth: month,
        startYear: year,
        endMonth,
        endYear,
      })
    }

  // The months the old page wrote as 010 and 011.
  assert.deepEqual(plain(periodContaining(2026, 10, 1)), {
    start: '21-09-2026',
    end: '20-10-2026',
  })
  assert.deepEqual(plain(periodContaining(2026, 10, 21)), {
    start: '21-10-2026',
    end: '20-11-2026',
  })
  assert.deepEqual(plain(periodContaining(2026, 11, 30)), {
    start: '21-11-2026',
    end: '20-12-2026',
  })
  assert.deepEqual(plain(periodContaining(2026, 1, 20)), {
    start: '21-12-2025',
    end: '20-01-2026',
  })
  assert.deepEqual(plain(periodContaining(2026, 12, 31)), {
    start: '21-12-2026',
    end: '20-01-2027',
  })
  assert.deepEqual(plain(periodContaining(2024, 2, 29)), {
    start: '21-02-2024',
    end: '20-03-2024',
  })

  // Previous/next: the twelve cases of the old switch statements.
  for (let month = 1; month <= 12; month++) {
    const start = `21-${pad(month)}-2026`
    const before = month === 1 ? [12, 2025] : [month - 1, 2026]
    const after = month === 12 ? [1, 2027] : [month + 1, 2026]
    assert.deepEqual(
      plain(shiftPeriod(start, -1)),
      plain(periodStartingIn(before[1], before[0])),
      `prev ${start}`
    )
    assert.deepEqual(
      plain(shiftPeriod(start, 1)),
      plain(periodStartingIn(after[1], after[0])),
      `next ${start}`
    )
  }
  let start = '21-11-2024'
  const visited = []
  for (let step = 0; step < 30; step++) {
    const period = shiftPeriod(start, 1)
    assert.match(period.start, /^21-(0[1-9]|1[0-2])-\d{4}$/)
    assert.match(period.end, /^20-(0[1-9]|1[0-2])-\d{4}$/)
    visited.push(period.start)
    start = period.start
  }
  assert.equal(new Set(visited).size, 30)
  assert.equal(start, '21-05-2027')
  for (let step = 0; step < 30; step++) start = shiftPeriod(start, -1).start
  assert.equal(start, '21-11-2024')
})

function storeRuntime(axios) {
  const en = JSON.parse(read('locales/en.json'))
  const lookup = (key) =>
    key.split('.').reduce((value, part) => value && value[part], en)
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

test('the DTR store reads through the fixed endpoints without SQL or identities', async () => {
  const en = JSON.parse(read('locales/en.json')).errorMessages
  const store = loadModule('store/dtr/index.js')
  const requests = []
  const notifications = []
  let data = [{ row: 1 }]
  const runtime = storeRuntime({
    get: async (url, config) => {
      requests.push({
        url,
        config: config === undefined ? null : plain(config),
      })
      return { status: 200, data }
    },
    post: async () => {
      throw new Error('reads must not post')
    },
  })
  const context = {
    commit: () => {},
    dispatch: async (name, value) => notifications.push(value),
  }
  const call = (action, payload) =>
    store.actions[action].call(runtime, context, payload)
  const base = 'https://portal.invalid/dtr-api'
  const period = { start: WINTER.start, end: WINTER.end }

  assert.deepEqual(plain(await call('getAssignedEmployees')), [{ row: 1 }])
  assert.deepEqual(plain(await call('getPeriodEntries', period)), [{ row: 1 }])
  assert.deepEqual(
    plain(await call('getPeriodEntries', { ...period, employeeCode: 'E1' })),
    [{ row: 1 }]
  )
  assert.deepEqual(plain(await call('getPendingApprovals', period)), [
    { row: 1 },
  ])
  data = { EmployeeCode: 'E1', entry: null }
  assert.deepEqual(
    plain(await call('getCalendar', { ...period, employeeCode: 'E/1' })),
    data
  )
  data = { employee_code: 'E1', Manager_Code: MGR1 }
  assert.deepEqual(plain(await call('getEmployee', 'E 1')), data)
  assert.deepEqual(requests, [
    { url: `${base}/assigned-employees`, config: null },
    { url: `${base}/period-entries`, config: { params: period } },
    {
      url: `${base}/period-entries`,
      config: { params: { ...period, employeeCode: 'E1' } },
    },
    { url: `${base}/pending-approvals`, config: { params: period } },
    { url: `${base}/employees/E%2F1/calendar`, config: { params: period } },
    { url: `${base}/employees/E%201`, config: null },
  ])
  assert.doesNotMatch(
    JSON.stringify(requests),
    /select|update|query|manager|admin|undefined/i
  )
  assert.equal(notifications.length, 0)

  // A success body of the wrong shape is never used.
  data = '<html></html>'
  assert.deepEqual(plain(await call('getAssignedEmployees')), [])
  assert.deepEqual(plain(await call('getPeriodEntries', period)), [])
  assert.deepEqual(plain(await call('getPendingApprovals', period)), [])
  assert.equal(
    await call('getCalendar', { ...period, employeeCode: 'E1' }),
    null
  )
  assert.equal(await call('getEmployee', 'E1'), null)
  data = [{ row: 1 }]
  assert.equal(
    await call('getCalendar', { ...period, employeeCode: 'E1' }),
    null
  )
  assert.equal(await call('getEmployee', 'E1'), null)
  assert.equal(notifications.length, 0)

  // Failures: translated message, safe value, no thrown error.
  const cases = [
    ['getAssignedEmployees', undefined, []],
    ['getPeriodEntries', period, null],
    ['getPendingApprovals', period, []],
    ['getCalendar', { ...period, employeeCode: 'E1' }, null],
    ['getEmployee', 'E1', null],
  ]
  for (const code of [
    'forbidden',
    'authFailed',
    'invalidPeriod',
    'invalidEmployeeCode',
    'employeeNotFound',
    'invalidRequest',
    'serviceUnavailable',
  ]) {
    runtime.$axios.get = async () => {
      throw rejection(400, code)
    }
    for (const [action, payload, fallback] of cases) {
      assert.deepEqual(plain(await call(action, payload)), fallback)
      assert.deepEqual(plain(notifications.at(-1)), {
        type: 'error',
        message: en.dtr[code],
      })
    }
  }
  // Network errors and unknown codes never show raw text.
  for (const error of [
    new Error('Network Error'),
    rejection(500, 'Invalid column name secret'),
  ]) {
    runtime.$axios.get = async () => {
      throw error
    }
    for (const [action, payload, fallback] of cases) {
      assert.deepEqual(plain(await call(action, payload)), fallback)
      assert.equal(notifications.at(-1).message, en.login.serviceUnavailable)
    }
  }
})

const TABLE_PAGE = 'pages/dtr/dtr-table/index.vue'
const APPROVALS_PAGE = 'pages/dtr/approvals/index.vue'
const CALENDAR = 'components/dtr/dtr-table/employeeCalendar.vue'

function pageContext(component, overrides = {}) {
  const dispatched = []
  const routes = []
  const posts = []
  const events = []
  const context = {
    ...component.data.call({}),
    ...component.methods,
    dtrAppStartDate: undefined,
    dtrAppEndDate: undefined,
    results: {},
    $t: (key) => key,
    $config: { baseURL: '' },
    $emit: (...args) => events.push(args),
    localePath: (route) => `/ar${route === '/' ? '' : route}`,
    $router: { push: (route) => routes.push(route) },
    $axios: {
      post: async (url, body) => {
        posts.push({ url, body: plain(body) })
        return context.postResult
      },
    },
    $store: {
      dispatch: async (name, payload) => {
        dispatched.push(payload === undefined ? [name] : [name, plain(payload)])
        const result = context.results[name]
        return typeof result === 'function' ? result(payload) : result
      },
    },
    ...overrides,
  }
  return { context, dispatched, routes, posts, events }
}

test('the DTR table lists and statuses come from the store, for the chosen period', async () => {
  const component = loadComponent(TABLE_PAGE)
  assert.equal(component.layout, 'dtr')
  const employees = ['E1', 'E2', 'E5', 'E6', 'E7'].map((code) => ({
    employee_code: code,
    employee_name_eng: `Employee ${code}`,
    employee_picture: `${code}.jpg`,
  }))
  const entries = [
    { EmployeeCode: 'E1', ApprovalStatus: 0, DeclineFlag: false },
    { EmployeeCode: 'E2', ApprovalStatus: 1, DeclineFlag: false },
    { EmployeeCode: 'E5', ApprovalStatus: 3, DeclineFlag: false },
    { EmployeeCode: 'E7', ApprovalStatus: 2, DeclineFlag: true },
  ]
  const { context, dispatched, posts } = pageContext(component, {
    startDate: '21-12-2025',
    endDate: '20-01-2026',
  })
  context.results = {
    'dtr/getAssignedEmployees': () => plain(employees),
    'dtr/getPeriodEntries': () => plain(entries),
  }
  await component.methods.getAssignedEmployees.call(context)
  assert.deepEqual(dispatched, [
    ['dtr/getAssignedEmployees'],
    ['dtr/getPeriodEntries', { start: '2025-12-21', end: '2026-01-20' }],
  ])
  assert.deepEqual(
    plain(context.allEmployeesData).map((row) => [
      row.employee_code,
      row.statusColor,
      row.statusName,
      row.declineFlag,
    ]),
    [
      ['E1', 'yellow', 'Ready to be sent for approval', false],
      ['E2', 'orange', 'Waiting for manager approval', false],
      ['E5', 'green', 'Approved', false],
      ['E6', 'pink', 'No changes yet!', undefined],
      ['E7', 'red', 'Declined - Needs Review', true],
    ]
  )
  assert.equal(context.disableSendForApprovalBTN, true)
  assert.equal(context.overlay, false)
  assert.deepEqual(posts, [])

  // All drafts: the send button is enabled.
  context.results['dtr/getPeriodEntries'] = () =>
    employees.map((row) => ({
      EmployeeCode: row.employee_code,
      ApprovalStatus: 0,
      DeclineFlag: false,
    }))
  await component.methods.getAssignedEmployees.call(context)
  assert.equal(context.disableSendForApprovalBTN, false)

  // One employee after a save: only that code is requested and updated.
  dispatched.length = 0
  context.panel = 2
  context.results['dtr/getPeriodEntries'] = () => [
    { EmployeeCode: 'E2', ApprovalStatus: 1, DeclineFlag: false },
  ]
  await component.methods.getSingleRecordStatus.call(context, 'E2')
  assert.deepEqual(dispatched, [
    [
      'dtr/getPeriodEntries',
      { start: '2025-12-21', end: '2026-01-20', employeeCode: 'E2' },
    ],
  ])
  assert.equal(
    context.allEmployeesData.find((row) => row.employee_code === 'E2')
      .statusColor,
    'orange'
  )
  assert.equal(context.panel, -1)
  assert.equal(context.disableSendForApprovalBTN, true)
  dispatched.length = 0
  await component.methods.closePanel.call(context, { employee_code: 'E1' })
  assert.equal(dispatched[0][1].employeeCode, 'E1')

  // Statuses that cannot be loaded leave the shown data untouched.
  const before = plain(context.allEmployeesData)
  context.panel = 1
  context.results['dtr/getPeriodEntries'] = () => null
  await component.methods.getSingleRecordStatus.call(context, 'E2')
  await component.methods.getRecordsStatus.call(context, plain(employees))
  assert.deepEqual(plain(context.allEmployeesData), before)
  assert.equal(context.panel, 1)

  // No assignment: an empty table, no entries request, nothing to send.
  const empty = pageContext(component, {
    startDate: '21-12-2025',
    endDate: '20-01-2026',
  })
  empty.context.results = { 'dtr/getAssignedEmployees': () => [] }
  await component.methods.getAssignedEmployees.call(empty.context)
  assert.deepEqual(empty.dispatched, [['dtr/getAssignedEmployees']])
  assert.deepEqual(plain(empty.context.allEmployeesData), [])
  assert.equal(empty.context.disableSendForApprovalBTN, true)
  assert.equal(empty.context.overlay, false)
})

test('the DTR table builds valid periods for every month and restores the stored one', async () => {
  function at(iso) {
    class FixedDate extends Date {
      constructor(...args) {
        super(...(args.length ? args : [iso]))
      }
    }
    return loadComponent(TABLE_PAGE, { Date: FixedDate })
  }
  for (const [now, start, end, parts] of [
    [
      '2026-10-01T09:00:00.000Z',
      '21-09-2026',
      '20-10-2026',
      [9, 2026, 10, 2026],
    ],
    [
      '2026-10-20T23:59:59.000Z',
      '21-09-2026',
      '20-10-2026',
      [9, 2026, 10, 2026],
    ],
    [
      '2026-10-21T00:00:00.000Z',
      '21-10-2026',
      '20-11-2026',
      [10, 2026, 11, 2026],
    ],
    [
      '2026-11-15T12:00:00.000Z',
      '21-10-2026',
      '20-11-2026',
      [10, 2026, 11, 2026],
    ],
    [
      '2026-11-21T12:00:00.000Z',
      '21-11-2026',
      '20-12-2026',
      [11, 2026, 12, 2026],
    ],
    [
      '2026-12-25T12:00:00.000Z',
      '21-12-2026',
      '20-01-2027',
      [12, 2026, 1, 2027],
    ],
    [
      '2026-01-05T12:00:00.000Z',
      '21-12-2025',
      '20-01-2026',
      [12, 2025, 1, 2026],
    ],
    [
      '2026-01-21T12:00:00.000Z',
      '21-01-2026',
      '20-02-2026',
      [1, 2026, 2, 2026],
    ],
    [
      '2024-02-29T12:00:00.000Z',
      '21-02-2024',
      '20-03-2024',
      [2, 2024, 3, 2024],
    ],
    [
      '2026-09-30T12:00:00.000Z',
      '21-09-2026',
      '20-10-2026',
      [9, 2026, 10, 2026],
    ],
    [
      '2026-08-31T12:00:00.000Z',
      '21-08-2026',
      '20-09-2026',
      [8, 2026, 9, 2026],
    ],
  ]) {
    const component = at(now)
    const { context } = pageContext(component)
    component.methods.getDateRange.call(context)
    assert.deepEqual([context.startDate, context.endDate], [start, end], now)
    assert.deepEqual(
      [
        context.activeStartMonth,
        context.activeStartYear,
        context.activeEndMonth,
        context.activeEndYear,
      ],
      parts,
      now
    )
    // The text sent to the API is a period the server accepts.
    assert.ok(
      parsePeriod(
        component.methods.flipDateString(context.startDate),
        component.methods.flipDateString(context.endDate)
      )
    )
  }

  const component = loadComponent(TABLE_PAGE)
  const { context } = pageContext(component, {
    startDate: '21-11-2025',
    endDate: '20-12-2025',
  })
  component.methods.next.call(context)
  assert.deepEqual(
    [context.startDate, context.endDate],
    ['21-12-2025', '20-01-2026']
  )
  assert.deepEqual(
    [context.activeStartYear, context.activeEndYear],
    [2025, 2026]
  )
  component.methods.next.call(context)
  assert.deepEqual(
    [context.startDate, context.endDate],
    ['21-01-2026', '20-02-2026']
  )
  for (let step = 0; step < 2; step++) component.methods.prev.call(context)
  assert.deepEqual(
    [context.startDate, context.endDate],
    ['21-11-2025', '20-12-2025']
  )
  assert.equal(context.overlay, false)

  // Returning with a stored December period keeps the start year.
  const stored = pageContext(component, {
    dtrAppStartDate: '21-12-2025',
    dtrAppEndDate: '20-01-2026',
  })
  stored.context.results = { 'dtr/getAssignedEmployees': () => [] }
  await component.mounted.call(stored.context)
  assert.deepEqual(
    [
      stored.context.activeStartMonth,
      stored.context.activeStartYear,
      stored.context.activeEndMonth,
      stored.context.activeEndYear,
    ],
    [12, 2025, 1, 2026]
  )
  assert.deepEqual(stored.dispatched, [['dtr/getAssignedEmployees']])

  // The chosen period is stored, then the employees are loaded.
  const chosen = pageContext(component, {
    startDate: '21-02-2026',
    endDate: '20-03-2026',
    dialog: true,
  })
  chosen.context.results = { 'dtr/getAssignedEmployees': () => [] }
  await component.methods.saveStartAndEndDatesInStore.call(chosen.context)
  assert.deepEqual(chosen.dispatched, [
    ['dtr/saveStartAndEndDates', { start: '21-02-2026', end: '20-03-2026' }],
    ['dtr/getAssignedEmployees'],
  ])
  component.methods.goBack.call(chosen.context)
  assert.deepEqual(chosen.routes, ['/ar'])
})

test('the approvals page shows only what the server returns for the signed-in manager', async () => {
  // No localStorage in this context: reading a manager code would throw.
  const component = loadComponent(APPROVALS_PAGE)
  assert.equal(component.layout, 'dtr')
  const { context, dispatched, posts, routes } = pageContext(component, {
    dtrAppStartDate: '21-12-2025',
    dtrAppEndDate: '20-01-2026',
  })
  context.results = {
    'dtr/getPendingApprovals': () => [
      {
        EmployeeCode: 'E2',
        employeeName: 'Employee E2',
        employeePicture: 'E2.jpg',
        ApprovalStatus: 1,
        days: { 21: 'RA', 22: 'AB', 23: null, 24: 'UP<20', 1: 'SV' },
      },
      { EmployeeCode: 'E5', ApprovalStatus: 3, days: {} },
    ],
  }
  await component.mounted.call(context)
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(dispatched, [
    ['dtr/getPendingApprovals', { start: '2025-12-21', end: '2026-01-20' }],
  ])
  assert.deepEqual(
    plain(context.employeesWaitingApproval).map((row) => [
      row.EmployeeCode,
      row.employeeName,
      row.employeePicture,
      row.statusColor,
      row.statusName,
    ]),
    [['E2', 'Employee E2', 'E2.jpg', 'orange', 'Waiting for your approval']]
  )
  assert.deepEqual(posts, [])
  // The calendar spans 21 December 2025 to 20 January 2026.
  const days = context.weeks.flat().filter((day) => !day.empty)
  assert.equal(days.length, 31)
  assert.deepEqual(
    [days[0], days.at(-1)].map((day) => [
      day.date.getFullYear(),
      day.date.getMonth() + 1,
      day.date.getDate(),
    ]),
    [
      [2025, 12, 21],
      [2026, 1, 20],
    ]
  )

  component.methods.setDTRValues.call(
    context,
    context.employeesWaitingApproval[0]
  )
  assert.deepEqual(plain(context.dtrValues), {
    1: 'Sick Vacation',
    21: 'Regular Attendance',
    22: 'Absent',
    23: null,
    24: 'UnPaid Vacation less than 20 days',
  })
  // The entry itself is left as returned.
  assert.equal(context.employeesWaitingApproval[0].days[21], 'RA')

  // A failed list is an empty queue.
  context.results = { 'dtr/getPendingApprovals': () => [] }
  await component.methods.getEmployeesWaitingForApproval.call(context)
  assert.deepEqual(plain(context.employeesWaitingApproval), [])

  // Without a chosen period the page returns to the table, in the locale.
  const fresh = pageContext(component)
  await component.mounted.call(fresh.context)
  assert.deepEqual(fresh.routes, ['/ar/dtr/dtr-table'])
  assert.deepEqual(fresh.dispatched, [])
  assert.deepEqual(routes, [])
})

function calendarContext(component, year, month, overrides = {}) {
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const page = pageContext(component, {
    employeeCode: 'E1',
    startDate: new Date(year, month - 1, 21),
    endDate: new Date(endYear, endMonth - 1, 20),
    statusColor: 'pink',
    declineFlag: false,
    ...overrides,
  })
  component.created.call(page.context)
  return page
}

test('the employee calendar loads saved days and employee details through the store', async () => {
  const globals = { localStorage: { getItem: () => 'Portal User' } }
  const component = loadComponent(CALENDAR, globals)
  const filled = (context) => context.weeks.flat().filter((day) => !day.empty)

  // 28, 29, 30 and 31 day periods.
  for (const [year, month, length, start, end] of [
    [2026, 2, 28, '2026-02-21', '2026-03-20'],
    [2024, 2, 29, '2024-02-21', '2024-03-20'],
    [2026, 4, 30, '2026-04-21', '2026-05-20'],
    [2025, 12, 31, '2025-12-21', '2026-01-20'],
  ]) {
    const { context, dispatched, posts } = calendarContext(
      component,
      year,
      month
    )
    const days = Object.fromEntries(
      parsePeriod(start, end).days.map((day) => [day, 'RA'])
    )
    days[25] = 'AB'
    days[3] = null
    context.results = {
      'dtr/getCalendar': () => ({
        EmployeeCode: 'E1',
        entry: {
          ApprovalStatus: 2,
          DeclineFlag: true,
          DeclineMessage: 'Fix day 3',
          days,
        },
      }),
    }
    component.methods.prepareDataArray.call(context, 'firstTime')
    await component.methods.getSavedData.call(context)
    assert.deepEqual(dispatched, [
      ['dtr/getCalendar', { employeeCode: 'E1', start, end }],
    ])
    assert.equal(filled(context).length, length, start)
    assert.equal(filled(context).find((day) => day.dayNumber === 25).type, 'AB')
    // A day without a saved value keeps the default.
    assert.equal(filled(context).find((day) => day.dayNumber === 3).type, 'RA')
    assert.equal(context.declineMessage, 'Fix day 3')
    assert.equal(context.dtrEntriesArray.length, length - 1)
    assert.ok(
      context.dtrEntriesArray.every((day) => Number.isInteger(day.date))
    )
    assert.equal(context.overlay, false)
    assert.deepEqual(posts, [])
  }

  // Nothing saved yet, or the calendar could not be loaded.
  for (const result of [{ EmployeeCode: 'E1', entry: null }, null]) {
    const { context } = calendarContext(component, 2026, 2)
    context.results = { 'dtr/getCalendar': () => result }
    component.methods.prepareDataArray.call(context, 'firstTime')
    await component.methods.getSavedData.call(context)
    assert.ok(filled(context).every((day) => day.type === 'RA'))
    assert.equal(context.declineMessage, null)
    assert.equal(context.dtrEntriesArray.length, 28)
    assert.equal(context.overlay, false)
  }

  // Saving: the manager and employee details come from the server lookup.
  const save = calendarContext(component, 2026, 2)
  save.context.results = {
    'dtr/getEmployee': () => ({
      employee_code: 'E1',
      employee_name_eng: 'Employee E1',
      employee_picture: 'E1.jpg',
      Manager_Code: MGR1,
    }),
  }
  save.context.postResult = { data: [1] }
  component.methods.prepareDataArray.call(save.context)
  await component.methods.saveData.call(save.context)
  assert.deepEqual(save.dispatched[0], ['dtr/getEmployee', 'E1'])
  assert.equal(save.posts.length, 1)
  assert.equal(save.posts[0].url, '/dtr-api/save-dtr-data')
  const { dtrEntries, ...sent } = save.posts[0].body
  assert.deepEqual(sent, {
    employeeCode: 'E1',
    managerCode: MGR1,
    startingDate: '2026-02-21',
    endingDate: '2026-03-20',
    dtrAdmin: 'Portal User',
    employeeName: 'Employee E1',
    employeePicture: 'E1.jpg',
  })
  assert.deepEqual(
    dtrEntries.map((day) => day.date),
    parsePeriod('2026-02-21', '2026-03-20').days
  )
  assert.deepEqual(save.events, [['employeeDataSaved', 'E1']])
  assert.equal(save.context.overlay, false)

  // An employee outside the caller's assignments is not saved.
  const refused = calendarContext(component, 2026, 2)
  refused.context.results = { 'dtr/getEmployee': () => null }
  component.methods.prepareDataArray.call(refused.context)
  await component.methods.saveData.call(refused.context)
  assert.deepEqual(refused.posts, [])
  assert.deepEqual(refused.events, [])
  assert.equal(refused.context.overlay, false)
})

function sourceFiles(directories) {
  const found = []
  function walk(directory) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, item.name)
      if (item.isDirectory()) walk(full)
      else if (/\.(vue|js)$/.test(item.name)) found.push(full)
    }
  }
  for (const directory of directories) walk(path.join(root, directory))
  return found
}

const relative = (file) => path.relative(root, file).replaceAll('\\', '/')

test('DTR read callers send no SQL; the remaining legacy callers are exactly the Phase 8 writes', () => {
  const frontend = sourceFiles([
    'pages',
    'components',
    'store',
    'layouts',
    'utils',
    'plugins',
  ])
  const occurrences = (pattern) =>
    Object.fromEntries(
      frontend
        .map((file) => [
          relative(file),
          (fs.readFileSync(file, 'utf8').match(pattern) || []).length,
        ])
        .filter(([, count]) => count > 0)
    )
  // The retired gateways have no caller anywhere.
  assert.deepEqual(occurrences(/dtr-api\/sql-call/g), {})
  assert.deepEqual(occurrences(/hr-sql-call/g), {})
  assert.deepEqual(
    occurrences(/(?:administration|business-cards)-api\/\S*sql-call/g),
    {}
  )
  assert.deepEqual(occurrences(/sql-call/g), {})
  // Inventory for Phase 8: every remaining browser-SQL call is a status UPDATE.
  const inventory = {
    'components/dtr/dtr-table/employeeCalendar.vue': 1,
    'pages/dtr/approvals/index.vue': 3,
    'pages/dtr/dtr-table/index.vue': 1,
  }
  assert.deepEqual(occurrences(/dtr-api\/sql-params-call/g), inventory)
  assert.deepEqual(occurrences(/sql-(?:\w+-)*call/g), inventory)
  assert.deepEqual(occurrences(/dtr-api\/save-dtr-data/g), {
    'components/dtr/dtr-table/employeeCalendar.vue': 1,
  })

  for (const file of [TABLE_PAGE, APPROVALS_PAGE, CALENDAR]) {
    const script = compiler.parseComponent(read(file)).script.content
    // No read is built in the browser, and no HR or assignment table is named.
    assert.doesNotMatch(
      script,
      /\bSELECT\b|\bFROM\b|adminAssignment|Pay_employees|pay_emp_finance|pay_code_tables|MenaITech/,
      file
    )
    // The caller's identity is never taken from local storage for a read.
    assert.doesNotMatch(
      script,
      /localStorage\.getItem\('(?:employeeCode|managerCode)'\)|ManagerCode\]? = @managerCode/,
      file
    )
    const queries = [...script.matchAll(/query: `([\s\S]*?)`/g)].map((match) =>
      match[1].trim()
    )
    for (const query of queries)
      assert.match(
        query,
        /^UPDATE \[dtr\]\.\[dtrEntries\]\s+SET \[ApprovalStatus\]/
      )
    assert.equal(
      queries.length,
      (script.match(/sql-params-call/g) || []).length,
      file
    )
  }
  const store = read('store/dtr/index.js')
  assert.doesNotMatch(store, /sql-call|\bquery\s*:|\$axios\.post|localStorage/)
  assert.equal((store.match(/this\.\$axios\.get\(/g) || []).length, 5)

  // Server side: no DTR file reads SQL text from a request except the one
  // legacy gateway, and nothing else can reach the HR database.
  const server = sourceFiles(['server/dtr']).map(relative).sort()
  assert.deepEqual(server, [
    'server/dtr/configs/hrSQL.js',
    'server/dtr/configs/sql.js',
    'server/dtr/createApi.js',
    'server/dtr/main.js',
    'server/dtr/middleware/authorization.js',
    'server/dtr/router/dtr-actions.js',
    'server/dtr/router/dtrReads.js',
    'server/dtr/router/sqlCalls.js',
    'server/dtr/services/dtrReads.js',
  ])
  for (const file of server)
    if (file !== 'server/dtr/router/sqlCalls.js')
      assert.doesNotMatch(
        read(file),
        /body\.query|query\(req\.|query\(`\$\{req/,
        file
      )
  // Only the read service is given the HR connection.
  assert.deepEqual(
    server.filter((file) => /hrSQL|hrConfig/.test(read(file))),
    [
      'server/dtr/configs/hrSQL.js',
      'server/dtr/main.js',
      'server/dtr/services/dtrReads.js',
    ]
  )
  assert.ok(
    /"test:security": "[^"]*tests\/security\/dtr-reads\.test\.js/.test(
      read('package.json')
    )
  )
})

test('English and Arabic contain every DTR error code; edited buttons are clickable', () => {
  const codes = [
    'forbidden',
    'authFailed',
    'invalidPeriod',
    'invalidEmployeeCode',
    'employeeNotFound',
    'invalidRequest',
    'serviceUnavailable',
  ]
  for (const locale of ['en', 'ar']) {
    const messages = JSON.parse(read(`locales/${locale}.json`)).errorMessages
    assert.deepEqual(Object.keys(messages.dtr), codes, locale)
    for (const code of codes) {
      assert.equal(typeof messages.dtr[code], 'string', `${locale}: ${code}`)
      assert.ok(messages.dtr[code].length > 0)
    }
  }
  const ar = JSON.parse(read('locales/ar.json')).errorMessages.dtr
  const en = JSON.parse(read('locales/en.json')).errorMessages.dtr
  for (const code of codes) assert.notEqual(ar[code], en[code], code)

  // Every code the read router, service or composition can emit is translated.
  const emitted = new Set()
  for (const file of [
    'server/dtr/router/dtrReads.js',
    'server/dtr/services/dtrReads.js',
    'server/dtr/createApi.js',
    'server/shared/roles.js',
  ])
    for (const pattern of [
      /DtrError\(\s*'(\w+)'/g,
      /message:\s*'(\w+)'/g,
      /[?:]\s*'(\w+)'/g,
    ])
      for (const [, code] of read(file).matchAll(pattern)) emitted.add(code)
  for (const code of ['invalidPeriod', 'employeeNotFound', 'forbidden'])
    assert.ok(emitted.has(code), code)
  for (const code of emitted)
    if (code !== 'notFound') assert.ok(codes.includes(code), code)

  for (const file of [TABLE_PAGE, APPROVALS_PAGE, CALENDAR]) {
    const template = compiler.parseComponent(read(file)).template.content
    const buttons = template.match(/<v-btn\b[^>]*>/g) || []
    assert.ok(buttons.length >= 7, file)
    for (const button of buttons)
      assert.match(button, /cursor-pointer/, `${file}: ${button}`)
  }
})
