const path = require('path')
const express = require('express')
const api = express()
const elevatorsSurvey = require('./router/elevatorsSurvey.js')

api.use(express.json())
api.use(express.urlencoded({ extended: true }))
api.use(elevatorsSurvey)

// set up a static file serving
api.use(
  '/exported-csv-data',
  express.static(path.join(__dirname, '../../uploads/exportedFiles'))
)

module.exports = {
  path: '/elevators-surveys-api',
  handler: api,
}
