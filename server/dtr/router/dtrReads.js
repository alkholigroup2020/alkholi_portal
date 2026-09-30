const express = require('express')
const { DtrError } = require('../services/dtrReads')

function sendError(res, error) {
  const known = error instanceof DtrError
  return res.status(known ? error.statusCode : 503).json({
    message: known ? error.message : 'serviceUnavailable',
  })
}

// `memberOnly` is [authorize, requireDtrUser]. The caller is always
// `req.auth.employeeCode`; path and query values only name the period and the
// employee being read, and the service checks that employee against the
// caller's own assignments or pending approvals.
module.exports = function createDtrReadsRouter({ memberOnly, dtrReads }) {
  const router = express.Router()

  function read(operation) {
    return async (req, res) => {
      res.set('Cache-Control', 'no-store')
      try {
        return res.status(200).json(await operation(req))
      } catch (error) {
        return sendError(res, error)
      }
    }
  }

  router.get(
    '/assigned-employees',
    ...memberOnly,
    read((req) => dtrReads.listAssignedEmployees(req.auth.employeeCode))
  )

  // query: start, end (YYYY-MM-DD) and optionally employeeCode
  router.get(
    '/period-entries',
    ...memberOnly,
    read((req) => dtrReads.listPeriodEntries(req.auth.employeeCode, req.query))
  )

  // query: start, end (YYYY-MM-DD)
  router.get(
    '/pending-approvals',
    ...memberOnly,
    read((req) =>
      dtrReads.listPendingApprovals(req.auth.employeeCode, req.query)
    )
  )

  router.get(
    '/employees/:employeeCode',
    ...memberOnly,
    read((req) =>
      dtrReads.getEmployee(req.auth.employeeCode, req.params.employeeCode)
    )
  )

  // query: start, end (YYYY-MM-DD)
  router.get(
    '/employees/:employeeCode/calendar',
    ...memberOnly,
    read((req) =>
      dtrReads.getCalendar(
        req.auth.employeeCode,
        req.params.employeeCode,
        req.query
      )
    )
  )

  return router
}
