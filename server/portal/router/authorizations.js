const express = require('express')
const router = express.Router()
const sql = require('mssql')
const sqlConfigs = require('../configs/sql')
const authorize = require('../middleware/authorization.js')

router.post('/get-user-authorizations', authorize, async (req, res) => {
  try {
    const results = {
      isPortalAdmin: false,
      isBusinessCardsAdmin: false,
    }

    await sql.connect(sqlConfigs)

    const isPortalAdmin =
      await sql.query`exec dbo.admin_members_checkIfExist ${req.body.employeeID}`

    if (isPortalAdmin.recordset[0].exist) {
      results.isPortalAdmin = true
    }

    const isBusinessCardsAdmin =
      await sql.query`exec dbo.business_card_admins_checkIfExist ${req.body.employeeID}`

    if (isBusinessCardsAdmin.recordset[0].exist) {
      results.isBusinessCardsAdmin = true
    }

    const isElevatorsSurveysUser =
      await sql.query`exec dbo.elevators_users_checkIfExist ${req.body.employeeID}`

    if (isElevatorsSurveysUser.recordset[0].exist) {
      results.isElevatorsSurveysUser = true
    }

    const isHRSurveysUser =
      await sql.query`exec dbo.hr_surveys_users_checkIfExist ${req.body.employeeID}`

    if (isHRSurveysUser.recordset[0].exist) {
      results.isHRSurveysUser = true
    }

    res.status(200).send(results)
  } catch (e) {
    const error = e.toString()
    const newErrorString = error.replaceAll('Error: ', '')
    res.status(500).json({
      message: `${newErrorString}`,
    })
  } finally {
    await sql.close()
  }
})

module.exports = router
