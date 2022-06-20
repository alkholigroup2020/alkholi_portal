const express = require('express')
const router = express.Router()
const sql = require('mssql')
const sqlConfigs = require('../configs/sql')
const authorize = require('../middleware/authorization.js')

async function portalDB() {
  const pool = new sql.ConnectionPool(sqlConfigs)
  try {
    await pool.connect()
    return pool
  } catch (err) {
    return err
  }
}

router.post('/get-user-authorizations', authorize, async (req, res) => {
  const portalDBConnection = await portalDB()
  try {
    const results = {
      isPortalAdmin: false,
      isBusinessCardsAdmin: false,
    }

    const isPortalAdmin = await portalDBConnection
      .request()
      .query(`exec dbo.admin_members_checkIfExist '${req.body.employeeID}'`)

    if (isPortalAdmin.recordset[0].exist) {
      results.isPortalAdmin = true
    }

    const isBusinessCardsAdmin = await portalDBConnection
      .request()
      .query(
        `exec dbo.business_card_admins_checkIfExist '${req.body.employeeID}'`
      )

    if (isBusinessCardsAdmin.recordset[0].exist) {
      results.isBusinessCardsAdmin = true
    }

    const isElevatorsSurveysUser = await portalDBConnection
      .request()
      .query(`exec dbo.elevators_users_checkIfExist '${req.body.employeeID}'`)

    if (isElevatorsSurveysUser.recordset[0].exist) {
      results.isElevatorsSurveysUser = true
    }

    const isHRSurveysUser = await portalDBConnection
      .request()
      .query(`exec dbo.hr_surveys_users_checkIfExist '${req.body.employeeID}'`)

    if (isHRSurveysUser.recordset[0].exist) {
      results.isHRSurveysUser = true
    }

    const isDTRUser = await portalDBConnection
      .request()
      .query(`exec dbo.dtr_users_checkIfExist '${req.body.employeeID}'`)

    if (isDTRUser.recordset[0].exist) {
      results.isDTRUser = true
    }

    res.status(200).send(results)
  } catch (e) {
    const error = e.toString()
    const newErrorString = error.replaceAll('Error: ', '')
    res.status(500).json({
      message: `${newErrorString}`,
    })
  } finally {
    await portalDBConnection.close()
  }
})

module.exports = router
