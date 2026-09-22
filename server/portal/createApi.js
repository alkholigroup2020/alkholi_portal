const path = require('path')
const express = require('express')
const createProfileDataRouter = require('./router/profileData')
const createAuthorizationsRouter = require('./router/authorizations')
const createBusinessCardRouter = require('./router/businessCard')

module.exports = function createApi({
  authorize,
  portalIdentity,
  uploadDirectory,
}) {
  const api = express()
  api.use(express.json({ limit: '16kb' }))
  api.use(express.urlencoded({ extended: true, limit: '16kb' }))
  api.use(
    createProfileDataRouter({ authorize, portalIdentity, uploadDirectory })
  )
  api.use(createAuthorizationsRouter({ authorize, portalIdentity }))
  api.use(createBusinessCardRouter({ authorize, portalIdentity }))
  api.use('/profile-data', express.static(path.resolve(uploadDirectory)))
  api.use((req, res) => res.status(404).json({ message: 'notFound' }))
  return api
}
