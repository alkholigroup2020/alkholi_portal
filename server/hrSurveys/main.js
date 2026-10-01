const path = require('path')
const express = require('express')
const api = express()
const sql = require('mssql')
const { MongoClient } = require('mongodb')
const { createRoleChecks, requireRole } = require('../shared/roles')
const portalConfig = require('./configs/sql')
const auth = require('./middleware/authorization')
const hrSurveys = require('./router/hrSurveys.js')({
  sql,
  portalConfig,
  auth,
  hrConfig: require('./configs/hrSQL'),
  requireSurveyMember: requireRole(
    createRoleChecks({ sql, portalConfig }),
    'hrSurveysUser'
  ),
  createClient: () =>
    new MongoClient(
      `mongodb://${process.env.hrSurvey_dbUser}:${process.env.hrSurvey_dbPassword}@${process.env.hrSurvey_dbServerIP}/`,
      { useNewUrlParser: true, useUnifiedTopology: true }
    ),
})

api.use(express.json({ limit: '1mb' }))
api.use(express.urlencoded({ extended: false, limit: '1mb' }))
api.use(hrSurveys)

// set up a static file serving
api.use(
  '/exported-csv-data',
  express.static(path.join(__dirname, '../../uploads/exportedFiles'))
)

module.exports = {
  path: '/hr-surveys-api',
  handler: require('../shared/finishApi')(api),
}
