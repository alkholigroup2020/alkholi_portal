const path = require('path')
const express = require('express')
const api = express()
const hrSurveys = require('./router/hrSurveys.js')

api.use(express.json())
api.use(express.urlencoded({ extended: true }))
api.use(hrSurveys)

// set up a static file serving
api.use(
  '/exported-csv-data',
  express.static(path.join(__dirname, '../../uploads/exportedFiles'))
)

module.exports = {
  path: '/hr-surveys-api',
  handler: api,
}
