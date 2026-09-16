const { AuthError } = require('../services/errors')
const { domains, isDomain } = require('../services/validation')

function escapeFilter(value) {
  return value
    .replace(
      /[\\*()]/g,
      (character) =>
        `\\${character.charCodeAt(0).toString(16).padStart(2, '0')}`
    )
    .replaceAll('\0', '\\00')
}

function createAdAuth({ ldap, adminDN, adminPassword, timeoutMs = 10000 }) {
  return (userAccount, password, domain) =>
    new Promise((resolve, reject) => {
      if (
        !isDomain(domain) ||
        typeof userAccount !== 'string' ||
        !userAccount ||
        typeof password !== 'string' ||
        !password
      ) {
        reject(new AuthError('authFailed'))
        return
      }
      let client
      let settled = false
      const timer = setTimeout(
        () => finish(new AuthError('adConnectionError', 503)),
        timeoutMs
      )
      function finish(error, user) {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (client) {
          try {
            client.destroy()
          } catch {}
        }
        if (error) reject(error)
        else resolve(user)
      }
      function guarded(operation) {
        return (...args) => {
          if (settled) return
          try {
            return operation(...args)
          } catch {
            finish(new AuthError('adConnectionError', 503))
          }
        }
      }
      try {
        client = ldap.createClient({
          url: [`ldaps://${domains[domain]}:636`],
          timeout: 2000,
          connectTimeout: 5000,
          tlsOptions: { rejectUnauthorized: false }, // Certificate migration is deferred.
        })
        client.on('error', () =>
          finish(new AuthError('adConnectionError', 503))
        )
        client.bind(
          adminDN,
          adminPassword,
          guarded((error) => {
            if (settled) return
            if (error) return finish(new AuthError('adConnectionError', 503))
            client.search(
              `DC=${domain},DC=com`,
              {
                filter: `(sAMAccountName=${escapeFilter(userAccount)})`,
                scope: 'sub',
                attributes: ['dn', 'mail', 'givenName', 'cn', 'sAMAccountName'],
              },
              guarded((error, response) => {
                if (settled) return
                if (error) return finish(new AuthError('authFailed'))
                const entries = []
                response.on(
                  'searchEntry',
                  guarded((entry) => {
                    if (!settled) entries.push(entry.object)
                  })
                )
                response.on('error', () => finish(new AuthError('authFailed')))
                response.on(
                  'end',
                  guarded((result) => {
                    if (settled) return
                    if (result.status !== 0)
                      return finish(new AuthError('authFailed'))
                    if (entries.length !== 1 || !entries[0].dn)
                      return finish(new AuthError('wrongUser'))
                    client.bind(
                      entries[0].dn,
                      password,
                      guarded((error) => {
                        if (error) return finish(new AuthError('wrongPassword'))
                        finish(null, entries[0])
                      })
                    )
                  })
                )
              })
            )
          })
        )
      } catch {
        finish(new AuthError('adConnectionError', 503))
      }
    })
}

module.exports = { createAdAuth, escapeFilter }
