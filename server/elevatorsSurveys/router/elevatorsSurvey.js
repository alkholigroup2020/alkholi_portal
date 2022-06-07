const path = require('path')
const express = require('express')
const router = express.Router()
const { MongoClient } = require('mongodb')
const nodemailer = require('nodemailer')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const auth = require('../middleware/auth')

const uri = `mongodb://${process.env.dbUser}:${process.env.dbPassword}@${process.env.dbServerIP}/`
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

router.post('/send-survey-request', auth, async (req, res) => {
  try {
    // save a record to the db
    await client.connect()
    await client.db('survey').collection('specificClients').insertOne(req.body)

    // send mail
    const transporter = nodemailer.createTransport({
      host: '10.11.10.20',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: 'info@buildingtec.com',
        pass: process.env.btecInfoAccPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
    })

    await transporter.sendMail({
      from: '"Buildingtec Elevators" <info@buildingtec.com>',
      to: `${req.body.customerEmail}`,
      subject: 'Survey Request.',
      html: `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta http-equiv="X-UA-Compatible" content="IE=edge" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Survey Request</title>
          </head>
          <body>
            <div>
              <pre style="font-size: 16px; font-family:'Times New Roman', serif; color: #212121">${req.body.mailBody}</pre>
              <p>
                Please follow this
                <a href="https://www.buildingtec-elevators.com/survey/${req.body.contractID}"
                  ><b>link</b></a
                >
                to take the survey.
              </p>
            </div>
            <div style="text-align: right;">
              <pre style="font-size: 16px; font-family:'Times New Roman', serif; color: #212121">${req.body.arabicMessage}</pre>
              <p>
              تفضــل بإكمــال الإستبــيان من
              <a href="https://www.buildingtec-elevators.com/ar/survey/${req.body.contractID}"
                ><b>هــنا</b></a
              >
              </p>
            </div>
          </body>
        </html>
      `,
    })
    res.send()
  } catch (error) {
    const myJSON = JSON.stringify(error)
    if (myJSON.includes('11000')) {
      res.status(501).json({
        message: `Duplicate Contract ID`,
      })
    } else {
      res.status(500).json({
        message: `${error}`,
      })
    }
  } finally {
    await client.close()
  }
})

router.get('/get-clients-survey-data', auth, async (req, res) => {
  try {
    await client.connect()
    const allData = await client
      .db('survey')
      .collection('specificClients')
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

router.get('/get-anonymous-survey-data', auth, async (req, res) => {
  try {
    await client.connect()
    const allData = await client
      .db('survey')
      .collection('clients')
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

router.post('/export-clients-csv-data', auth, async (req, res) => {
  try {
    const csvWriter = createCsvWriter({
      path: `${path.join(
        __dirname,
        '../../../uploads/exportedFiles/surveys-results.csv'
      )}`,
      header: [
        { id: 'contractID', title: 'Contract ID' },
        { id: 'clientName', title: 'Client Name' },
        { id: 'projectName', title: 'Project Name' },
        { id: 'emailAddress', title: 'Email Address' },
        { id: 'mobileNumber', title: 'Mobile Number' },
        { id: 'experienceLevel', title: 'Experience Level' },
        { id: 'serviceQuality', title: 'Service Quality' },
        { id: 'deliveryTime', title: 'Delivery Time' },
        { id: 'installationTime', title: 'Installation Time' },
        { id: 'employeesBehavior', title: 'Employees Behavior' },
        { id: 'productRating', title: 'Product Rating' },
        { id: 'clientMessage', title: 'Client Message' },
      ],
    })

    await client.connect()
    const allData = await client
      .db('survey')
      .collection('specificClients')
      .find()
      .toArray()

    const records = []

    allData.forEach((element) => {
      const record = { contractID: element.contractID }
      record.clientName = element.clientName
      record.projectName = element.projectName
      record.emailAddress = element.customerEmail
      record.mobileNumber = element.customerMobileNumber
      record.experienceLevel = element.Client_Experience_Level
      record.serviceQuality = element.Service_Quality
      record.deliveryTime = element.Delivery_Time
      record.installationTime = element.Installation_Time
      record.employeesBehavior = element.Employees_Behavior
      record.productRating = element.Product_Rating
      record.clientMessage = element.Client_Message
      records.push(record)
    })

    await csvWriter.writeRecords(records) // returns a promise

    res.send(allData)
  } catch (error) {
    res.status(500).json({
      message: `${error}`,
    })
  } finally {
    await client.close()
  }
})

router.post('/export-anonymous-csv-data', auth, async (req, res) => {
  try {
    const csvWriter = createCsvWriter({
      path: `${path.join(
        __dirname,
        '../../../uploads/exportedFiles/surveys-results.csv'
      )}`,
      header: [
        { id: 'contractID', title: 'Contract ID' },
        { id: 'clientName', title: 'Client Name' },
        { id: 'projectName', title: 'Project Name' },
        { id: 'emailAddress', title: 'Email Address' },
        { id: 'mobileNumber', title: 'Mobile Number' },
        { id: 'experienceLevel', title: 'Experience Level' },
        { id: 'serviceQuality', title: 'Service Quality' },
        { id: 'deliveryTime', title: 'Delivery Time' },
        { id: 'installationTime', title: 'Installation Time' },
        { id: 'employeesBehavior', title: 'Employees Behavior' },
        { id: 'productRating', title: 'Product Rating' },
        { id: 'clientMessage', title: 'Client Message' },
      ],
    })

    await client.connect()
    const allData = await client
      .db('survey')
      .collection('clients')
      .find()
      .toArray()

    const records = []

    allData.forEach((element) => {
      const record = { contractID: element.contractID }
      record.clientName = element.clientName
      record.projectName = element.projectName
      record.emailAddress = element.customerEmail
      record.mobileNumber = element.customerMobileNumber
      record.experienceLevel = element.Client_Experience_Level
      record.serviceQuality = element.Service_Quality
      record.deliveryTime = element.Delivery_Time
      record.installationTime = element.Installation_Time
      record.employeesBehavior = element.Employees_Behavior
      record.productRating = element.Product_Rating
      record.clientMessage = element.Client_Message
      records.push(record)
    })

    await csvWriter.writeRecords(records) // returns a promise

    res.send(allData)
  } catch (error) {
    res.status(500).json({
      message: `${error}`,
    })
  } finally {
    await client.close()
  }
})

module.exports = router
