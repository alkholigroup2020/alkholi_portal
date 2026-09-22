const path = require('path')
const fs = require('fs')
const sql = require('mssql')
const portalConfig = require('./configs/sql')
const authorize = require('./middleware/authorization')
const createApi = require('./createApi')
const { createPortalIdentity } = require('./services/portalIdentity')

const uploadDirectory = path.join(
  __dirname,
  '../../uploads/portal/usersProfileImages'
)

module.exports = {
  path: '/portal-api',
  handler: createApi({
    authorize,
    uploadDirectory,
    portalIdentity: createPortalIdentity({
      sql,
      portalConfig,
      fileSystem: fs.promises,
      uploadDirectory,
    }),
  }),
}
