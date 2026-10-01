const path = require('path')
const fs = require('fs')
const express = require('express')
const cron = require('node-cron') // Add cron dependency
const api = express()
const sql = require('mssql')
const nodemailer = require('nodemailer')
const { createRoleChecks, requireRole } = require('../shared/roles')
const portalConfig = require('./configs/sql')
const authorize = require('./middleware/authorization')
const cocJS = require('./router/cocJS.js')({
  sql,
  portalConfig,
  authorize,
  fs,
  requireCocAdmin: requireRole(
    createRoleChecks({ sql, portalConfig }),
    'cocAdmin'
  ),
  transporter: nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  }),
})
const dataSync = require('./router/dataSync.js') // Import sync function

api.use(express.json({ limit: '256kb' }))
api.use(express.urlencoded({ extended: false, limit: '256kb' }))
api.use(cocJS)
// api.use(dataSync.router)
api.use(
  '/coc-versions',
  express.static(path.join(__dirname, '../../uploads/coc/cocVersions'))
)
api.use(
  '/printed-copies',
  express.static(path.join(__dirname, '../../uploads/coc/printedCopies'))
)
api.use(
  '/signed-coc-documents',
  express.static(path.join(__dirname, '../../uploads/coc/combinedDocuments'))
)

// PM2 runs multiple workers; only one should reconcile the employee snapshot.
if (!process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0') {
  let syncRunning = false
  const runEmployeeSync = async () => {
    if (syncRunning) return
    syncRunning = true
    try {
      await dataSync.syncEmployees()
    } catch (error) {
      process.stderr.write(
        `CoC employee sync failed: ${error.code || error.name}\n`
      )
    } finally {
      syncRunning = false
    }
  }

  runEmployeeSync()
  cron.schedule('*/10 * * * *', runEmployeeSync)
}

module.exports = {
  path: '/coc-api',
  handler: require('../shared/finishApi')(api),
}
