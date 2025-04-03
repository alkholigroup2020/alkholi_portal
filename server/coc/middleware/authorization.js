const sql = require('mssql')
const sqlConfigs = require('../configs/sql')

async function portalDB() {
  const pool = new sql.ConnectionPool(sqlConfigs)
  try {
    await pool.connect()
    return pool
  } catch (err) {
    return err
  }
}

const auth = async (req, res, next) => {
  const portalDBConnection = await portalDB()
  try {
    if (!req.header('Authorization')) throw new Error('authFailed')
    // get user token from the header
    const header = req.header('Authorization')
    const token = header.replace('Bearer ', '')

    // search for the token
    const isTheTokenExist = await portalDBConnection
      .request()
      .query(`exec dbo.userTokens_checkIfExist '${token}'`)
    if (isTheTokenExist.recordset[0].token === 1) {
      await sql.close()
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
  } finally {
    await portalDBConnection.close()
  }
}

module.exports = auth
