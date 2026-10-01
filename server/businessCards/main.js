const path = require('path')
const fs = require('fs')
const sql = require('mssql')
const QRCode = require('qrcode')
const { createCanvas, loadImage } = require('canvas')
const { createRoleChecks, requireRole } = require('../shared/roles')
const portalConfig = require('./configs/sql')
const authorize = require('./middleware/authorization')
const createApi = require('./createApi')
const { createPublicCards } = require('./services/publicCards')
const { createCardManagement } = require('./services/cardManagement')
const { createQrRenderer } = require('./services/qrCode')
const createVCardRouter = require('./router/vCard.js')

const uploadDirectory = path.join(__dirname, '../../uploads/businessCards')

module.exports = {
  path: '/business-cards-api',
  handler: createApi({
    authorize,
    requireCardsAdmin: requireRole(
      createRoleChecks({ sql, portalConfig }),
      'businessCardsAdmin'
    ),
    publicCards: createPublicCards({ sql, portalConfig }),
    cardManagement: createCardManagement({
      sql,
      portalConfig,
      fileSystem: fs.promises,
      uploadDirectory,
      renderQr: createQrRenderer({ QRCode, createCanvas, loadImage }),
      publicCardUrl: (employeeID) =>
        `https://portal.alkholi.com/business-card/${employeeID}`,
    }),
    vCard: createVCardRouter({
      publicCards: createPublicCards({ sql, portalConfig }),
    }),
    uploadDirectory,
  }),
}
