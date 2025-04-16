const express = require('express')
const api = express()
const portalAdmins = require('./router/portalAdmins.js')
const businessCardsAdmins = require('./router/businessCardsAdmins.js')
const elevatorsSurveyAdmins = require('./router/elevatorsSurveyAdmins.js')
const hrSurveys = require('./router/hrSurveys.js')
const dtrUsers = require('./router/dtrUsers.js')
const sqlCalls = require('./router/sqlCalls.js')
const dtrSetup = require('./router/dtrSetup.js')
const cocAdmins = require('./router/cocAdmins.js')

api.use(express.json())
api.use(express.urlencoded({ extended: true }))
api.use(portalAdmins)
api.use(businessCardsAdmins)
api.use(elevatorsSurveyAdmins)
api.use(hrSurveys)
api.use(dtrUsers)
api.use(sqlCalls)
api.use(dtrSetup)
api.use(cocAdmins)

module.exports = {
  path: '/administration-api',
  handler: api,
}
