const express = require('express')
const api = express()
const businessCardsAdmins = require('./router/businessCardsAdmins.js')
const sqlCalls = require('./router/sqlCalls.js')

api.use(express.json())
api.use(express.urlencoded({ extended: true }))
api.use(businessCardsAdmins)
api.use(sqlCalls)

module.exports = {
  path: '/administration-api',
  handler: api,
}
