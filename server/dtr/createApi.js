const express = require('express')
const createDtrReadsRouter = require('./router/dtrReads')
const createLegacySqlRouter = require('./router/sqlCalls')

// Shared composition for production and isolated HTTP tests; no runtime imports.
module.exports = function createApi({
  authorize,
  requireDtrUser,
  dtrReads,
  legacySql,
  legacyActions,
}) {
  // Every DTR route requires a verified session and current DTR membership,
  // checked on the server for each request.
  const memberOnly = [authorize, requireDtrUser]

  const api = express()
  api.use(express.json())
  api.use(express.urlencoded({ extended: true }))
  api.use(createDtrReadsRouter({ memberOnly, dtrReads }))

  // Legacy write paths, unchanged until Phase 8 apart from the membership
  // check: the SQL gateway for submit/approve/decline and the save handler.
  api.use(createLegacySqlRouter({ ...legacySql, memberOnly }))
  api.post('/save-dtr-data', ...memberOnly)
  api.use(legacyActions)

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
