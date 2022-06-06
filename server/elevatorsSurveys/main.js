const express = require('express')
const api = express()
const sendElevatorsSurvey = require('./router/sendElevatorsSurvey.js')

api.use(express.json())
api.use(express.urlencoded({ extended: true }))
api.use(sendElevatorsSurvey)

module.exports = {
  path: '/elevators-surveys-api',
  handler: api,
}
