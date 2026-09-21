const sql = require('mssql')
const portalConfig = require('./configs/sql')
const createApi = require('./createApi')
const { createPublicCards } = require('./services/publicCards')
const businessCards = require('./router/business-cards.js')
const vCard = require('./router/vCard.js')
const sqlCalls = require('./router/sqlCalls.js')

module.exports = {
  path: '/business-cards-api',
  handler: createApi({
    publicCards: createPublicCards({ sql, portalConfig }),
    businessCards,
    vCard,
    sqlCalls,
  }),
}
