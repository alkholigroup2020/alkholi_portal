const path = require('path')
const express = require('express')
const createPublicCardsRouter = require('./router/publicCards')

// Shared composition for production and isolated HTTP tests; no runtime imports.
module.exports = function createApi({
  publicCards,
  businessCards,
  vCard,
  sqlCalls,
}) {
  const api = express()
  api.use(express.json())
  api.use(express.urlencoded({ extended: true }))
  api.use(createPublicCardsRouter(publicCards))
  api.use(businessCards)
  api.use(vCard)
  api.use(sqlCalls)

  api.use(
    '/business-cards',
    express.static(path.join(__dirname, '../../uploads/businessCards'))
  )
  api.use(
    '/vcard',
    express.static(path.join(__dirname, '../../uploads/businessCards'))
  )

  // Unknown API routes must not fall through to Nuxt's page renderer.
  api.use((req, res) => res.status(404).json({ message: 'notFound' }))
  return api
}
