const path = require('path')
const express = require('express')
const api = express()
const cocJS = require('./router/cocJS.js')

api.use(express.json())
api.use(express.urlencoded({ extended: true }))
api.use(cocJS)

// set up a static file serving
api.use(
  '/coc-versions',
  express.static(path.join(__dirname, '../../uploads/coc/cocVersions'))
)
api.use(
  '/printed-copies',
  express.static(path.join(__dirname, '../../uploads/coc/printedCopies'))
)

module.exports = {
  path: '/coc-api',
  handler: api,
}
