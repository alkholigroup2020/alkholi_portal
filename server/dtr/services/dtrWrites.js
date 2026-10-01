const {
  createDtrScope,
  DtrError,
  parsePeriod,
  validateEmployeeCode,
  sameCode,
  codeKey,
} = require('./dtrReads')
const { DAY_COLUMNS, ENTRY_FIELDS, entryVersion } = require('./entryVersion')

const DAY_CODES = Object.freeze([
  'RA',
  'AB',
  'AV',
  'SV',
  'UP<20',
  'UP>20',
  'D',
  'NB',
  'HA',
  'MV',
  'HDM',
  'HDN',
  'MRG',
  'DOC',
  'ST',
])
const MEMBER_QUERY = `SELECT employeeID FROM dbo.dtr_users
  WHERE employeeID = @caller`
const PERIOD_MATCH = `StartDate = CONVERT(date, @periodStart, 23)
  AND EndDate = CONVERT(date, @periodEnd, 23)`
const LOCK_ENTRY = `SELECT ${ENTRY_FIELDS} FROM dtr.dtrEntries WITH (UPDLOCK, HOLDLOCK)
  WHERE EmployeeCode = @employeeCode AND ${PERIOD_MATCH}`
// datetime rounds to ~3ms. Advance even identical saves within that interval.
const AUDIT = `ModifiedBy = @caller,
  ModifiedDate = CASE WHEN ModifiedDate >= GETDATE()
    THEN DATEADD(millisecond, 4, ModifiedDate) ELSE GETDATE() END`
const DAY_ASSIGNMENTS = DAY_COLUMNS.map((day) => `[${day}] = @day${day}`).join(
  ', '
)
const SAVE_UPDATE = `UPDATE dtr.dtrEntries SET
  employeeName = @employeeName, employeePicture = @employeePicture,
  ManagerCode = @managerCode, ApprovalStatus = 0, ${AUDIT}, ${DAY_ASSIGNMENTS}
  WHERE EmployeeCode = @employeeCode AND ${PERIOD_MATCH}
    AND ApprovalStatus IN (0, 2)`
const SAVE_INSERT = `INSERT INTO dtr.dtrEntries
  (EmployeeCode, employeeName, employeePicture, ManagerCode, StartDate, EndDate,
   ModifiedDate, ModifiedBy, ApprovalStatus, DeclineMessage, DeclineFlag,
   ${DAY_COLUMNS.map((day) => `[${day}]`).join(', ')})
  VALUES (@employeeCode, @employeeName, @employeePicture, @managerCode,
   CONVERT(date, @periodStart, 23), CONVERT(date, @periodEnd, 23),
   GETDATE(), @caller, 0, NULL, 0,
   ${DAY_COLUMNS.map((day) => `@day${day}`).join(', ')})`
const SUBMIT = `UPDATE dtr.dtrEntries SET ApprovalStatus = 1,
  DeclineMessage = NULL, DeclineFlag = 0, ${AUDIT}
  WHERE EmployeeCode = @employeeCode AND ${PERIOD_MATCH}
    AND ApprovalStatus IN (0, 2)`
const APPROVE = `UPDATE dtr.dtrEntries SET ApprovalStatus = 3,
  DeclineMessage = NULL, DeclineFlag = 0, ${AUDIT}
  WHERE EmployeeCode = @employeeCode AND ${PERIOD_MATCH}
    AND ApprovalStatus = 1 AND ManagerCode = @managerCode`
const DECLINE = `UPDATE dtr.dtrEntries SET ApprovalStatus = 2,
  DeclineMessage = @declineMessage, DeclineFlag = 1, ${AUDIT}
  WHERE EmployeeCode = @employeeCode AND ${PERIOD_MATCH}
    AND ApprovalStatus = 1 AND ManagerCode = @managerCode`
const OPERATIONS = new Map([
  ['submit', SUBMIT],
  ['approve', APPROVE],
  ['decline', DECLINE],
])

