const path = require('path')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const {
  safeRouter,
  text,
  failure,
  escapeHtml,
} = require('../../shared/auditBoundary')

module.exports = function createElevatorsRouter({
  auth,
  requireSurveyMember,
  createClient,
  transporter,
  createCsvWriter: csvWriter = createCsvWriter,
}) {
  const router = safeRouter()
  const memberOnly = [auth, requireSurveyMember]

  router.post('/send-survey-request', ...memberOnly, async (req, res) => {
    const requestData = {}
    for (const [key, limit] of Object.entries({
      contractID: 100,
      clientName: 500,
      projectName: 500,
      customerEmail: 254,
      customerMobileNumber: 50,
      mailBody: 10000,
      arabicMessage: 10000,
    })) {
      requestData[key] = text(
        req.body[key],
        limit,
        true,
        key === 'mailBody' || key === 'arabicMessage'
      )
    }
    if (
      !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(requestData.customerEmail)
    )
      throw failure('invalidRequest')
    const client = createClient()
    try {
      // save a record to the db
      await client.connect()
      await client
        .db('survey')
        .collection('specificClients')
        .insertOne(requestData)

      // send mail
      await transporter.sendMail({
        from: '"Buildingtec Elevators" <info@buildingtec.com>',
        to: `${requestData.customerEmail}`,
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
              <pre style="font-size: 16px; font-family:'Times New Roman', serif; color: #212121">${escapeHtml(
                requestData.mailBody
              )}</pre>
              <p>
                Please follow this
                <a href="https://www.buildingtec-elevators.com/survey/${encodeURIComponent(
                  requestData.contractID
                )}"
                  ><b>link</b></a
                >
                to take the survey.
              </p>
            </div>
            <div style="text-align: right;">
              <pre style="font-size: 16px; font-family:'Times New Roman', serif; color: #212121">${escapeHtml(
                requestData.arabicMessage
              )}</pre>
              <p>
              تفضــل بإكمــال الإستبــيان من
              <a href="https://www.buildingtec-elevators.com/ar/survey/${encodeURIComponent(
                requestData.contractID
              )}"
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
      if (error.code === 11000) {
        res.status(501).json({
          message: `Duplicate Contract ID`,
        })
      } else {
        throw error
      }
    } finally {
      await client.close().catch(() => {})
    }
  })

  router.get('/get-clients-survey-data', ...memberOnly, async (req, res) => {
    const client = createClient()
    try {
      await client.connect()
      const allData = await client
        .db('survey')
        .collection('specificClients')
        .find()
        .toArray()
      res.send(allData)
    } finally {
      await client.close().catch(() => {})
    }
  })

  router.get('/get-anonymous-survey-data', ...memberOnly, async (req, res) => {
    const client = createClient()
    try {
      await client.connect()
      const allData = await client
        .db('survey')
        .collection('clients')
        .find()
        .toArray()
      res.send(allData)
    } finally {
      await client.close().catch(() => {})
    }
  })

  router.post('/export-clients-csv-data', ...memberOnly, async (req, res) => {
    const client = createClient()
    try {
      const writer = csvWriter({
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

      await writer.writeRecords(records) // returns a promise

      res.send(allData)
    } finally {
      await client.close().catch(() => {})
    }
  })

  router.post('/export-anonymous-csv-data', ...memberOnly, async (req, res) => {
    const client = createClient()
    try {
      const writer = csvWriter({
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

      await writer.writeRecords(records) // returns a promise

      res.send(allData)
    } finally {
      await client.close().catch(() => {})
    }
  })

  return router
}
