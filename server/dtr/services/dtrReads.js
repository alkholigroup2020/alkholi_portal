// Fixed, server-owned DTR read operations. The caller is always the employee
// of the verified session; request values are validated, then bound as typed
// parameters, and never reach SQL text or select a statement.
const {
  EMPLOYEE_SCOPES,
  EMPLOYEE_LIST_HINT,
  LEVELS,
  UNASSIGNED,
} = require('../../administration/services/dtrSetup')

// dtr.dtrEntries.EmployeeCode, dtr.adminAssignment.employeeCode and every
// stored hierarchy code are varchar(10); dtrEntries.ManagerCode is nvarchar(10).
const CODE_LENGTH = 10
const EMPLOYEE_CODE_PATTERN = /^[A-Za-z0-9_-]{1,10}$/

// A reporting period runs from the 21st of one month to the 20th of the next.
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const PERIOD_START_DAY = 21
const PERIOD_END_DAY = 20
const MIN_YEAR = 2000
const MAX_YEAR = 2100

// draft 0, pending 1, declined 2, approved 3
const PENDING = 1

// Day columns of dtr.dtrEntries, in the order of a period.
const DAY_COLUMNS = Object.freeze([
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
  12, 13, 14, 15, 16, 17, 18, 19, 20,
])
const DAY_COLUMN_LIST = DAY_COLUMNS.map((day) => `[${day}]`).join(', ')

const LEVEL_NAMES = [...LEVELS.keys()]

const ASSIGNMENTS_QUERY = `SELECT id, branchName, divisionCode, departmentCode,
    projectCode, subProjectCode
  FROM dtr.adminAssignment
  WHERE employeeCode = @employeeCode
  ORDER BY id`

// The hierarchy rules, HR column mapping, branch scoping and active-employee
// filter are the DTR setup ones (EMPLOYEE_SCOPES); only the columns differ.
const SCOPE_LIST_QUERIES = new Map(
  [...EMPLOYEE_SCOPES].map(([level, scope]) => [
    level,
    `SELECT A.employee_code, A.employee_name_eng, A.employee_name_a,
    A.employee_picture
  ${scope}
  ORDER BY A.employee_code
  ${EMPLOYEE_LIST_HINT}`,
  ])
)

// One employee is found through the HR primary key, so its plan is stable.
const SCOPE_EMPLOYEE_QUERIES = new Map(
  [...EMPLOYEE_SCOPES].map(([level, scope]) => [
    level,
    `SELECT DISTINCT TOP (2) A.employee_code, A.employee_name_eng,
    A.employee_picture, A.Manager_Code
  ${scope}
    AND A.employee_code = @employeeCode`,
  ])
)

// Style 23 is yyyy-mm-dd: the validated text is converted by the server, so
// no driver or time-zone setting can shift the day.
const PERIOD_MATCH = `StartDate = CONVERT(date, @periodStart, 23)
    AND EndDate = CONVERT(date, @periodEnd, 23)`

const PERIOD_ENTRIES_QUERY = `SELECT EmployeeCode, ApprovalStatus, DeclineFlag
  FROM dtr.dtrEntries
  WHERE ${PERIOD_MATCH}`

const ENTRY_QUERY = `SELECT TOP (1) EmployeeCode, ManagerCode, ApprovalStatus,
    DeclineFlag, DeclineMessage, ${DAY_COLUMN_LIST}
  FROM dtr.dtrEntries
  WHERE EmployeeCode = @employeeCode AND ${PERIOD_MATCH}`

const PENDING_APPROVALS_QUERY = `SELECT EmployeeCode, employeeName,
    employeePicture, ApprovalStatus, ${DAY_COLUMN_LIST}
  FROM dtr.dtrEntries
  WHERE ManagerCode = @managerCode AND ApprovalStatus = ${PENDING}
    AND ${PERIOD_MATCH}
  ORDER BY id`

class DtrError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.statusCode = statusCode
  }
}

function validateEmployeeCode(value) {
  if (
    typeof value !== 'string' ||
    !EMPLOYEE_CODE_PATTERN.test(value) ||
    value.toLowerCase() === UNASSIGNED
  )
    throw new DtrError('invalidEmployeeCode', 400)
  return value
}

