const sql = require('mssql')
const { createRoleChecks, requireRole } = require('../shared/roles')
const portalConfig = require('./configs/sql')
const hrConfig = require('./configs/hrSQL')
const authorize = require('./middleware/authorization')
const createApi = require('./createApi')
const { createMemberships } = require('./services/memberships')
const { createDtrSetup } = require('./services/dtrSetup')

const memberships = createMemberships({ sql, portalConfig, hrConfig })

module.exports = {
  path: '/administration-api',
  handler: createApi({
    authorize,
    requirePortalAdmin: requireRole(
      createRoleChecks({ sql, portalConfig }),
      'portalAdmin'
    ),
    memberships,
    dtrSetup: createDtrSetup({
      sql,
      portalConfig,
      hrConfig,
      getEmployeeInfo: memberships.getEmployeeInfo,
    }),
  }),
}
