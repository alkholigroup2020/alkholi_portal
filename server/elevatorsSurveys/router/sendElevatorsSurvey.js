const express = require('express')
const router = express.Router()
const { MongoClient } = require('mongodb')
const nodemailer = require('nodemailer')
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

module.exports = router