// Both dates as YYYY-MM-DD: the 21st of a month and the 20th of the next one.
// Returns the period and its calendar days in order (28 to 31 of them).
function parsePeriod(start, end) {
  const from = typeof start === 'string' && ISO_DATE.exec(start)
  const to = typeof end === 'string' && ISO_DATE.exec(end)
  if (!from || !to) throw new DtrError('invalidPeriod', 400)
  const [startYear, startMonth, startDay] = from.slice(1).map(Number)
  const [endYear, endMonth, endDay] = to.slice(1).map(Number)
  if (
    startDay !== PERIOD_START_DAY ||
    endDay !== PERIOD_END_DAY ||
    startMonth < 1 ||
    startMonth > 12 ||
    startYear < MIN_YEAR ||
    startYear > MAX_YEAR ||
    endMonth !== (startMonth % 12) + 1 ||
    endYear !== startYear + (startMonth === 12 ? 1 : 0)
  )
    throw new DtrError('invalidPeriod', 400)
  // Day 0 of the following month is the last day of the start month.
  const lastDay = new Date(Date.UTC(startYear, startMonth, 0)).getUTCDate()
  const days = []
  for (let day = PERIOD_START_DAY; day <= lastDay; day++) days.push(day)
  for (let day = 1; day <= PERIOD_END_DAY; day++) days.push(day)
  return { start, end, days }
}

function isStoredCode(value) {
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    value.length <= CODE_LENGTH &&
    value.toLowerCase() !== UNASSIGNED
  )
}

// A stored assignment names its level by how many of the lower codes are set;
// the remaining ones hold the sentinel. Any other pattern, or a value HR
// cannot hold, matches no employee: a malformed row never widens the scope.
function assignmentScope(row) {
  if (!row || typeof row !== 'object') return null
  const lower = [row.departmentCode, row.projectCode, row.subProjectCode]
  const first = lower.indexOf(UNASSIGNED)
  const depth = first === -1 ? lower.length : first
  if (lower.slice(depth).some((value) => value !== UNASSIGNED)) return null
  const values = [row.branchName, row.divisionCode, ...lower.slice(0, depth)]
  if (!values.every(isStoredCode)) return null
  const level = LEVEL_NAMES[depth]
  const path = {}
  LEVELS.get(level).forEach((field, index) => {
    path[field] = values[index]
  })
  return { level, path }
}

// Both databases compare codes case-insensitively and ignore trailing spaces.
function codeKey(value) {
  return typeof value === 'string' ? value.trimEnd().toUpperCase() : ''
}

function sameCode(left, right) {
  const key = codeKey(left)
  return key !== '' && key === codeKey(right)
}

function isTrue(value) {
  return value === true || value === 1
}

// Only the days that exist in the period; unused columns are never returned.
function periodDays(row, period) {
  const days = {}
  for (const day of period.days) {
    const value = row[day]
    days[day] = value === undefined ? null : value
  }
  return days
}

function entryStatus(row, employeeCode) {
  return {
    EmployeeCode: employeeCode,
    ApprovalStatus: row.ApprovalStatus,
    DeclineFlag: isTrue(row.DeclineFlag),
  }
}

