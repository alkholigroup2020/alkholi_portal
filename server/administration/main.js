const express = require('express')
const api = express()
const portalAdmins = require('./router/portalAdmins.js')
const businessCardsAdmins = require('./router/businessCardsAdmins.js')
const elevatorsSurveyAdmins = require('./router/elevatorsSurveyAdmins.js')
const hrSurveys = require('./router/hrSurveys.js')
const sqlCalls = require('./router/sqlCalls.js')

api.use(express.json())
api.use(express.urlencoded({ extended: true }))
api.use(portalAdmins)
api.use(businessCardsAdmins)
api.use(elevatorsSurveyAdmins)
api.use(hrSurveys)
api.use(sqlCalls)

module.exports = {
  path: '/administration-api',
  handler: api,
}
