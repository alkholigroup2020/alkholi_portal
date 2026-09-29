const sql = require('mssql')
const { createRoleChecks, requireRole } = require('../shared/roles')
const portalConfig = require('./configs/sql')
const hrConfig = require('./configs/hrSQL')
const authorize = require('./middleware/authorization')
const createApi = require('./createApi')
const createSqlCallsRouter = require('./router/sqlCalls')
const { createMemberships } = require('./services/memberships')

module.exports = {
  path: '/administration-api',
  handler: createApi({
    authorize,
    requirePortalAdmin: requireRole(
      createRoleChecks({ sql, portalConfig }),
      'portalAdmin'
    ),
    memberships: createMemberships({ sql, portalConfig, hrConfig }),
    createSqlCallsRouter: ({ adminOnly }) =>
      createSqlCallsRouter({ sql, portalConfig, hrConfig, adminOnly }),
  }),
}
