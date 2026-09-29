const express = require('express')

// LEGACY TRANSITION ROUTES (Phase 5 removes them): these still execute SQL text
// supplied by the browser. They are limited to portal administrators because
// their only callers are the DTR setup pages, but role gating does not make
// arbitrary SQL safe for the administrators who can reach them.
module.exports = function createSqlCallsRouter({
  sql,
  portalConfig,
  hrConfig,
  adminOnly,
}) {
  const router = express.Router()

  async function runLegacyQuery(config, query) {
    const pool = new sql.ConnectionPool(config)
    try {
      await pool.connect()
      const result = await pool.request().query(`${query}`)
      return result.recordset
    } finally {
      await pool.close().catch(() => {})
    }
  }

  function handler(config) {
    return async (req, res) => {
      try {
        const query = req.body && req.body.query
        if (typeof query !== 'string' || !query.trim())
          return res.status(400).json({ message: 'invalidRequest' })
        return res.send(await runLegacyQuery(config, query))
      } catch {
        // Never return database/exception text to the browser.
        return res.status(503).json({ message: 'serviceUnavailable' })
      }
    }
  }

  router.post('/sql-call', ...adminOnly, handler(portalConfig))
  router.post('/hr-sql-call', ...adminOnly, handler(hrConfig))

  return router
}
