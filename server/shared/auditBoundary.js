const path = require('path')
const express = require('express')

function failure(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode })
}

// eslint-disable-next-line no-control-regex
const CONTROL = /[\x00-\x1F\x7F]/
// eslint-disable-next-line no-control-regex
const MULTILINE_CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/

function text(value, maximum, required = true, multiline = false) {
  if (
    typeof value !== 'string' ||
    (required && !value.trim()) ||
    value.length > maximum ||
    (multiline ? MULTILINE_CONTROL : CONTROL).test(value)
  )
    throw failure('invalidRequest')
  return value
}

function integer(value) {
  if (!['number', 'string'].includes(typeof value))
    throw failure('invalidRequest')
  if (!/^[1-9]\d*$/.test(String(value))) throw failure('invalidRequest')
  const result = Number(value)
  if (!Number.isSafeInteger(result) || result > 2147483647)
    throw failure('invalidRequest')
  return result
}

// Stored filenames are also untrusted. Only a single filename can select a file.
function artifact(directory, filename) {
  text(filename, 255)
  if (
    /[\\/:]/.test(filename) ||
    /[.\s]$/.test(filename) ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(filename) ||
    filename === '.' ||
    filename === '..' ||
    path.basename(filename) !== filename
  )
    throw failure('serviceUnavailable', 503)
  return path.join(directory, filename)
}

async function connect(sql, config) {
  const pool = new sql.ConnectionPool(config)
  try {
    await pool.connect()
    return pool
  } catch (error) {
    await pool.close().catch(() => {})
    throw error
  }
}

// Express 4 does not forward rejected async handlers. Keep failures controlled.
function safeRouter() {
  const router = express.Router()
  for (const method of ['get', 'post', 'delete']) {
    const register = router[method].bind(router)
    router[method] = (route, ...handlers) =>
      register(
        route,
        ...handlers.map((handler) => (req, res, next) => {
          Promise.resolve()
            .then(() => handler(req, res, next))
            .catch((error) => {
              if (res.headersSent) return next(error)
              const errors = {
                invalidRequest: 400,
                forbidden: 403,
                stateConflict: 409,
                serviceUnavailable: 503,
                notFound: 404,
                inactiveEmployee: 403,
                invalidEmployeeCode: 400,
                cardNotFound: 404,
                authFailed: 401,
              }
              const known =
                Object.prototype.hasOwnProperty.call(errors, error.message) &&
                errors[error.message] === error.statusCode
              res
                .status(known ? error.statusCode : 503)
                .json({ message: known ? error.message : 'serviceUnavailable' })
            })
        })
      )
  }
  return router
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        character
      ])
  )
}

module.exports = {
  failure,
  text,
  integer,
  artifact,
  connect,
  safeRouter,
  escapeHtml,
}
