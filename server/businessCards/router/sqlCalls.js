const express = require('express')
const router = express.Router()
const sql = require('mssql')
const sqlConfigs = require('../configs/sql')
const hrSQLConfigs = require('../configs/hrSQL')
const auth = require('../middleware/authorization')

router.post('/sql-call', auth, async (req, res) => {
  try {
    await sql.connect(sqlConfigs)
    const theCall = await sql.query(`${req.body.query}`)
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
    await sql.close()
  }
})
router.post('/open-sql-call', async (req, res) => {
  try {
    await sql.connect(sqlConfigs)
    const theCall = await sql.query(`${req.body.query}`)
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
    await sql.close()
  }
})

router.get('/hr-sql-call', auth, async (req, res) => {
  try {
    await sql.connect(hrSQLConfigs)
    const theCall = await sql.query(`${req.body.query}`)
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
    await sql.close()
  }
})

module.exports = router
