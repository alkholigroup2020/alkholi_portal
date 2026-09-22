const express = require('express')
const { PortalError } = require('../services/portalIdentity')

module.exports = function createBusinessCardRouter({
  authorize,
  portalIdentity,
}) {
  const router = express.Router()

  router.get('/my-business-card', authorize, async (req, res) => {
    res.set('Cache-Control', 'no-store')
    try {
      const card = await portalIdentity.getMyBusinessCard(
        req.auth.employeeCode
      )
      return res.status(200).json(card)
    } catch (error) {
      const known = error instanceof PortalError
      return res.status(known ? error.statusCode : 503).json({
        message: known ? error.message : 'serviceUnavailable',
      })
    }
  })

  return router
}
