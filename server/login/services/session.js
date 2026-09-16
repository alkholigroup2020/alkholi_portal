const { randomBytes } = require('crypto')
const jwt = require('jsonwebtoken')
const { AuthError } = require('./errors')
const { isDomain, isString } = require('./validation')

const TOKEN_MAX_LENGTH = 300
const SESSION_VERSION = 1

function createSessions(tokenKey) {
  function verify(token) {
    try {
      if (!isString(token, TOKEN_MAX_LENGTH) || !tokenKey)
        throw new Error('Invalid token')
      const claims = jwt.verify(token, tokenKey, { algorithms: ['HS256'] })
      if (
        claims.v !== SESSION_VERSION ||
        !isString(claims.jti, 32) ||
        !/^[a-f0-9]{32}$/.test(claims.jti) ||
        !isString(claims.e, 20) ||
        !isString(claims.a, 256) ||
        !isString(claims.d, 30) ||
        !isDomain(claims.d) ||
        !Number.isFinite(claims.iat)
      )
        throw new Error('Invalid identity')
      return {
        employeeCode: claims.e,
        userAccount: claims.a,
        domain: claims.d,
        sessionId: claims.jti,
        token,
      }
    } catch {
      throw new AuthError('authFailed')
    }
  }

  return {
    issue({ employeeCode, userAccount, domain }) {
      if (
        !tokenKey ||
        !isString(employeeCode, 20) ||
        !isString(userAccount, 256) ||
        !isDomain(domain)
      ) {
        throw new AuthError('accountDataInvalid', 503)
      }
      // Compact names keep identity-bearing tokens within existing varchar(300).
      // Retain the existing session lifetime: revocation in SQL, no new expiry.
      const token = jwt.sign(
        {
          v: SESSION_VERSION,
          jti: randomBytes(16).toString('hex'),
          e: employeeCode,
          a: userAccount,
          d: domain,
        },
        tokenKey,
        { algorithm: 'HS256' }
      )
      if (token.length > TOKEN_MAX_LENGTH)
        throw new AuthError('accountDataInvalid', 503)
      return token
    },
    verify,
    fromRequest(req) {
      const header = req.header('Authorization')
      if (typeof header !== 'string' || !/^Bearer [^\s]+$/i.test(header))
        throw new AuthError('authFailed')
      return verify(header.slice(7))
    },
  }
}

module.exports = { createSessions, TOKEN_MAX_LENGTH }
