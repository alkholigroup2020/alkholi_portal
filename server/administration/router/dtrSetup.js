const express = require('express')
const { AdministrationError } = require('../services/memberships')

function sendError(res, error) {
  const known = error instanceof AdministrationError
  return res.status(known ? error.statusCode : 503).json({
    message: known ? error.message : 'serviceUnavailable',
  })
}

// `adminOnly` is [authorize, requirePortalAdmin]. Path values and the target
// employee are validated by the service and never establish the caller.
module.exports = function createDtrSetupRouter({ adminOnly, dtrSetup }) {
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

  // kind: companies | branches | divisions | departments | projects | sub-projects
  router.get(
    '/dtr-setup/organization/:kind',
    ...adminOnly,
    read((req) => dtrSetup.listOrganization(req.params.kind, req.query))
  )

  // level: division | department | project | sub-project
  router.get(
    '/dtr-setup/employees/:level',
    ...adminOnly,
    read((req) => dtrSetup.listEmployees(req.params.level, req.query))
  )

  router.get(
    '/dtr-setup/assignments/:level',
    ...adminOnly,
    read((req) => dtrSetup.listAssignments(req.params.level, req.query))
  )

  router.post(
    '/dtr-setup/assignments/:level',
    ...adminOnly,
    async (req, res) => {
      try {
        return res
          .status(201)
          .json(await dtrSetup.createAssignment(req.params.level, req.body))
      } catch (error) {
        return sendError(res, error)
      }
    }
  )

  return router
}
