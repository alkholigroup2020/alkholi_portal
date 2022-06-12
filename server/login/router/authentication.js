const express = require('express')
const router = express.Router()
const Cryptr = require('cryptr')
const cryptr = new Cryptr(process.env.encKey)
const jwt = require('jsonwebtoken')
const sql = require('mssql')
const sqlConfigs = require('../configs/sql')
const hrSQLConfigs = require('../configs/hrSQL')
const adAuth = require('../utils/adAuth')

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
class CustomError extends Error {
  constructor(message, errorCode) {
    super(message) // this will replace the default 'message' property in the error - so it always take the message property name
    // this.name = 'Error:'
    this.statusCode = errorCode
  }
}

const getMoreInfo = async (userEmail) => {
  const hrDBConnection = await hrDB()
  try {
    // get more info from HR db
    const moreInfo = await hrDBConnection.request().query(`
    SELECT [company_code],[employee_code],[branch_code],[employee_name_a],[first_name_a],[second_name_a],
    [third_name_a],[family_name_a],[employee_picture],[employee_name_eng],[first_name_e],[second_name_e],
    [third_name_e],[family_name_e],[Manager_Code],[Email]
    FROM dbo.Pay_employees
    WHERE Email = '${userEmail}'
  `)

    if (moreInfo.rowsAffected[0] === 0) {
      throw new Error('101')
    }

    const employeeInfo = await hrDBConnection.request().query(`
      SELECT [employee_code] ,[branch_code] ,[employee_name_eng] ,[first_name_e],[second_name_e] ,[Email] ,[position]
      FROM dbo.Pay_employees
      WHERE employee_code = '${moreInfo.recordset[0].employee_code}'
    `)

    if (employeeInfo.rowsAffected[0] === 0) {
      throw new Error('101')
    }

    const employeePositionCode = Number(employeeInfo.recordset[0].position)
    const titleInfo = await hrDBConnection.request().query(`
      SELECT [system_desp_a], [system_desp_e]
      FROM [dbo].[pay_code_tables]
      WHERE [system_code] =  '${employeePositionCode}' and [branch_code] = '${employeeInfo.recordset[0].branch_code}'
      AND system_code_type = '21'
    `)

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
    await hrDBConnection.close()
  }
}

const getManagerInfo = async (managerCode) => {
  const hrDBConnection = await hrDB()
  try {
    // get more info from HR db
    const managerInfo = await hrDBConnection.request().query(`
    SELECT [Email]
    FROM dbo.Pay_employees
    WHERE employee_code = '${managerCode}'
    `)

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
    await hrDBConnection.close()
  }
}

const saveToPortalDB = async (
  moreInfo,
  managerMail,
  user,
  encryptedPassword,
  token
) => {
  const portalDBConnection = await portalDB()
  try {
    // check if the user has a record in usersInfo table
    const checkUser = await portalDBConnection
      .request()
      .query(`exec dbo.userInfo_checkIfExist '${moreInfo.employee_code}'`)

    // save user info in usersInfo table in db
    if (checkUser.recordset[0].employeeMail === 0) {
      await portalDBConnection.request()
        .query(`exec dbo.usersInfo_addData '${moreInfo.employee_code}',
      '${user.cn}', '${encryptedPassword}', '${moreInfo.company_code}', N'${moreInfo.employee_picture}',
      '${user.mail}', '${moreInfo.branch_code}', N'${moreInfo.employee_name_a}', '${moreInfo.Manager_Code}',
      '${managerMail}', '${moreInfo.title}', N'${moreInfo.title_a}'
    `)
    } else {
      // update user data in db
      await portalDBConnection.request()
        .query(`exec dbo.usersInfo_updateData '${moreInfo.employee_code}',
      '${user.cn}', '${encryptedPassword}', '${moreInfo.company_code}', N'${moreInfo.employee_picture}',
      '${user.mail}', '${moreInfo.branch_code}', N'${moreInfo.employee_name_a}', '${moreInfo.Manager_Code}',
      '${managerMail}', '${moreInfo.title}', N'${moreInfo.title_a}'
    `)
    }

    // save the token on db
    await portalDBConnection
      .request()
      .query(
        `exec dbo.userTokens_addToken '${moreInfo.employee_code}', '${token}'`
      )
  } catch (e) {
    throw new CustomError(e.message, 500)
  } finally {
    await portalDBConnection.close()
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

router.post('/reauthenticate', async (req, res) => {
  const portalDBConnection = await portalDB()
  try {
    // connect to the db & get the user password
    const loggedInUser = await portalDBConnection
      .request()
      .query(`exec usersInfo_getGroupID '${req.body.mail}'`)

    const userGroupID = loggedInUser.recordset[0].groupID

    const dcIP = () => {
      if (req.body.domainName === 'alkholi') {
        return '10.10.10.11'
      } else if (req.body.domainName === 'buildingtek') {
        return '10.11.10.11'
      } else if (req.body.domainName === 'upmoc') {
        return '10.12.10.11'
      } else if (req.body.domainName === 'amos-sa') {
        return '10.13.10.11'
      }
    }

    // const domainName = domainResult()
    const domainIP = dcIP()

    const userPass = cryptr.decrypt(userGroupID)

    // re-authenticate the user with AD
    const user = await adAuth(
      req.body.userAccount,
      userPass,
      req.body.domainName,
      domainIP
    )

    res.status(200).json({ message: `${user.mail}` })
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

router.post('/logoff', async (req, res) => {
  const portalDBConnection = await portalDB()
  try {
    // delete the token
    const deletedToken = await portalDBConnection
      .request()
      .query(`exec usersInfo_deleteToken '${req.body.token}'`)
    if (deletedToken.rowsAffected[0] === 1) {
      res.send()
    } else {
      throw new CustomError('Something Went Wrong!!', 503)
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
    await portalDBConnection.close()
  }
})

module.exports = router
