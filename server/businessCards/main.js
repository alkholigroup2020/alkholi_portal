const path = require('path')
const express = require('express')
const api = express()
const businessCards = require('./router/business-cards.js')
const vCard = require('./router/vCard.js')
const sqlCalls = require('./router/sqlCalls.js')

api.use(express.json())
api.use(express.urlencoded({ extended: true }))
api.use(businessCards)
api.use(vCard)
api.use(sqlCalls)

// set up a static file serving
api.use(
  '/business-cards',
  express.static(path.join(__dirname, '../../uploads/businessCards'))
)
api.use(
  '/vcard',
  express.static(path.join(__dirname, '../../uploads/businessCards'))
)

module.exports = {
  path: '/business-cards-api',
  handler: api,
}
