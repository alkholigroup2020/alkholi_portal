const express = require('express')
const router = express.Router()
const sql = require('mssql')
const sqlConfigs = require('../configs/sql')
const hrSQLConfigs = require('../configs/hrSQL')
const auth = require('../middleware/authorization')

class CustomError extends Error {
  constructor(message, errorCode) {
    super(message) // this will replace the default 'message' property in the error - so it always take the message property name
    // this.name = 'Error:'
    this.statusCode = errorCode
  }
}

router.post('/add-portal-admin', auth, async (req, res) => {
  try {
    // check if the member already exist
    await sql.connect(sqlConfigs)
    const checkUser =
      await sql.query`exec dbo.admin_members_checkIfExist ${req.body.code}`

    if (checkUser.recordset[0].exist === 1) {
      throw new CustomError('memberExist', 500)
    } else {
      // get member picture path
      await sql.close()
      await sql.connect(sqlConfigs)
      const memberPicPath = await sql.query`
        SELECT [portalProfilePicPath]
        FROM [alkholiPortal].[dbo].[usersInfo]
        where employeeID = ${req.body.code}
      `

      let memberPicturePath, hrPicture, portalPicture
      // if we have any info on the portal
      if (memberPicPath.recordset.length > 0) {
        // if he has no profile picture on the portal
        if (memberPicPath.recordset[0].portalProfilePicPath === null) {
          // get the info from HR system
          await sql.close()
          await sql.connect(hrSQLConfigs)
          const picPath = await sql.query`
            SELECT [employee_picture]
            FROM dbo.Pay_employees
            WHERE employee_code = ${req.body.code}
          `
          memberPicturePath = picPath.recordset[0].employee_picture
          hrPicture = true
          portalPicture = false
        } else {
          // if he has a profile picture on the portal
          memberPicturePath = memberPicPath.recordset[0].portalProfilePicPath
          hrPicture = false
          portalPicture = true
        }
      } else {
        // if we don't have any info on the portal
        await sql.close()
        await sql.connect(hrSQLConfigs)
        const picPath = await sql.query`
          SELECT [employee_picture]
          FROM dbo.Pay_employees
          WHERE employee_code = ${req.body.code}
        `
        // if no picture on HR system
        if (picPath.recordset.length <= 0) {
          memberPicturePath = 'profile.png'
          hrPicture = false
          portalPicture = true
        }
        // if no picture on HR system
        else if (picPath.recordset[0].employee_picture === '') {
          memberPicturePath = 'profile.png'
          hrPicture = false
          portalPicture = true
        } // if we get a path from HR system
        else {
          memberPicturePath = picPath.recordset[0].employee_picture
          hrPicture = true
          portalPicture = false
        }
      }

      // get member info from HR db
      await sql.close()
      await sql.connect(hrSQLConfigs)
      const memberInfo = await sql.query`
        SELECT [employee_code] ,[branch_code] ,[employee_name_eng] ,[Email] ,[position]
        FROM dbo.Pay_employees
        WHERE employee_code = ${req.body.code}
      `

      if (memberInfo.recordset.length <= 0) {
        throw new CustomError('employeeInfoMessing', 500)
      }
      const employeePositionCode = Number(memberInfo.recordset[0].position)

      const titleInfo = await sql.query`
        SELECT [system_desp_a], [system_desp_e]
        FROM [dbo].[pay_code_tables]
        where [system_code] =  ${employeePositionCode} and [branch_code] = ${memberInfo.recordset[0].branch_code}
        and system_code_type = '21'
      `

      if (titleInfo.recordset.length <= 0) {
        throw new CustomError('employeeInfoMessing', 500)
      }
      // save to the db
      await sql.close()
      await sql.connect(sqlConfigs)
      await sql.query`
        exec dbo.admin_members_addData ${memberInfo.recordset[0].employee_code},
        ${memberInfo.recordset[0].employee_name_eng}, ${titleInfo.recordset[0].system_desp_e},
        ${memberPicturePath} , ${memberInfo.recordset[0].Email},
        ${memberInfo.recordset[0].branch_code}, ${hrPicture}, ${portalPicture}
      `
      // prepare a reply object
      const result = {
        memberInfo: memberInfo.recordset[0],
        titleInfo: titleInfo.recordset[0],
        memberPicturePath,
        hrPicture,
        portalPicture,
      }
      res.status(200).send(result)
    }
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

router.post('/delete-portal-admin', auth, async (req, res) => {
  try {
    await sql.connect(sqlConfigs)
    const del =
      await sql.query`exec admin_members_deleteMember ${req.body.code}`
    if (del.rowsAffected[0] === 1) {
      res.status(200).json({
        message: `successfullyDeleted`,
      })
    } else {
      throw new CustomError('notFound', 500)
    }
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
