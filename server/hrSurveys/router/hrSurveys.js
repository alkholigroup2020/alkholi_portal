const path = require('path')
const express = require('express')
const router = express.Router()
const { MongoClient, ObjectId } = require('mongodb')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const sql = require('mssql')
const sqlConfigs = require('../configs/sql')
const hrSQLConfigs = require('../configs/hrSQL')
const auth = require('../middleware/auth')

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

const uri = `mongodb://${process.env.hrSurvey_dbUser}:${process.env.hrSurvey_dbPassword}@${process.env.hrSurvey_dbServerIP}/`
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

router.get('/get-hr-survey-data', auth, async (req, res) => {
  try {
    await client.connect()
    const allData = await client
      .db('hr-engagement-survey')
      .collection('survey')
      .find()
      .toArray()
    res.send(allData)
  } catch (error) {
    res.status(500).json({
      message: `${error}`,
    })
  } finally {
    await client.close()
  }
})

router.post('/get-single-hr-survey', auth, async (req, res) => {
  try {
    await client.connect()
    const surveyData = await client
      .db('hr-engagement-survey')
      .collection('survey')
      .findOne({ _id: ObjectId(req.body.id) })
    res.send(surveyData)
  } catch (error) {
    res.status(500).json({
      message: `${error}`,
    })
  } finally {
    await client.close()
  }
})

router.post('/get-survey-employee-data', auth, async (req, res) => {
  const portalDBConnection = await portalDB()

  const hrDBConnection = await hrDB()

  try {
    // get member picture path

    const memberPicPath = await portalDBConnection.request().query(`
        SELECT [portalProfilePicPath]
        FROM [alkholiPortal].[dbo].[usersInfo]
        where employeeID = '${req.body.code}'
      `)

    let memberPicturePath, hrPicture, portalPicture

    // if we have any info on the portal
    if (memberPicPath.recordset.length > 0) {
      // if he has no profile picture on the portal
      if (memberPicPath.recordset[0].portalProfilePicPath === null) {
        // get the info from HR system
        const picPath = await hrDBConnection.request().query(`
            SELECT [employee_picture]
            FROM dbo.Pay_employees
            WHERE employee_code = '${req.body.code}'
          `)
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
      const picPath = await hrDBConnection.request().query(`
          SELECT [employee_picture]
          FROM dbo.Pay_employees
          WHERE employee_code = '${req.body.code}'
        `)
      // if no picture on HR system
      if (picPath.recordset.length <= 0) {
        memberPicturePath = 'anonymousProfilePicture.jpeg'
        hrPicture = false
        portalPicture = true
      }
      // if no picture on HR system
      else if (picPath.recordset[0].employee_picture === '') {
        memberPicturePath = 'anonymousProfilePicture.jpeg'
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
    const memberInfo = await hrDBConnection.request().query(`
        SELECT [employee_code] ,[branch_code] ,[employee_name_eng] ,[Email] ,[position]
        FROM dbo.Pay_employees
        WHERE employee_code = '${req.body.code}'
      `)
    if (memberInfo.recordset.length <= 0) {
      res.status(205).send()
      return
    }
    const employeePositionCode = Number(memberInfo.recordset[0].position)

    const titleInfo = await hrDBConnection.request().query(`
        SELECT [system_desp_a], [system_desp_e]
        FROM [dbo].[pay_code_tables]
        where [system_code] =  '${employeePositionCode}' and [branch_code] = '${memberInfo.recordset[0].branch_code}'
        and system_code_type = '21'
      `)
    if (titleInfo.recordset.length <= 0) {
      res.status(205).send()
      return
    }

    // prepare a reply object
    const result = {
      memberInfo: memberInfo.recordset[0],
      titleInfo: titleInfo.recordset[0],
      memberPicturePath,
      hrPicture,
      portalPicture,
    }
    res.status(200).send(result)
  } catch (error) {
    res.status(500).json({
      message: `${error}`,
    })
  } finally {
    await portalDBConnection.close()
    await hrDBConnection.close()
  }
})

router.post('/export-csv-data', auth, async (req, res) => {
  try {
    const csvWriter = createCsvWriter({
      path: `${path.join(
        __dirname,
        '../../../uploads/exportedFiles/results-summary.csv'
      )}`,
      header: [
        { id: 'question', title: 'Question' },
        { id: 'stronglyAgree', title: 'Strongly Agree' },
        { id: 'agree', title: 'Agree' },
        { id: 'neither', title: 'Neither Agree nor Disagree' },
        { id: 'notAgree', title: "Don't Agree" },
        { id: 'stronglyNotAgree', title: "Strongly Don't Agree" },
      ],
    })

    const records = []

    req.body.forEach((element) => {
      const A = Object.keys(element)
      const B = Object.values(element)
      const record = { question: A[0] }
      record.stronglyAgree = B[0][0]
      record.agree = B[0][1]
      record.neither = B[0][2]
      record.notAgree = B[0][3]
      record.stronglyNotAgree = B[0][4]
      records.push(record)
    })

    await csvWriter.writeRecords(records) // returns a promise

    res.send()
  } catch (error) {
    res.status(500).json({
      message: `${error}`,
    })
  }
})

module.exports = router
