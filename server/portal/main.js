const path = require('path')
const express = require('express')
const api = express()
const profilesData = require('./router/profileData')
const userAuthorizations = require('./router/authorizations')

api.use(express.json())
api.use(express.urlencoded({ extended: true }))
api.use(profilesData)
api.use(userAuthorizations)

// set up a static file serving
api.use(
  '/profile-data',
  express.static(
    path.join(__dirname, '../../uploads/portal/usersProfileImages')
  )
)

module.exports = {
  path: '/portal-api',
  handler: api,
}
