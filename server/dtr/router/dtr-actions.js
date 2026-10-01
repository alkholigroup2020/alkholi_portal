const express = require('express')
const { DtrError } = require('../services/dtrReads')

module.exports = function createDtrActionsRouter({ memberOnly, dtrWrites }) {
  const router = express.Router()
  function write(operation) {
    return async (req, res) => {
      res.set('Cache-Control', 'no-store')
      try {
        return res
          .status(200)
          .json(await operation(req.auth.employeeCode, req.body))
      } catch (error) {
        return res
          .status(error instanceof DtrError ? error.statusCode : 503)
          .json({
            message:
              error instanceof DtrError ? error.message : 'serviceUnavailable',
          })
      }
    }
  }
  router.post(
    '/save-dtr-data',
    ...memberOnly,
    write((caller, body) => dtrWrites.save(caller, body))
  )
  router.post(
    '/submit',
    ...memberOnly,
    write((caller, body) => dtrWrites.act(caller, 'submit', body))
  )
  router.post(
    '/approve',
    ...memberOnly,
    write((caller, body) => dtrWrites.act(caller, 'approve', body))
  )
  router.post(
    '/decline',
    ...memberOnly,
    write((caller, body) => dtrWrites.act(caller, 'decline', body))
  )
  router.post(
    '/bulk-submit',
    ...memberOnly,
    write((caller, body) => dtrWrites.act(caller, 'submit', body, true))
  )
  router.post(
    '/bulk-approve',
    ...memberOnly,
    write((caller, body) => dtrWrites.act(caller, 'approve', body, true))
  )
  return router
}
