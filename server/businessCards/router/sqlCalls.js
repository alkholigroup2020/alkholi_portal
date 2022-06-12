const express = require('express')
const router = express.Router()
const sql = require('mssql')
const sqlConfigs = require('../configs/sql')
const hrSQLConfigs = require('../configs/hrSQL')
const auth = require('../middleware/authorization')

async function portalDB() {
  const pool = new sql.ConnectionPool(sqlConfigs)
  try {
    await pool.connect()
    return pool
  } catch (err) {
    return err
  }
}

async function hrDB() {
  const pool = new sql.ConnectionPool(hrSQLConfigs)
  try {
    await pool.connect()
    return pool
  } catch (err) {
    return err
  }
}

router.post('/sql-call', auth, async (req, res) => {
  const portalDBConnection = await portalDB()
  try {
    const theCall = await portalDBConnection
      .request()
      .query(`${req.body.query}`)
    res.send(theCall.recordset)
  } catch (e) {
    if (!e.statusCode) {
      const error = e.toString()
      const newErrorString = error.replaceAll('Error: ', '')
      res.status(500).json({
        message: `${newErrorString}`,
      })
    } else {
      res.status(e.statusCode).json({
        message: `${e.message}`,
      })
    }
  } finally {
    await portalDBConnection.close()
  }
})

router.post('/open-sql-call', async (req, res) => {
  const portalDBConnection = await portalDB()
  try {
    const theCall = await portalDBConnection
      .request()
      .query(`${req.body.query}`)
    res.send(theCall.recordset)
  } catch (e) {
    if (!e.statusCode) {
      const error = e.toString()
      const newErrorString = error.replaceAll('Error: ', '')
      res.status(500).json({
        message: `${newErrorString}`,
      })
    } else {
      res.status(e.statusCode).json({
        message: `${e.message}`,
      })
    }
  } finally {
    await portalDBConnection.close()
  }
})

router.get('/hr-sql-call', auth, async (req, res) => {
  const hrDBConnection = await hrDB()
  try {
    const theCall = await hrDBConnection.request().query(`${req.body.query}`)
    res.send(theCall.recordset)
  } catch (e) {
    if (!e.statusCode) {
      const error = e.toString()
      const newErrorString = error.replaceAll('Error: ', '')
      res.status(500).json({
        message: `${newErrorString}`,
      })
    } else {
      res.status(e.statusCode).json({
        message: `${e.message}`,
      })
    }
  } finally {
    await hrDBConnection.close()
  }
})

module.exports = router
