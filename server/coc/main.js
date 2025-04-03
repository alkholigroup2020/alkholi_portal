const path = require('path')
const express = require('express')
const api = express()
const cocJS = require('./router/cocJS.js')

api.use(express.json())
api.use(express.urlencoded({ extended: true }))
api.use(cocJS)

// set up a static file serving
api.use(
  '/coc-documents',
  express.static(path.join(__dirname, '../../uploads/coc/cocDocuments'))
)

module.exports = {
  path: '/coc-api',
  handler: api,
}
