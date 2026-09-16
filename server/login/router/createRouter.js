const express = require('express')
const { AuthError, sendAuthError } = require('../services/errors')

module.exports = function createRouter(auth) {
  const router = express.Router()
  router.use(express.json({ limit: '16kb' }))
  router.use(express.urlencoded({ extended: false, limit: '16kb' }))
  router.post('/login', auth.login)
  router.post('/reauthenticate', auth.authorize, auth.reauthenticate)
  router.post('/logoff', auth.logoff)
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    if (
      error.type === 'entity.parse.failed' ||
      error.type === 'entity.too.large'
    ) {
      return sendAuthError(res, new AuthError('invalidInput', 400))
    }
    return sendAuthError(res, error)
  })
  return router
}
