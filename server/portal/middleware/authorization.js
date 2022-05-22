const sql = require('mssql')
const sqlConfigs = require('../configs/sql')

const auth = async (req, res, next) => {
  try {
    // throw new Error('authFailed')

    if (!req.header('Authorization')) throw new Error('authFailed')
    // get user token from the header
    const header = req.header('Authorization')
    const token = header.replace('Bearer ', '')
    // connect to SQL
    await sql.connect(sqlConfigs)
    // search for the token
    const isTheTokenExist =
      await sql.query`exec dbo.userTokens_checkIfExist ${token}`
    if (isTheTokenExist.recordset[0].token === 1) {
      // await sql.close()
      next()
    } else {
      throw new Error('authFailed')
    }
  } catch (e) {
    const error = e.toString()
    const newErrorString = error.replaceAll('Error: ', '')
    res.status(401).json({
      message: `${newErrorString}`,
    })
  }
  // finally {
  //   await sql.close()
  // }
}

module.exports = auth
