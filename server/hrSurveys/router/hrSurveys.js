const path = require('path')
const { ObjectId } = require('mongodb')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const {
  safeRouter,
  connect,
  text,
  failure,
} = require('../../shared/auditBoundary')

module.exports = function createHrSurveysRouter({
  sql,
  portalConfig,
  hrConfig,
  auth,
  requireSurveyMember,
  createClient,
  createCsvWriter: csvWriter = createCsvWriter,
}) {
  const router = safeRouter()
  const memberOnly = [auth, requireSurveyMember]
  const portalDB = () => connect(sql, portalConfig)
  const hrDB = () => connect(sql, hrConfig)

  router.get('/get-hr-survey-data', ...memberOnly, async (req, res) => {
    const client = createClient()
    try {
      await client.connect()
      const allData = await client
        .db('hr-engagement-survey')
        .collection('survey')
        .find()
        .toArray()
      res.send(allData)
    } finally {
      await client.close().catch(() => {})
    }
  })

  router.post('/get-single-hr-survey', ...memberOnly, async (req, res) => {
    if (
      typeof req.body.id !== 'string' ||
      !/^[a-fA-F0-9]{24}$/.test(req.body.id)
    )
      throw failure('invalidRequest')
    const client = createClient()
    try {
      await client.connect()
      const surveyData = await client
        .db('hr-engagement-survey')
        .collection('survey')
        .findOne({ _id: ObjectId(req.body.id) })
      if (!surveyData) throw failure('notFound', 404)
      res.send(surveyData)
    } finally {
      await client.close().catch(() => {})
    }
  })

  router.post('/get-survey-employee-data', ...memberOnly, async (req, res) => {
    const code = text(req.body.code, 15)
    let portal, hr
    try {
      portal = await portalDB()
      hr = await hrDB()
      const employeeResult = await hr
        .request()
        .input('code', sql.VarChar(15), code)
        .query(
          'SELECT employee_code, branch_code, employee_name_eng, Email, position, employee_picture FROM dbo.Pay_employees WHERE employee_code = @code'
        )
      if (!employeeResult.recordset.length) return res.status(205).send()
      if (employeeResult.recordset.length !== 1)
        throw failure('serviceUnavailable', 503)
      const employee = employeeResult.recordset[0]
      const storedPosition = text(employee.position, 15)
      // Preserve the legacy numeric title-code normalization, while keeping
      // nonnumeric stored values as bound data rather than SQL fragments.
      const position = Number.isFinite(Number(storedPosition))
        ? String(Number(storedPosition))
        : storedPosition
      const titleResult = await hr
        .request()
        .input('position', sql.VarChar(15), text(position, 15))
        .input('branch', sql.VarChar(10), text(employee.branch_code, 10))
        .query(
          "SELECT system_desp_a, system_desp_e FROM dbo.pay_code_tables WHERE system_code = @position AND branch_code = @branch AND system_code_type = '21'"
        )
      if (!titleResult.recordset.length) return res.status(205).send()
      const pictureResult = await portal
        .request()
        .input('code', sql.VarChar(20), code)
        .query(
          'SELECT portalProfilePicPath FROM dbo.usersInfo WHERE employeeID = @code'
        )
      const portalPath = pictureResult.recordset[0]?.portalProfilePicPath
      const hrPicture = !portalPath && Boolean(employee.employee_picture)
      const { employee_picture: picture, ...memberInfo } = employee
      res.json({
        memberInfo,
        titleInfo: titleResult.recordset[0],
        memberPicturePath:
          portalPath || picture || 'anonymousProfilePicture.jpeg',
        hrPicture,
        portalPicture: !hrPicture,
      })
    } finally {
      if (hr) await hr.close().catch(() => {})
      if (portal) await portal.close().catch(() => {})
    }
  })

  router.post('/export-csv-data', ...memberOnly, async (req, res) => {
    if (!Array.isArray(req.body) || req.body.length > 1000)
      throw failure('invalidRequest')
    for (const item of req.body) {
      const keys = Object.keys(item || {})
      if (keys.length !== 1) throw failure('invalidRequest')
      text(keys[0], 1000)
      const values = item[keys[0]]
      if (
        !Array.isArray(values) ||
        values.length !== 5 ||
        values.some((v) => !Number.isFinite(v) || v < 0)
      )
        throw failure('invalidRequest')
    }
    const writer = csvWriter({
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

    await writer.writeRecords(records) // returns a promise

    res.send()
  })

  return router
}
