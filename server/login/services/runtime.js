const sql = require('mssql')
const Cryptr = require('cryptr')
const portalConfig = require('../configs/sql')
const hrConfig = require('../configs/hrSQL')
const adAuth = require('../utils/adAuth')
const { createRepository } = require('./repository')
const { createSessions } = require('./session')
const { createAuth } = require('./auth')

module.exports = createAuth({
  repository: createRepository({ sql, portalConfig, hrConfig }),
  sessions: createSessions(process.env.tokenKey),
  cipher: new Cryptr(process.env.encKey),
  adAuth,
})
