const sql = require('mssql')
const { createRoleChecks, requireRole } = require('../shared/roles')
const portalConfig = require('./configs/sql')
const hrConfig = require('./configs/hrSQL')
const authorize = require('./middleware/authorization')
const createApi = require('./createApi')
const { createDtrReads } = require('./services/dtrReads')
const dtrActions = require('./router/dtr-actions.js')

module.exports = {
  path: '/dtr-api',
  handler: createApi({
    authorize,
    requireDtrUser: requireRole(
      createRoleChecks({ sql, portalConfig }),
      'dtrUser'
    ),
    dtrReads: createDtrReads({ sql, portalConfig, hrConfig }),
    legacySql: { sql, portalConfig },
    legacyActions: dtrActions,
  }),
}
