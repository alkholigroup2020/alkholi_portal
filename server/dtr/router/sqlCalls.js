const express = require('express')

// LEGACY, UNSAFE: this gateway still runs SQL text sent by the browser. It is
// kept only until Phase 8 replaces the DTR submit/approve/decline callers
// (project-docs/security-fix-plan.md). Do not add callers or copy it.
// `/sql-call` and `/hr-sql-call` were retired in Phase 7.
module.exports = function createLegacySqlRouter({
  sql,
  portalConfig,
  memberOnly,
}) {
  const router = express.Router()

  async function portalDB() {
    const pool = new sql.ConnectionPool(portalConfig)
    try {
      await pool.connect()
      return pool
    } catch (err) {
      return err
    }
  }

  router.post('/sql-params-call', ...memberOnly, async (req, res) => {
    const portalDBConnection = await portalDB()
    try {
      // Create a new request object
      const request = portalDBConnection.request()

      // Add parameters to the request
      if (req.body.parameters) {
        for (const paramName in req.body.parameters) {
          const paramValue = req.body.parameters[paramName]
          request.input(paramName, paramValue)
        }
      }

      // Execute the query with parameterized inputs
      const theCall = await request.query(req.body.query)

      res.send(theCall.recordset)
    } catch (e) {
      if (!e.statusCode) {
        const error = e.toString()
        const newErrorString = error.replaceAll('Error: ', '')
        res.status(500).json({
          message: `${newErrorString}`,
        })
      } else {
        res.status(e.statusCode).json({
          message: `${e.message}`,
        })
      }
    } finally {
      await portalDBConnection.close()
    }
  })

  return router
}
