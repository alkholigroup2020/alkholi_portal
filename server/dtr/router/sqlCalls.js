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

router.post('/sql-params-call', auth, async (req, res) => {
  const portalDBConnection = await portalDB()
  try {
    // Create a new request object
    const request = portalDBConnection.request()

    // Add parameters to the request
    if (req.body.parameters) {
      for (const paramName in req.body.parameters) {
        const paramValue = req.body.parameters[paramName]
        request.input(paramName, paramValue)
      }
    }

    // Execute the query with parameterized inputs
    const theCall = await request.query(req.body.query)

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

router.post('/hr-sql-call', auth, async (req, res) => {
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
