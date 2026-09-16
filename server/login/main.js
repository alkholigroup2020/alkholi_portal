const express = require('express')
const api = express()
const userAuthentication = require('./router/authentication')

api.use(userAuthentication)

module.exports = {
  path: '/login-api',
  handler: api,
}
