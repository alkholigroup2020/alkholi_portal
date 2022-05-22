const express = require('express')
const api = express()
const portalAdmins = require('./router/portalAdmins.js')
const businessCardsAdmins = require('./router/businessCardsAdmins.js')
const sqlCalls = require('./router/sqlCalls.js')

api.use(express.json())
api.use(express.urlencoded({ extended: true }))
api.use(portalAdmins)
api.use(businessCardsAdmins)
api.use(sqlCalls)

module.exports = {
  path: '/administration-api',
  handler: api,
}
