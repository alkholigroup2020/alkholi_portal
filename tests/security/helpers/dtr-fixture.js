const assert = require('node:assert/strict')
const express = require('express')
const createApi = require('../../../server/dtr/createApi')
const {
  createDtrReads,
  parsePeriod,
  DAY_COLUMNS,
  ASSIGNMENTS_QUERY,
  SCOPE_LIST_QUERIES,
  SCOPE_EMPLOYEE_QUERIES,
  PERIOD_ENTRIES_QUERY,
  ENTRY_QUERY,
  PENDING_APPROVALS_QUERY,
} = require('../../../server/dtr/services/dtrReads')
const {
  EMPLOYEE_QUERIES,
  LEVELS,
} = require('../../../server/administration/services/dtrSetup')
const {
  createRoleChecks,
  requireRole,
  ROLE_QUERIES,
} = require('../../../server/shared/roles')
const { createAuth } = require('../../../server/login/services/auth')
const { createSessions } = require('../../../server/login/services/session')
const {
  createDtrWrites,
  MEMBER_QUERY,
  LOCK_ENTRY,
  SAVE_UPDATE,
  SAVE_INSERT,
  SUBMIT,
  APPROVE,
  DECLINE,
} = require('../../../server/dtr/services/dtrWrites')

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

  // The fixture serializes portal transactions and restores a snapshot on
  // rollback. This verifies service behavior, not SQL Server lock mechanics.
  let queue = Promise.resolve()
  let auditCounter = 0
  const transactions = []
  class Transaction {
    constructor(pool) {
      this.pool = pool
      transactions.push(this)
    }

    async begin(isolation) {
      this.isolation = isolation
      if (state.failAt === 'begin') throw new Error('private begin failure')
      if (this.pool.config.name === 'portal') {
        const previous = queue
        queue = new Promise((resolve) => {
          this.release = resolve
        })
        await previous
        this.before = structuredClone(state.entries)
      }
      this.active = true
    }

    async commit() {
      if (state.failAt === 'commit') throw new Error('private commit failure')
      this.committed = true
      this.active = false
      if (this.release) this.release()
    }

    async rollback() {
      this.rolledBack = true
      if (this.active && this.before) state.entries = this.before
      this.active = false
      if (this.release) this.release()
    }
  }
  register('memberWrite', MEMBER_QUERY, (v) =>
    state.members
      .filter((code) => sameCode(code, v.caller))
      .map((employeeID) => ({ employeeID }))
  )
  const rowFor = (v) =>
    state.entries.find(
      (row) => inPeriod(row, v) && sameCode(row.EmployeeCode, v.employeeCode)
    )
  register('lockEntry', LOCK_ENTRY, (v) => (rowFor(v) ? [rowFor(v)] : []))
  for (const [name, statement, status] of [
    ['saveUpdate', SAVE_UPDATE, 0],
    ['saveInsert', SAVE_INSERT, 0],
    ['submit', SUBMIT, 1],
    ['approve', APPROVE, 3],
    ['decline', DECLINE, 2],
  ])
    register(name, statement, (v) => {
      state.writes = (state.writes || 0) + 1
      if (state.failWriteAt === state.writes)
        throw new Error('private write failure')
      if (state.zeroAffected) return { rowsAffected: [0] }
      let row = rowFor(v)
      if (name === 'saveInsert') {
        if (row) throw Object.assign(new Error('duplicate'), { number: 2627 })
        row = entry(
          v.employeeCode,
          { start: v.periodStart, end: v.periodEnd },
          0,
          v.managerCode
        )
        row.DeclineFlag = false
        state.entries.push(row)
      } else if (
        !row ||
        !(status === 0 || status === 1
          ? [0, 2].includes(row.ApprovalStatus)
          : row.ApprovalStatus === 1 &&
            sameCode(row.ManagerCode, v.managerCode))
      )
        return { rowsAffected: [0] }
      if (status === 0) {
        row.employeeName = v.employeeName
        row.employeePicture = v.employeePicture
        row.ManagerCode = v.managerCode
        for (const day of DAY_COLUMNS) row[day] = v['day' + day]
      } else {
        row.DeclineFlag = status === 2
        row.DeclineMessage = status === 2 ? v.declineMessage : null
      }
      row.ApprovalStatus = status
      row.ModifiedBy = v.caller
      row.ModifiedDate = 'fixture-audit-' + ++auditCounter
      return { rowsAffected: [1] }
    })

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
      return new Request(this)
    }
  }
  class Request {
    constructor(owner) {
      const transaction = owner instanceof Transaction ? owner : null
      const pool = transaction ? transaction.pool : owner
      const inputs = {}
      return {
        input(name, type, value) {
          assert.equal(
            arguments.length,
            3,
            'every input must have an explicit SQL type'
          )
          inputs[name] = { type, value }
          return this
        },
        async query(statement) {
          const name = names.get(statement) || 'unknown'
          calls.push({
            name,
            statement,
            inputs,
            config: pool.config.name,
            transaction: transaction || null,
          })
          if (transaction && !transaction.active)
            throw new Error('inactive transaction')
          await new Promise((resolve) => setImmediate(resolve))
          if (state.failAt === statement || state.failAt === name)
            throw new Error('private SQL detail: dtr.secret_table')
          const values = Object.fromEntries(
            Object.entries(inputs).map(([key, input]) => [key, input.value])
          )
          const handler = handlers.get(statement)
          if (!handler) throw new Error('statement is not server-owned')
          const recordset = handler(values)
          if (state.revokeAfterRole && name === 'role')
            state.members = state.members.filter(
              (code) => code !== values.employeeCode
            )
          if (!Array.isArray(recordset)) return recordset
          return {
            recordset: structuredClone(recordset),
            recordsets: [recordset],
          }
        },
      }
    }
  }

  const sql = {
    ConnectionPool,
    Transaction,
    Request,
    ISOLATION_LEVEL: { SERIALIZABLE: 4 },
    VarChar: (length) => ({ name: 'varchar', length }),
    NVarChar: (length) => ({ name: 'nvarchar', length }),
  }
  return {
    calls,
    pools,
    transactions,
    state,
    sql,
    portalConfig,
    hrConfig,
    names: () => calls.map((call) => call.name),
    roles: createRoleChecks({ sql, portalConfig }),
    dtrReads: createDtrReads({ sql, portalConfig, hrConfig }),
    dtrWrites: createDtrWrites({ sql, portalConfig, hrConfig }),
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
  const app = express()
  app.use(
    '/dtr-api',
    createApi({
      authorize: auth.authorize,
      requireDtrUser: requireRole(f.roles, 'dtrUser'),
      dtrReads: f.dtrReads,
      dtrWrites: f.dtrWrites,
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
    revoke: (token) => revoked.add(token),
  }
}

module.exports = {
  ADM_DIV,
  ADM_DEP,
  ADM_PRJ,
  ADM_SUB,
  ADM_MIX,
  ADM_NONE,
  ADM_BAD,
  MGR1,
  MGR2,
  NON_MEMBER,
  LONG_CODE,
  CALLERS,
  WINTER,
  SHORT,
  LEAP,
  SPRING,
  U,
  codeRow,
  employee,
  assignment,
  entry,
  databaseFixture,
  httpFixture,
}
