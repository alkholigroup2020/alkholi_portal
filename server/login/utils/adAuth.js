const ldap = require('ldapjs')

const adAuth = (userAccount, password, domain, dcIP) => {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({
      url: [`ldaps://${dcIP}:636`], // Changed to ldaps:// and port 636
      timeout: 2000,
      connectTimeout: 5000,
      tlsOptions: {
        rejectUnauthorized: false,
      },
    })
    client.bind(
      process.env.adminDN,
      process.env.adAdminPassword,
      function (err) {
        if (err) {
          return reject(new Error('adConnectionError'))
        }
        // search for the provided email!
        client.search(
          // search base
          `DC=${domain},DC=com`,
          // options
          {
            filter: `(sAMAccountName=${userAccount})`,
            scope: 'sub',
            attributes: ['dn', 'mail', 'givenName', 'cn'],
          },
          function (error, response) {
            if (error) {
              return reject(new Error('authFailed'))
            }
            const entries = []
            let referrals = []
            response.on('searchEntry', function (entry) {
              entries.push(entry.object)
            })

            response.on('searchReference', (referral) => {
              referrals = referrals.concat(referral.uris)
            })

            response.on('error', function () {
              return reject(new Error('authFailed'))
            })

            response.on('end', (result) => {
              if (result.status !== 0) {
                return reject(new Error('authFailed'))
              }
              // to solve the issue of wrong username
              if (!entries[0]) {
                return reject(new Error('wrongUser'))
              }
              // authenticate the user using his password against AD
              client.bind(entries[0].dn, password, function (err) {
                if (err) {
                  return reject(new Error('wrongPassword'))
                }
                const fullInfo = {
                  entries,
                  referrals,
                }
                return resolve(fullInfo.entries[0])
              })
            })
          }
        )
      }
    )
    // trying to ignore the reset error that crashes the app!
    client.on('error', function () {})
  })
}

module.exports = adAuth
