const config = {
  user: process.env.sqlUserName,
  // domain: process.env.sqlDomain,
  password: process.env.sqlPass,
  database: process.env.sqlDbName,
  server: process.env.sqlSrv,
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