function invalid(message = 'invalidRequest') {
  throw new DtrError(message, 400)
}
function conflict() {
  throw new DtrError('stateConflict', 409)
}
function object(value, allowed) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  )
    invalid()
}
function validateVersion(value, allowNew = false) {
  if (allowNew && value === null) return value
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
    invalid('invalidVersion')
  return value
}
function validateDays(entries, period) {
  if (!Array.isArray(entries) || entries.length !== period.days.length)
    invalid('invalidDays')
  const values = new Map()
  for (const entry of entries) {
    object(entry, ['date', 'type'])
    if (
      !Number.isInteger(entry.date) ||
      !period.days.includes(entry.date) ||
      values.has(entry.date) ||
      !DAY_CODES.includes(entry.type)
    )
      invalid('invalidDays')
    values.set(entry.date, entry.type)
  }
  return DAY_COLUMNS.map((day) => values.get(day) ?? null)
}
function trustedText(value, size, nullable = false) {
  if (nullable && (value === null || value === undefined || value === ''))
    return value === '' ? '' : null
  if (typeof value !== 'string' || !value.trim() || value.length > size)
    throw new DtrError('employeeInfoInvalid', 422)
  return value
}

function createDtrWrites({ sql, portalConfig, hrConfig }) {
  const scope = createDtrScope(sql)
  const source = (transaction) => ({
    request: () => new sql.Request(transaction),
  })
  function bind(request, caller, employeeCode, period) {
    return request
      .input('caller', sql.NVarChar(20), caller)
      .input('employeeCode', sql.VarChar(10), employeeCode)
      .input('periodStart', sql.VarChar(10), period.start)
      .input('periodEnd', sql.VarChar(10), period.end)
  }
  async function lockedEntry(portal, caller, code, period) {
    const { recordset } = await bind(
      portal.request(),
      caller,
      code,
      period
    ).query(LOCK_ENTRY)
    if (recordset.length > 1) throw new DtrError('serviceUnavailable', 503)
    return recordset[0] || null
  }

  // Serializable portal reads hold membership/assignment locks through commit.
  // HR is read-only; its serializable transaction holds scope and manager data
  // until the portal write commits. No distributed write or background job.
  async function transaction(caller, needsScope, operation) {
    if (typeof caller !== 'string' || !caller || caller.length > 20)
      throw new DtrError('authFailed', 401)
    const pool = new sql.ConnectionPool(portalConfig)
    let portalTx, hrPool, hrTx
    let committed = false
    try {
      await pool.connect()
      portalTx = new sql.Transaction(pool)
      await portalTx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE)
      const portal = source(portalTx)
      const { recordset } = await portal
        .request()
        .input('caller', sql.VarChar(20), caller)
        .query(MEMBER_QUERY)
      if (!recordset.length) throw new DtrError('forbidden', 403)
      let scopes = []
      let hr = null
      if (needsScope) {
        scopes = await scope.callerScopes(portal, caller)
        if (!scopes.length) throw new DtrError('forbidden', 403)
        hrPool = new sql.ConnectionPool(hrConfig)
        await hrPool.connect()
        hrTx = new sql.Transaction(hrPool)
        await hrTx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE)
        hr = source(hrTx)
      }
      const result = await operation(portal, hr, scopes)
      await portalTx.commit()
      committed = true
      return result
    } catch (error) {
      if ([1205, 2601, 2627].includes(error.number)) conflict()
      throw error
    } finally {
      if (portalTx && !committed) await portalTx.rollback().catch(() => {})
      if (hrTx) await hrTx.rollback().catch(() => {})
      if (hrPool) await hrPool.close().catch(() => {})
      await pool.close().catch(() => {})
    }
  }

  return {
    async save(caller, body) {
      object(body, ['employeeCode', 'start', 'end', 'version', 'dtrEntries'])
      const code = validateEmployeeCode(body.employeeCode)
      const period = parsePeriod(body.start, body.end)
      const version = validateVersion(body.version, true)
      const days = validateDays(body.dtrEntries, period)
      return await transaction(caller, true, async (portal, hr, scopes) => {
        const employee = await scope.scopeEmployee(hr, scopes, code)
        if (!employee) throw new DtrError('forbidden', 403)
        const name = trustedText(employee.employee_name_eng, 100)
        const picture = trustedText(employee.employee_picture, 300, true)
        const manager = trustedText(employee.Manager_Code, 10)
        const row = await lockedEntry(portal, caller, code, period)
        if (row && ![0, 2].includes(row.ApprovalStatus)) conflict()
        if (entryVersion(row) !== version) conflict()
        const request = bind(portal.request(), caller, code, period)
          .input('employeeName', sql.VarChar(100), name)
          .input('employeePicture', sql.VarChar(300), picture)
          .input('managerCode', sql.NVarChar(10), manager)
        DAY_COLUMNS.forEach((day, index) =>
          request.input(`day${day}`, sql.NVarChar(5), days[index])
        )
        const result = await request.query(row ? SAVE_UPDATE : SAVE_INSERT)
        if (result.rowsAffected.reduce((sum, count) => sum + count, 0) !== 1)
          conflict()
        const saved = await lockedEntry(portal, caller, code, period)
        if (!saved) throw new DtrError('serviceUnavailable', 503)
        return { message: 'dtrSaved', version: entryVersion(saved) }
      })
    },

    async act(caller, action, body, bulk = false) {
      const statement = OPERATIONS.get(action)
      if (!statement || (bulk && action === 'decline')) invalid()
      object(
        body,
        bulk
          ? ['start', 'end', 'targets']
          : [
              'start',
              'end',
              'employeeCode',
              'version',
              ...(action === 'decline' ? ['declineMessage'] : []),
            ]
      )
      const period = parsePeriod(body.start, body.end)
      const targets = bulk
        ? body.targets
        : [{ employeeCode: body.employeeCode, version: body.version }]
      if (!Array.isArray(targets) || !targets.length || targets.length > 5000)
        invalid('invalidTargets')
      const seen = new Set()
      const validated = targets
        .map((target) => {
          object(target, ['employeeCode', 'version'])
          const employeeCode = validateEmployeeCode(target.employeeCode)
          const key = codeKey(employeeCode)
          if (seen.has(key)) invalid('invalidTargets')
          seen.add(key)
          return { employeeCode, version: validateVersion(target.version) }
        })
        .sort((a, b) =>
          codeKey(a.employeeCode).localeCompare(codeKey(b.employeeCode))
        )
      if (
        action === 'decline' &&
        (typeof body.declineMessage !== 'string' ||
          !body.declineMessage.trim() ||
          body.declineMessage.length > 300)
      )
        invalid('invalidDeclineMessage')
      return await transaction(
        caller,
        action === 'submit',
        async (portal, hr, scopes) => {
          // Validate and lock every target before writing even the first one.
          for (const target of validated) {
            if (
              action === 'submit' &&
              !(await scope.scopeEmployee(hr, scopes, target.employeeCode))
            )
              throw new DtrError('forbidden', 403)
            const row = await lockedEntry(
              portal,
              caller,
              target.employeeCode,
              period
            )
            if (
              row &&
              action !== 'submit' &&
              !sameCode(row.ManagerCode, caller)
            )
              throw new DtrError('forbidden', 403)
            if (
              !row ||
              !(action === 'submit' ? [0, 2] : [1]).includes(
                row.ApprovalStatus
              ) ||
              entryVersion(row) !== target.version
            )
              conflict()
            if (
              action === 'submit' &&
              period.days.some((day) => !DAY_CODES.includes(row[day]))
            )
              invalid('invalidDays')
          }
          for (const target of validated) {
            const request = bind(
              portal.request(),
              caller,
              target.employeeCode,
              period
            )
            if (action !== 'submit')
              request.input('managerCode', sql.NVarChar(10), caller)
            if (action === 'decline')
              request.input(
                'declineMessage',
                sql.NVarChar(300),
                body.declineMessage
              )
            const result = await request.query(statement)
            if (
              result.rowsAffected.reduce((sum, count) => sum + count, 0) !== 1
            )
              conflict()
          }
          return { message: 'dtrUpdated', affected: validated.length }
        }
      )
    },
  }
}

module.exports = {
  createDtrWrites,
  validateDays,
  DAY_CODES,
  MEMBER_QUERY,
  LOCK_ENTRY,
  SAVE_UPDATE,
  SAVE_INSERT,
  SUBMIT,
  APPROVE,
  DECLINE,
}
