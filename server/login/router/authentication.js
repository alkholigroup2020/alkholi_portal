const express = require('express')
const router = express.Router()
const Cryptr = require('cryptr')
const cryptr = new Cryptr(process.env.encKey)
const jwt = require('jsonwebtoken')
const sql = require('mssql')
const sqlConfigs = require('../configs/sql')
const hrSQLConfigs = require('../configs/hrSQL')
const adAuth = require('../utils/adAuth')

class CustomError extends Error {
  constructor(message, errorCode) {
    super(message) // this will replace the default 'message' property in the error - so it always take the message property name
    // this.name = 'Error:'
    this.statusCode = errorCode
  }
}

const getMoreInfo = async (userEmail) => {
  try {
    // get more info from HR db
    await sql.connect(hrSQLConfigs)
    const moreInfo = await sql.query`
    SELECT [company_code],[employee_code],[branch_code],[employee_name_a],[first_name_a],[second_name_a],
    [third_name_a],[family_name_a],[employee_picture],[employee_name_eng],[first_name_e],[second_name_e],
    [third_name_e],[family_name_e],[Manager_Code],[Email]
    FROM dbo.Pay_employees
    WHERE Email = ${userEmail}
  `

    if (moreInfo.rowsAffected[0] === 0) {
      throw new Error('101')
    }

    const employeeInfo = await sql.query`
      SELECT [employee_code] ,[branch_code] ,[employee_name_eng] ,[first_name_e],[second_name_e] ,[Email] ,[position]
      FROM dbo.Pay_employees
      WHERE employee_code = ${moreInfo.recordset[0].employee_code}
    `

    if (employeeInfo.rowsAffected[0] === 0) {
      throw new Error('101')
    }

    const employeePositionCode = Number(employeeInfo.recordset[0].position)
    const titleInfo = await sql.query`
      SELECT [system_desp_a], [system_desp_e]
      FROM [dbo].[pay_code_tables]
      WHERE [system_code] =  ${employeePositionCode} and [branch_code] = ${employeeInfo.recordset[0].branch_code}
      AND system_code_type = '21'
    `

    if (titleInfo.rowsAffected[0] === 0) {
      throw new Error('102')
    }

    // add the title field to the returned object
    moreInfo.recordset[0].title = titleInfo.recordset[0].system_desp_e
    moreInfo.recordset[0].title_a = titleInfo.recordset[0].system_desp_a

    return moreInfo.recordset[0]
  } catch (e) {
    if (e.message === '101') {
      throw new CustomError('hrDataMissing', 404)
    } else if (e.message === '102') {
      throw new CustomError('hrTitleMissing', 404)
    } else {
      throw new CustomError(e.message, 500)
    }
  } finally {
    await sql.close()
  }
}

const getManagerInfo = async (managerCode) => {
  try {
    // get more info from HR db
    await sql.connect(hrSQLConfigs)

    const managerInfo = await sql.query`
    SELECT [Email]
    FROM dbo.Pay_employees
    WHERE employee_code = ${managerCode}
    `

    if (managerInfo.rowsAffected[0] === 0) {
      throw new Error('101')
    }

    return managerInfo.recordset[0]
  } catch (e) {
    if (e.message === '101') {
      throw new CustomError('hrManagerMessing', 404)
    } else {
      throw new CustomError(e.message, 500)
    }
  } finally {
    await sql.close()
  }
}

const saveToPortalDB = async (
  moreInfo,
  managerMail,
  user,
  encryptedPassword,
  token
) => {
  try {
    // connect to the db
    await sql.connect(sqlConfigs)

    // check if the user has a record in usersInfo table
    const checkUser =
      await sql.query`exec dbo.userInfo_checkIfExist ${moreInfo.employee_code}`

    // save user info in usersInfo table in db
    if (checkUser.recordset[0].employeeMail === 0) {
      await sql.query`exec dbo.usersInfo_addData ${moreInfo.employee_code},
      ${user.cn}, ${encryptedPassword}, ${moreInfo.company_code}, ${moreInfo.employee_picture},
      ${user.mail}, ${moreInfo.branch_code}, ${moreInfo.employee_name_a}, ${moreInfo.Manager_Code},
      ${managerMail}, ${moreInfo.title}, ${moreInfo.title_a}
    `
    } else {
      // update user data in db
      await sql.query`exec dbo.usersInfo_updateData ${moreInfo.employee_code},
      ${user.cn}, ${encryptedPassword}, ${moreInfo.company_code}, ${moreInfo.employee_picture},
      ${user.mail}, ${moreInfo.branch_code}, ${moreInfo.employee_name_a}, ${moreInfo.Manager_Code},
      ${managerMail}, ${moreInfo.title}, ${moreInfo.title_a}
    `
    }

    // save the token on db
    await sql.query`exec dbo.userTokens_addToken ${moreInfo.employee_code}, ${token}`
  } catch (e) {
    throw new CustomError(e.message, 500)
  } finally {
    await sql.close()
  }
}

router.post('/login', async (req, res) => {
  try {
    // authenticate with AD
    const user = await adAuth(
      req.body.userAccount,
      req.body.password,
      req.body.domain,
      req.body.dc_ip
    )

    // encrypt the user password
    const encryptedPassword = await cryptr.encrypt(req.body.password)

    // get user info fro HR db
    const moreInfo = await getMoreInfo(user.mail)

    // get manager email address from HR db
    const managerInfo = await getManagerInfo(moreInfo.Manager_Code)

    // generate a token
    const token = await jwt.sign(
      { userID: req.body.userAccount },
      process.env.tokenKey
    )

    // save all info to portal db
    await saveToPortalDB(
      moreInfo,
      managerInfo.Email,
      user,
      encryptedPassword,
      token
    )

    // prepare the userInfo to be sent back to the front end
    const userInfo = {
      token,
      user,
      moreInfo,
      managerInfo,
      domain: req.body.domain,
      userAccount: req.body.userAccount,
    }

    res.status(200).send(userInfo)
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
  }
})

module.exports = router
