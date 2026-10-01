const path = require('path')
const express = require('express')
const api = express()
const sql = require('mssql')
const { MongoClient } = require('mongodb')
const { createRoleChecks, requireRole } = require('../shared/roles')
const portalConfig = require('./configs/sql')
const auth = require('./middleware/authorization')
const elevatorsSurvey = require('./router/elevatorsSurvey.js')({
  sql,
  portalConfig,
  auth,
  transporter: require('nodemailer').createTransport({
    host: '10.10.10.20',
    port: 587,
    secure: false,
    auth: {
      user: 'info@buildingtec.com',
      pass: process.env.btecInfoAccPassword,
    },
    tls: { rejectUnauthorized: false },
  }),
  requireSurveyMember: requireRole(
    createRoleChecks({ sql, portalConfig }),
    'elevatorsUser'
  ),
  createClient: () =>
    new MongoClient(
      `mongodb://${process.env.dbUser}:${process.env.dbPassword}@${process.env.dbServerIP}/`,
      { useNewUrlParser: true, useUnifiedTopology: true }
    ),
})

api.use(express.json({ limit: '1mb' }))
api.use(express.urlencoded({ extended: false, limit: '1mb' }))
api.use(elevatorsSurvey)

// set up a static file serving
api.use(
  '/exported-csv-data',
  express.static(path.join(__dirname, '../../uploads/exportedFiles'))
)

module.exports = {
  path: '/elevators-surveys-api',
  handler: require('../shared/finishApi')(api),
}
