const auth = require('../services/runtime')
const createRouter = require('./createRouter')

module.exports = createRouter(auth)
