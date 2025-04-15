const config = {
  user: process.env.hrSQLUserName,
  domain: process.env.hrSQLDomain,
  password: process.env.hrSQLPassword,
  database: process.env.hrSQLdbName,
  server: process.env.hrSQLServer,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: true, // for azure
    trustServerCertificate: true, // change to true for local dev / self-signed certs
  },
}
module.exports = config
