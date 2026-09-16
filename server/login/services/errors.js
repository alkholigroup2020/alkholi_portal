class AuthError extends Error {
  constructor(message, statusCode = 401) {
    super(message)
    this.statusCode = statusCode
  }
}

function sendAuthError(res, error) {
  const known = error instanceof AuthError
  return res.status(known ? error.statusCode : 503).json({
    message: known ? error.message : 'serviceUnavailable',
  })
}

module.exports = { AuthError, sendAuthError }