function createDtrReads({ sql, portalConfig, hrConfig }) {
  async function withPool(config, operation) {
    const pool = new sql.ConnectionPool(config)
    try {
      await pool.connect()
      return await operation(pool)
    } finally {
      await pool.close().catch(() => {})
    }
  }

  function bindPath(request, path) {
    for (const [field, value] of Object.entries(path))
      request.input(field, sql.VarChar(CODE_LENGTH), value)
    return request
  }

  function bindPeriod(request, period) {
    return request
      .input('periodStart', sql.VarChar(10), period.start)
      .input('periodEnd', sql.VarChar(10), period.end)
  }

  // Distinct assignment scopes of the caller. No assignment is no scope.
  async function callerScopes(portal, caller) {
    if (typeof caller !== 'string' || !caller || caller.length > CODE_LENGTH)
      return []
    const { recordset } = await portal
      .request()
      .input('employeeCode', sql.VarChar(CODE_LENGTH), caller)
      .query(ASSIGNMENTS_QUERY)
    const scopes = new Map()
    for (const row of recordset) {
      const scope = assignmentScope(row)
      if (scope) scopes.set(JSON.stringify([scope.level, scope.path]), scope)
    }
    return [...scopes.values()]
  }

  // Active employees of every scope, each listed once, in first-seen order.
  async function scopeEmployees(scopes) {
    const employees = new Map()
    if (!scopes.length) return employees
    await withPool(hrConfig, async (hr) => {
      for (const scope of scopes) {
        const { recordset } = await bindPath(hr.request(), scope.path).query(
          SCOPE_LIST_QUERIES.get(scope.level)
        )
        for (const row of recordset) {
          const key = codeKey(row.employee_code)
          if (key && !employees.has(key)) employees.set(key, row)
        }
      }
    })
    return employees
  }

  // The active employee when one of the scopes contains the code, else null.
  async function scopeEmployee(scopes, employeeCode) {
    if (!scopes.length) return null
    return await withPool(hrConfig, async (hr) => {
      for (const scope of scopes) {
        const { recordset } = await bindPath(hr.request(), scope.path)
          .input('employeeCode', sql.VarChar(CODE_LENGTH), employeeCode)
          .query(SCOPE_EMPLOYEE_QUERIES.get(scope.level))
        // One code naming two HR employees cannot be resolved safely.
        if (recordset.length > 1) throw new DtrError('serviceUnavailable', 503)
        if (recordset.length) return recordset[0]
      }
      return null
    })
  }

  async function readEntry(portal, employeeCode, period) {
    const { recordset } = await bindPeriod(
      portal
        .request()
        .input('employeeCode', sql.VarChar(CODE_LENGTH), employeeCode),
      period
    ).query(ENTRY_QUERY)
    return recordset.length ? recordset[0] : null
  }

  function requestValues(query) {
    return query && typeof query === 'object' ? query : {}
  }

  return {
    async listAssignedEmployees(caller) {
      const scopes = await withPool(portalConfig, (portal) =>
        callerScopes(portal, caller)
      )
      const employees = await scopeEmployees(scopes)
      return [...employees.values()].map((row) => ({
        employee_code: row.employee_code,
        employee_name_eng: row.employee_name_eng,
        employee_name_a: row.employee_name_a,
        employee_picture: row.employee_picture,
      }))
    },

    // Entry statuses of the caller's assigned employees for one period, or of
    // one assigned employee when `employeeCode` is given.
    async listPeriodEntries(caller, query) {
      const values = requestValues(query)
      const period = parsePeriod(values.start, values.end)
      const single = values.employeeCode !== undefined
      const employeeCode = single
        ? validateEmployeeCode(values.employeeCode)
        : null
      return await withPool(portalConfig, async (portal) => {
        const scopes = await callerScopes(portal, caller)
        if (single) {
          const employee = await scopeEmployee(scopes, employeeCode)
          if (!employee) throw new DtrError('employeeNotFound', 404)
          const entry = await readEntry(portal, employeeCode, period)
          return entry ? [entryStatus(entry, employee.employee_code)] : []
        }
        const employees = await scopeEmployees(scopes)
        if (!employees.size) return []
        const { recordset } = await bindPeriod(portal.request(), period).query(
          PERIOD_ENTRIES_QUERY
        )
        const statuses = new Map()
        for (const row of recordset) {
          const key = codeKey(row.EmployeeCode)
          const employee = employees.get(key)
          if (employee && !statuses.has(key))
            statuses.set(key, entryStatus(row, employee.employee_code))
        }
        return [...statuses.values()]
      })
    },

    // HR details the calendar needs to save an assigned employee's entry.
    async getEmployee(caller, employeeCode) {
      const code = validateEmployeeCode(employeeCode)
      const scopes = await withPool(portalConfig, (portal) =>
        callerScopes(portal, caller)
      )
      const employee = await scopeEmployee(scopes, code)
      if (!employee) throw new DtrError('employeeNotFound', 404)
      return {
        employee_code: employee.employee_code,
        employee_name_eng: employee.employee_name_eng,
        employee_picture: employee.employee_picture,
        Manager_Code: employee.Manager_Code,
      }
    },

    // Saved days of one employee for one period. Allowed for an assigned
    // employee, or for a pending entry whose recorded manager is the caller;
    // an unknown employee and one outside both answer alike.
    async getCalendar(caller, employeeCode, query) {
      const code = validateEmployeeCode(employeeCode)
      const values = requestValues(query)
      const period = parsePeriod(values.start, values.end)
      return await withPool(portalConfig, async (portal) => {
        const entry = await readEntry(portal, code, period)
        let owner =
          entry &&
          entry.ApprovalStatus === PENDING &&
          sameCode(entry.ManagerCode, caller)
            ? entry.EmployeeCode
            : null
        if (!owner) {
          const scopes = await callerScopes(portal, caller)
          const employee = await scopeEmployee(scopes, code)
          if (!employee) throw new DtrError('employeeNotFound', 404)
          owner = employee.employee_code
        }
        return {
          EmployeeCode: owner,
          entry: entry
            ? {
                ApprovalStatus: entry.ApprovalStatus,
                DeclineFlag: isTrue(entry.DeclineFlag),
                DeclineMessage: entry.DeclineMessage || null,
                days: periodDays(entry, period),
              }
            : null,
        }
      })
    },

    // Pending entries of one period whose recorded manager is the caller.
    async listPendingApprovals(caller, query) {
      const values = requestValues(query)
      const period = parsePeriod(values.start, values.end)
      if (typeof caller !== 'string' || !caller || caller.length > CODE_LENGTH)
        return []
      return await withPool(portalConfig, async (portal) => {
        const { recordset } = await bindPeriod(
          portal
            .request()
            .input('managerCode', sql.NVarChar(CODE_LENGTH), caller),
          period
        ).query(PENDING_APPROVALS_QUERY)
        return recordset.map((row) => ({
          EmployeeCode: row.EmployeeCode,
          employeeName: row.employeeName,
          employeePicture: row.employeePicture,
          ApprovalStatus: row.ApprovalStatus,
          days: periodDays(row, period),
        }))
      })
    },
  }
}

module.exports = {
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
}
