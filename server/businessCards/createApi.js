const path = require('path')
const express = require('express')
const createPublicCardsRouter = require('./router/publicCards')
const createCardManagementRouter = require('./router/cardManagement')

// Shared composition for production and isolated HTTP tests; no runtime imports.
module.exports = function createApi({
  authorize,
  requireCardsAdmin,
  publicCards,
  cardManagement,
  vCard,
  uploadDirectory = path.join(__dirname, '../../uploads/businessCards'),
}) {
  // Management routes require a verified session and current business-card
  // administrator membership, checked on the server for each request.
  const cardsAdminOnly = [authorize, requireCardsAdmin]

  const api = express()
  api.use(express.json())
  api.use(express.urlencoded({ extended: true }))
  // Public card, vCard and artifact routes stay reachable without a session.
  api.use(createPublicCardsRouter(publicCards))
  api.use(vCard)
  api.use(createCardManagementRouter({ cardsAdminOnly, cardManagement }))

  api.use('/business-cards', express.static(uploadDirectory))
  api.use('/vcard', express.static(uploadDirectory))

  // Unknown API routes must not fall through to Nuxt's page renderer.
  api.use((req, res) => res.status(404).json({ message: 'notFound' }))

  // Malformed bodies or percent-encoding get controlled JSON, never HTML/stacks.
  api.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    if (
      error instanceof URIError ||
      error.type === 'entity.parse.failed' ||
      error.type === 'entity.too.large'
    )
      return res.status(400).json({ message: 'invalidRequest' })
    return res.status(503).json({ message: 'serviceUnavailable' })
  })
  return api
}
