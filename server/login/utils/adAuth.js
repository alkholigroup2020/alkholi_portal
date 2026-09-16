const ldap = require('ldapjs')
const { createAdAuth } = require('./createAdAuth')

module.exports = createAdAuth({
  ldap,
  adminDN: process.env.adminDN,
  adminPassword: process.env.adAdminPassword,
})
