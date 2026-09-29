const express = require('express')
const { AdministrationError } = require('../services/memberships')

// Existing mutation URLs, each bound to one fixed membership resource.
const MUTATION_ROUTES = [
  ['portal', '/add-portal-admin', '/delete-portal-admin'],
  ['business-cards', '/add-business-card-admin', '/delete-business-card-admin'],
  ['coc', '/add-coc-admin', '/delete-coc-admin'],
  [
    'elevators',
    '/add-elevators-survey-admin',
    '/delete-elevators-survey-admin',
  ],
  ['hr-surveys', '/add-hr-survey-user', '/delete-hr-survey-user'],
  ['dtr', '/add-dtr-user', '/delete-dtr-user'],
]

function sendError(res, error) {
  const known = error instanceof AdministrationError
  return res.status(known ? error.statusCode : 503).json({
    message: known ? error.message : 'serviceUnavailable',
  })
}

function targetCode(req) {
  return req.body && typeof req.body === 'object' ? req.body.code : undefined
}

// `adminOnly` is [authorize, requirePortalAdmin]; the target employee in the
// body is validated separately and never establishes the caller's identity.
module.exports = function createMembershipsRouter({ adminOnly, memberships }) {
  const router = express.Router()

  router.get('/members/:module', ...adminOnly, async (req, res) => {
    res.set('Cache-Control', 'no-store')
    try {
      return res
        .status(200)
        .json(await memberships.listMembers(req.params.module))
    } catch (error) {
      return sendError(res, error)
    }
  })

  for (const [moduleName, addPath, deletePath] of MUTATION_ROUTES) {
    router.post(addPath, ...adminOnly, async (req, res) => {
      try {
        return res
          .status(200)
          .json(await memberships.addMember(moduleName, targetCode(req)))
      } catch (error) {
        return sendError(res, error)
      }
    })

    router.post(deletePath, ...adminOnly, async (req, res) => {
      try {
        return res
          .status(200)
          .json(await memberships.deleteMember(moduleName, targetCode(req)))
      } catch (error) {
        return sendError(res, error)
      }
    })
  }

  // Administrative HR lookup used by DTR setup assignment.
  router.post('/get-employee-info', ...adminOnly, async (req, res) => {
    try {
      return res
        .status(200)
        .json(await memberships.getEmployeeInfo(targetCode(req)))
    } catch (error) {
      return sendError(res, error)
    }
  })

  return router
}

module.exports.MUTATION_ROUTES = MUTATION_ROUTES
