const express = require('express')
const createMembershipsRouter = require('./router/memberships')
const createDtrSetupRouter = require('./router/dtrSetup')

// Shared composition for production and isolated HTTP tests; no runtime imports.
module.exports = function createApi({
  authorize,
  requirePortalAdmin,
  memberships,
  dtrSetup,
}) {
  // Every administration route requires a verified session and current
  // portal-administrator membership, checked on the server for each request.
  const adminOnly = [authorize, requirePortalAdmin]

  const api = express()
  api.use(express.json())
  api.use(express.urlencoded({ extended: true }))
  api.use(createMembershipsRouter({ adminOnly, memberships }))
  api.use(createDtrSetupRouter({ adminOnly, dtrSetup }))

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
