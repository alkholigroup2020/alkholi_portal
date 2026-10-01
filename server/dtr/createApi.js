const express = require('express')
const createDtrReadsRouter = require('./router/dtrReads')
const createDtrActionsRouter = require('./router/dtr-actions')

// Shared composition for production and isolated HTTP tests; no runtime imports.
module.exports = function createApi({
  authorize,
  requireDtrUser,
  dtrReads,
  dtrWrites,
}) {
  // Every DTR route requires a verified session and current DTR membership,
  // checked on the server for each request.
  const memberOnly = [authorize, requireDtrUser]

  const api = express()
  api.use(express.json({ limit: '1mb' }))
  api.use(express.urlencoded({ extended: false, limit: '1mb' }))
  api.use(createDtrReadsRouter({ memberOnly, dtrReads }))

  api.use(createDtrActionsRouter({ memberOnly, dtrWrites }))

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
