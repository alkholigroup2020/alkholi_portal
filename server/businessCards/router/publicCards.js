const express = require('express')
const { PublicCardError } = require('../services/publicCards')

module.exports = function createPublicCardsRouter(publicCards) {
  const router = express.Router()

  // Generated cards are deliberately public. No session or membership required.
  router.get('/public-cards/:employeeCode', async (req, res) => {
    res.set('Cache-Control', 'no-store')
    try {
      const card = await publicCards.getPublicCard(req.params.employeeCode)
      res.json(card)
    } catch (error) {
      if (error instanceof PublicCardError) {
        res.status(error.statusCode).json({ message: error.message })
      } else {
        res.status(503).json({ message: 'serviceUnavailable' })
      }
    }
  })

  // Express decodes route parameters before invoking the handler.
  router.use('/public-cards', (error, req, res, next) => {
    if (error instanceof URIError) {
      return res.status(400).json({ message: 'invalidEmployeeCode' })
    }
    next(error)
  })

  return router
}
