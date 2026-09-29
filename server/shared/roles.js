// Server-side role checks. Each role maps to one fixed membership table; no
// role implies another (portal administrators do not inherit module roles).
const EMPLOYEE_CODE_MAX_LENGTH = 20

function existsQuery(table) {
  return `SELECT CAST(CASE WHEN EXISTS (
    SELECT 1 FROM dbo.${table} WHERE employeeID = @employeeCode
  ) THEN 1 ELSE 0 END AS bit) AS hasRole`
}

const ROLE_QUERIES = new Map([
  ['portalAdmin', existsQuery('admin_members')],
  ['businessCardsAdmin', existsQuery('business_card_admins')],
  ['cocAdmin', existsQuery('coc_admins')],
  ['elevatorsUser', existsQuery('elevators_users')],
  ['hrSurveysUser', existsQuery('hr_surveys_users')],
  ['dtrUser', existsQuery('dtr_users')],
])

function isEmployeeCode(value) {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= EMPLOYEE_CODE_MAX_LENGTH
  )
}

function createRoleChecks({ sql, portalConfig }) {
  return {
    // Evaluated on every call so revoked membership applies to the next request.
    async hasRole(role, employeeCode) {
      const statement = ROLE_QUERIES.get(role)
      if (!statement) throw new Error('Unknown role')
      if (!isEmployeeCode(employeeCode)) return false
      const pool = new sql.ConnectionPool(portalConfig)
      try {
        await pool.connect()
        const { recordset } = await pool
          .request()
          .input(
            'employeeCode',
            sql.VarChar(EMPLOYEE_CODE_MAX_LENGTH),
            employeeCode
          )
          .query(statement)
        if (!recordset || recordset.length !== 1)
          throw new Error('Unexpected role result')
        return recordset[0].hasRole === true || recordset[0].hasRole === 1
      } finally {
        await pool.close().catch(() => {})
      }
    },
  }
}

// Must run after the shared `authorize` middleware; identity comes only from
// the verified session in `req.auth`, never from the request body or query.
function requireRole(roleChecks, role) {
  if (!ROLE_QUERIES.has(role)) throw new Error('Unknown role')
  return async function roleGuard(req, res, next) {
    const employeeCode = req.auth && req.auth.employeeCode
    if (!isEmployeeCode(employeeCode))
      return res.status(401).json({ message: 'authFailed' })
    let allowed
    try {
      allowed = await roleChecks.hasRole(role, employeeCode)
    } catch {
      return res.status(503).json({ message: 'serviceUnavailable' })
    }
    if (!allowed) return res.status(403).json({ message: 'forbidden' })
    return next()
  }
}

module.exports = {
  createRoleChecks,
  requireRole,
  ROLE_QUERIES,
}
