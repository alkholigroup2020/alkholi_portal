const express = require('express')
const api = express()
const userAuthentication = require('./router/authentication')

api.use(express.json())
api.use(express.urlencoded({ extended: true }))
api.use(userAuthentication)

module.exports = {
  path: '/login-api',
  handler: api,
}
