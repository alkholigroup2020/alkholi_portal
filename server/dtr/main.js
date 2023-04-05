const express = require('express')
const api = express()
const sqlCalls = require('./router/sqlCalls.js')
const dtrActions = require('./router/dtr-actions.js')

api.use(express.json())
api.use(express.urlencoded({ extended: true }))
api.use(sqlCalls)
api.use(dtrActions)

module.exports = {
  path: '/dtr-api',
  handler: api,
}
