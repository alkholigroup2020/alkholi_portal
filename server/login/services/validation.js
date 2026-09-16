const { AuthError } = require('./errors')

const domains = Object.freeze({
  alkholi: '10.10.10.11',
  buildingtek: '10.11.10.11',
  upmoc: '10.12.10.11',
  'amos-sa': '10.13.10.11',
})

function isDomain(value) {
  return Object.prototype.hasOwnProperty.call(domains, value)
}

function isString(value, maxLength) {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= maxLength
  )
}

function validateLogin(body) {
  if (
    !body ||
    !isString(body.userAccount, 256) ||
    !isString(body.password, 4096) ||
    !isString(body.domain, 30)
  ) {
    throw new AuthError('invalidInput', 400)
  }
  const userAccount = body.userAccount.trim().toLowerCase()
  const domain = body.domain.trim().toLowerCase()
  if (
    !userAccount ||
    [...userAccount].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    ) ||
    !isDomain(domain)
  ) {
    throw new AuthError('invalidInput', 400)
  }
  // Never trim, lowercase, or otherwise transform the password.
  return { userAccount, password: body.password, domain }
}

module.exports = { domains, isDomain, isString, validateLogin }
