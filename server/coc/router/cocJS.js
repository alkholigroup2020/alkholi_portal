const path = require('path')
const multer = require('multer')
const { PDFDocument, rgb } = require('pdf-lib')
const fontkit = require('@pdf-lib/fontkit')
const ExcelJS = require('exceljs')
const { Parser } = require('json2csv')
const {
  safeRouter,
  connect,
  text: validateText,
  integer,
  artifact,
  failure,
  escapeHtml,
} = require('../../shared/auditBoundary')

module.exports = function createCocRouter({
  sql,
  portalConfig,
  authorize,
  requireCocAdmin,
  fs,
  transporter,
  uploadFactory = multer,
  pdfDocument = PDFDocument,
}) {
  const router = safeRouter()
  const PDFDocument = pdfDocument
  const signatures = require('../services/signatures').createSignatures({
    sql,
    portalConfig,
  })
  const adminOnly = [authorize, requireCocAdmin]
  const portalDB = () => connect(sql, portalConfig)

  async function activeEmployee(req, res, next) {
    const pool = await portalDB()
    try {
      const result = await pool
        .request()
        .input('employee_id', sql.NVarChar(20), req.auth.employeeCode)
        .query(
          'SELECT name_eng, title_e FROM coc.employees WHERE employee_id = @employee_id AND is_active = 1'
        )
      if (result.recordset.length !== 1)
        return res.status(403).json({ message: 'inactiveEmployee' })
      req.cocEmployee = result.recordset[0]
      next()
    } finally {
      await pool.close().catch(() => {})
    }
  }

  // Reusable function to send emails with customizable parameters
  async function sendEmail(to, subject, text, html, attachments = []) {
    const mailOptions = {
      from: process.env.EMAIL_FROM, // Sender email address (e.g., 'no-reply@yourcompany.com')
      to, // Recipient email address(es)
      subject, // Email subject line
      text, // Plain text version of the email body
      html, // HTML version of the email body
      attachments, // Array of attachment objects (e.g., [{ filename, path }])
    }

    try {
      await transporter.sendMail(mailOptions) // Send the email using the configured transporter
    } catch (error) {
      throw new Error('Email sending failed') // Throw error to be handled by the caller
    }
  }

  // Helper function to retrieve HR admins' email addresses from the database
  async function getAdminEmails() {
    const portalDBConnection = await portalDB() // Establish database connection (assumes a DB connection utility)
    try {
      // Query to select all email addresses from coc_admins table
      const result = await portalDBConnection.request().query(`
      SELECT mailAddress FROM dbo.coc_admins
    `)
      return result.recordset.map((admin) => admin.mailAddress) // Extract email addresses into an array
    } finally {
      await portalDBConnection.close().catch(() => {}) // Ensure the DB connection is closed
    }
  }

  // Add endpoint to generate the print form
  router.post(
    '/generate-print-form',
    authorize,
    activeEmployee,
    async (req, res) => {
      // Extract data from request body
      if (req.body.employeeID && req.body.employeeID !== req.auth.employeeCode)
        throw failure('forbidden', 403)
      const name = req.cocEmployee.name_eng
      const position = req.cocEmployee.title_e
      const employeeID = req.auth.employeeCode
      const date = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })

      const fontBytes = fs.readFileSync(
        path.join(
          __dirname,
          '../../../uploads/coc/fonts/AA_Stetica_Regular.otf'
        )
      )

      // Create a new PDF document
      const pdfDoc = await PDFDocument.create()

      pdfDoc.registerFontkit(fontkit)
      const documentFont = await pdfDoc.embedFont(fontBytes)

      // Add a blank A4-sized page (595 x 842 points)
      const page = pdfDoc.addPage([595, 842])

      // Define layout constants
      const leftMargin = 60 // Left starting point for text
      const rightMargin = 535 // Right boundary (595 - 60)
      const contentWidth = rightMargin - leftMargin // 475 points

      // Define font sizes
      const fontSizeTitle = 22 // Title font size
      const fontSizeSubtitle = 19 // Subtitle font size
      const fontSizeSection = 16 // Section header font size
      const fontSizeField = 15 // Field label and paragraph font size

      // Add the logo
      const logoPath = path.join(__dirname, '../../../uploads/coc/logo.png')
      const logoBytes = fs.readFileSync(logoPath)
      const logoImage = await pdfDoc.embedPng(logoBytes) // Use embedJpg if it’s a JPEG
      const originalWidth = logoImage.width
      const originalHeight = logoImage.height
      const logoWidth = 120 // Desired width in points
      const logoHeight = (originalHeight / originalWidth) * logoWidth // Maintain aspect ratio
      const marginRight = 40 // Margin from right edge
      const marginTop = 25 // Margin from top edge
      const x = 595 - logoWidth - marginRight // x-coordinate (bottom-left of logo)
      const y = 842 - marginTop - logoHeight // y-coordinate (bottom of logo)
      page.drawImage(logoImage, {
        x,
        y,
        width: logoWidth,
        height: logoHeight,
      })

      // Draw the main title, centered across the full page width
      const title = 'Employee Acknowledgement Receipt Form'
      const textWidthTitle = documentFont.widthOfTextAtSize(
        title,
        fontSizeTitle
      )
      const xTitle = (595 - textWidthTitle) / 2 // Center within 595 points
      page.drawText(title, {
        x: xTitle,
        y: 725,
        size: fontSizeTitle,
        font: documentFont,
        color: rgb(0, 0, 0),
      })

      // Draw the subtitle, centered across the full page width
      const subtitle = 'Code of Conduct'
      const textWidthSubtitle = documentFont.widthOfTextAtSize(
        subtitle,
        fontSizeSubtitle
      )
      const xSubtitle = (595 - textWidthSubtitle) / 2 // Center within 595 points
      page.drawText(subtitle, {
        x: xSubtitle,
        y: 690,
        size: fontSizeSubtitle,
        font: documentFont,
        color: rgb(0, 0, 0),
      })

      // Helper function to draw form fields with data
      function drawFormField(page, label, value, y) {
        const labelWidth = documentFont.widthOfTextAtSize(label, fontSizeField)
        // Draw the label text
        page.drawText(label, {
          x: leftMargin,
          y,
          size: fontSizeField,
          font: documentFont,
          color: rgb(0, 0, 0),
        })
        // Draw the value text next to the label
        page.drawText(value, {
          x: leftMargin + labelWidth + 5, // Add a small space after the label
          y,
          size: fontSizeField,
          font: documentFont,
          color: rgb(0, 0, 0),
        })
      }

      // Draw "Employee Information" section
      // page.drawText('Employee Details:', {
      //   x: leftMargin,
      //   y: 660,
      //   size: fontSizeSection,
      //   font: documentFont,
      //   color: rgb(0, 0, 0),
      // })

      // Draw employee information fields with data from request
      drawFormField(page, 'Name: ', name || 'Not Provided', 650)
      drawFormField(page, 'Position: ', position || 'Not Provided', 620)
      drawFormField(page, 'Employee ID: ', employeeID || 'Not Provided', 590)

      // Draw "Acknowledgement Details" section
      page.drawText('Acknowledgement Details:', {
        x: leftMargin,
        y: 550,
        size: fontSizeSection,
        font: documentFont,
        color: rgb(0, 0, 0),
      })

      // Draw the acknowledgement paragraph
      const paragraph =
        'I, the undersigned, hereby acknowledge that I have received and reviewed the Alkholi Group’s Code of Conduct. I understand that it is my responsibility to read, understand, and comply with the guidelines set forth in the Code of Conduct while performing my duties at Alkholi Group. I further acknowledge that failure to adhere to the Code of Conduct may result in disciplinary action in accordance with the company’s policies. I understand that if I have any questions or require clarification regarding any part of the Code of Conduct, I am encouraged to reach out to Human Resources or my supervisor.'
      page.drawText(paragraph, {
        x: leftMargin,
        y: 520,
        size: fontSizeField,
        font: documentFont,
        color: rgb(0, 0, 0),
        maxWidth: contentWidth,
        lineHeight: 22,
      })

      // Draw "Acknowledgement of Receipt" section
      page.drawText('Acknowledgement of Receipt:', {
        x: leftMargin,
        y: 280,
        size: fontSizeSection,
        font: documentFont,
        color: rgb(0, 0, 0),
      })

      // Draw receipt fields with data from request
      drawFormField(page, 'Date of Receipt: ', date || 'Not Provided', 250)
      drawFormField(
        page,
        'Employee Signature: ',
        '.............................................................',
        165
      )

      // Serialize the PDF to bytes
      const pdfBytes = await pdfDoc.save()

      // Generate a unique file name and path
      const fileName = `PRINTFORM_${require('crypto').randomUUID()}.pdf`
      const filePath = path.join(
        __dirname,
        '../../../uploads/coc/printedCopies',
        fileName
      )

      // Save the PDF file
      fs.writeFileSync(filePath, pdfBytes)

      // Send the file URL in the response
      res.status(200).json({
        url: `/coc-api/printed-copies/${fileName}`,
      })
    }
  )

  // attachments storage
  const storage = uploadFactory.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '../../../uploads/coc/cocVersions'))
    },
    filename: (req, file, cb) => {
      cb(
        null,
        `COC_${Date.now()}_${require('crypto')
          .randomBytes(8)
          .toString('hex')}.pdf`
      )
    },
  })

  // attachments filter
  const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      return cb(new Error('fileTypeError'), false)
    }
  }

  // attachments upload
  const upload = uploadFactory({
    storage,
    fileFilter,
    limits: { fileSize: 5242880 }, // 5mb file limit
  })

  // Add endpoint to save CoC document
  router.post(
    '/save-coc-document',
    ...adminOnly,
    upload.single('attachment'),
    async (req, res) => {
      let portalDBConnection
      let saved = false
      let tx
      let begun = false
      let commitStarted = false
      try {
        portalDBConnection = await portalDB()
        tx = new sql.Transaction(portalDBConnection)
        await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE)
        begun = true
        const request = () => new sql.Request(tx)
        // Validate inputs
        if (!req.file || !req.body.versionNumber) {
          return res.status(400).json({ message: 'Missing required fields!' })
        }

        validateText(req.body.versionNumber, 20)
        const actor = await request()
          .input('employeeCode', sql.VarChar(20), req.auth.employeeCode)
          .query(
            'SELECT fullName FROM dbo.coc_admins WITH (HOLDLOCK) WHERE employeeID = @employeeCode'
          )
        if (actor.recordset.length !== 1) throw failure('forbidden', 403)
        validateText(actor.recordset[0].fullName, 100)

        // check if the version number is already in the database
        const versionCheck = await request()
          .input('version_number', sql.NVarChar(20), req.body.versionNumber)
          .query(
            `SELECT id FROM coc.coc_versions WITH (UPDLOCK, HOLDLOCK) WHERE version_number = @version_number`
          )

        if (versionCheck.recordset.length > 0) {
          return res
            .status(400)
            .json({ message: 'Version number must be unique!' })
        }

        // if it is a new version, add it to the database
        await request()
          .input('version_number', sql.NVarChar(20), req.body.versionNumber)
          .input('file_path', sql.NVarChar(255), req.file.filename)
          .input('admin_id', sql.NVarChar(20), req.auth.employeeCode)
          .input('admin_name', sql.NVarChar(100), actor.recordset[0].fullName)
          .execute('coc.coc_versions_addVersion')

        commitStarted = true
        await tx.commit()
        begun = false
        saved = true
        // return ok response
        res.status(201).json({
          message: 'Version uploaded successfully',
          filename: req.file.filename,
        })
      } catch (error) {
        if (commitStarted) saved = true
        throw error
      } finally {
        if (begun) await tx.rollback().catch(() => {})
        if (portalDBConnection) await portalDBConnection.close().catch(() => {})
        if (!saved && req.file?.path && fs.existsSync(req.file.path))
          fs.unlinkSync(req.file.path)
      }
    }
  )

  router.get(
    '/get-current-coc-version',
    authorize,
    activeEmployee,
    async (req, res) => {
      const pool = await portalDB()
      try {
        const result = await pool
          .request()
          .query(
            'SELECT TOP (1) id, version_number, file_path, active_flag, created_at FROM coc.coc_versions WHERE active_flag = 1 ORDER BY created_at DESC'
          )
        res.json(result.recordset)
      } finally {
        await pool.close().catch(() => {})
      }
    }
  )

  // Add endpoint to fetch versions
  router.get('/get-coc-versions', ...adminOnly, async (req, res) => {
    const portalDBConnection = await portalDB()
    try {
      const result = await portalDBConnection
        .request()
        .query(
          `SELECT id, version_number, file_path, active_flag, created_at, admin_id, admin_name FROM coc.coc_versions ORDER BY created_at DESC`
        )

      res.status(200).json(result.recordset)
    } finally {
      await portalDBConnection.close().catch(() => {})
    }
  })

  // Add endpoint to fetch a single employee's data
  router.post('/get-single-employee-data', authorize, async (req, res) => {
    const portalDBConnection = await portalDB()
    try {
      const result = await portalDBConnection
        .request()
        .input('employee_id', sql.NVarChar(20), req.auth.employeeCode).query(`
        SELECT
          e.employee_id, e.name_eng, e.name_a, e.position, e.branch_code, e.email, e.employee_picture, e.title_e, e.title_a, e.is_active,
          es.status AS signature_status,
          es.signed_at,
          es.file_path
        FROM coc.employees e
        LEFT JOIN coc.employee_signatures es ON e.employee_id = es.employee_id
          AND es.coc_version_id = (
            SELECT TOP 1 id
            FROM coc.coc_versions
            WHERE active_flag = 1
            ORDER BY created_at DESC
          )
        WHERE e.employee_id = @employee_id AND e.is_active = 1
      `)

      if (result.recordset.length === 0) {
        return res.status(403).json({ message: 'inactiveEmployee' })
      }

      // Return the employee data
      res.status(200).json(result.recordset[0])
    } finally {
      await portalDBConnection.close().catch(() => {})
    }
  })

  // Configure multer for signed form uploads
  const uploadSignedForm = uploadFactory({
    storage: uploadFactory.diskStorage({
      destination: (req, file, cb) => {
        // Define where uploaded signed forms will be temporarily stored
        cb(null, path.join(__dirname, '../../../uploads/coc/signedForms'))
      },
      filename: (req, file, cb) => {
        // Server-generated filenames cannot contain employee-provided paths
        cb(null, `SIGNED_${require('crypto').randomUUID()}.pdf`)
      },
    }),
    fileFilter: (req, file, cb) => {
      // Ensure only PDF files are accepted
      if (file.mimetype === 'application/pdf') {
        cb(null, true)
      } else {
        cb(new Error('Only PDF files are allowed'), false)
      }
    },
    limits: { fileSize: 5242880 }, // Set a 5MB file size limit
  })

  // Authentication and active ownership checks happen before any uploaded file is written.
  router.post(
    '/upload-signed-form',
    authorize,
    activeEmployee,
    uploadSignedForm.single('signedForm'),
    async (req, res) => {
      const signedFormPath = req.file?.path
      let combinedFile
      let committed = false
      try {
        if (!signedFormPath) throw failure('invalidRequest')
        const result = await signatures.submit(
          req.auth.employeeCode,
          async (versionPath) => {
            combinedFile = await appendSignatureToCoC(
              req.auth.employeeCode,
              signedFormPath,
              versionPath,
              (filename) => {
                combinedFile = filename
              }
            )
            return combinedFile
          }
        )
        committed = true
        // Notifications run after the signature and history commit. Failures do not
        // turn a successful submission into a retry that changes employee records.
        setImmediate(async () => {
          try {
            const emails = await getAdminEmails()
            const name = result.employee.name_eng
            const subject = 'New CoC Form Submission'
            const body = `Employee ID: ${req.auth.employeeCode}\nEmployee Name: ${name}`
            await Promise.all(
              emails.map((email) =>
                sendEmail(email, subject, body, `<p>${escapeHtml(body)}</p>`, [
                  {
                    filename: combinedFile,
                    path: artifact(
                      path.join(
                        __dirname,
                        '../../../uploads/coc/combinedDocuments'
                      ),
                      combinedFile
                    ),
                  },
                ])
              )
            )
          } catch {
            process.stderr.write('CoC notification failed\n')
          }
        })
        res.json({
          message: 'Signed form uploaded and processed successfully!',
        })
      } catch (error) {
        if (error.commitUncertain) committed = true
        throw error
      } finally {
        if (signedFormPath && fs.existsSync(signedFormPath))
          fs.unlinkSync(signedFormPath)
        if (!committed && combinedFile) {
          const generated = artifact(
            path.join(__dirname, '../../../uploads/coc/combinedDocuments'),
            combinedFile
          )
          if (fs.existsSync(generated)) fs.unlinkSync(generated)
        }
      }
    }
  )

  // Function to append the signature page to the CoC document
  async function appendSignatureToCoC(
    employeeId,
    signedFormPath,
    versionPath,
    onGenerated
  ) {
    const cocFilePath = artifact(
      path.join(__dirname, '../../../uploads/coc/cocVersions'),
      versionPath
    )
    // Load the CoC document into a PDFDocument object
    const cocPdfBytes = fs.readFileSync(cocFilePath)
    const cocPdfDoc = await PDFDocument.load(cocPdfBytes)

    // Load the uploaded signed form into a PDFDocument object
    const signedFormBytes = fs.readFileSync(signedFormPath)
    const signedFormDoc = await PDFDocument.load(signedFormBytes)

    // Create a new PDF document to hold the combined result
    const combinedPdfDoc = await PDFDocument.create()

    // Copy all pages from the CoC document to the combined document
    const cocPages = await combinedPdfDoc.copyPages(
      cocPdfDoc,
      cocPdfDoc.getPageIndices()
    )
    cocPages.forEach((page) => combinedPdfDoc.addPage(page))

    // Copy the first page (signature page) from the signed form
    const signedFormPages = await combinedPdfDoc.copyPages(signedFormDoc, [0]) // Assuming single-page signature
    combinedPdfDoc.addPage(signedFormPages[0])

    // Save the combined PDF document
    const combinedPdfBytes = await combinedPdfDoc.save()
    const combinedFileName = `Signed_Form_${require('crypto').randomUUID()}.pdf`
    const combinedFilePath = path.join(
      __dirname,
      '../../../uploads/coc/combinedDocuments',
      combinedFileName
    )
    onGenerated(combinedFileName)
    fs.writeFileSync(combinedFilePath, combinedPdfBytes)

    // Return the filename of the combined document (relative path for DB storage)
    return combinedFileName
  }

  // Add endpoint to delete a specific version
  /* Something still missing here! When a version is deleted, no active document is assigned!
The delete feature is disabled in the frontend for now. */
  router.delete('/delete-version/:id', ...adminOnly, async (req, res) => {
    const portalDBConnection = await portalDB()
    try {
      // Get file path first
      const versionRecord = await portalDBConnection
        .request()
        .input('id', sql.Int, integer(req.params.id))
        .query(`SELECT file_path FROM coc.coc_versions WHERE id = @id`)

      if (!versionRecord.recordset.length) {
        return res.status(404).json({ message: 'Version not found' })
      }

      const filePath = artifact(
        path.join(__dirname, '../../../uploads/coc/cocVersions'),
        versionRecord.recordset[0].file_path
      )

      // Delete database record
      await portalDBConnection
        .request()
        .input('id', sql.Int, integer(req.params.id))
        .query(`DELETE FROM coc.coc_versions WHERE id = @id`)

      // Delete file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }

      res.status(200).json({ message: 'Version deleted successfully' })
    } finally {
      await portalDBConnection.close().catch(() => {})
    }
  })

  router.get('/get-employee-compliance', ...adminOnly, async (req, res) => {
    const portalDBConnection = await portalDB()
    try {
      const result = await portalDBConnection.request().query(`
      SELECT
        e.employee_id,
        e.name_eng,
        e.name_a,
        e.position,
        e.branch_code,
        e.email,
        e.employee_picture,
        e.title_e,
        e.title_a,
        es.id AS signature_id,
        es.file_path AS signed_document_path,
        es.signed_at,
        es.status,
        cv.version_number
      FROM coc.employees e
      LEFT JOIN coc.employee_signatures es ON e.employee_id = es.employee_id
        AND es.coc_version_id = (SELECT TOP 1 id FROM coc.coc_versions WHERE active_flag = 1 ORDER BY created_at DESC)
      LEFT JOIN coc.coc_versions cv ON es.coc_version_id = cv.id
      WHERE e.is_active = 1
      ORDER BY e.employee_id
    `)
      res.status(200).json(result.recordset)
    } finally {
      await portalDBConnection.close().catch(() => {})
    }
  })

  router.post('/send-single-email', ...adminOnly, async (req, res) => {
    const employeeCode = validateText(req.body.employeeCode, 20)
    const pool = await portalDB()
    let employee
    try {
      const result = await pool
        .request()
        .input('employee_id', sql.NVarChar(20), employeeCode)
        .query(
          'SELECT name_eng, email FROM coc.employees WHERE employee_id = @employee_id AND is_active = 1'
        )
      if (result.recordset.length !== 1) throw failure('notFound', 404)
      employee = result.recordset[0]
    } finally {
      await pool.close().catch(() => {})
    }
    const employeeEmail = employee.email
    const employeeName = employee.name_eng

    // Construct the notification email content
    const subject = 'Code of Conduct - Acknowledgement Request'
    const text = `Dear ${employeeName},\n\nPlease review and acknowledge the Code of Conduct at your earliest convenience.\n\nYou can access the submission page here: https://portal.alkholi.com/code-of-conduct/coc-form\n\nBest regards,\nHR Team`
    const html = `<p>Dear ${escapeHtml(
      employeeName
    )},</p><p>Please review and acknowledge the Code of Conduct at your earliest convenience.</p><p>You can access the submission page here: <a href="https://portal.alkholi.com/code-of-conduct/coc-form">Code of Conduct Form</a></p><p>Best regards,<br>HR Team</p>`

    // Send the approval email
    await sendEmail(employeeEmail, subject, text, html)

    res.status(200).json({ message: 'Email sent successfully' })
  })

  for (const [route, approved] of [
    ['approve-signature', true],
    ['reject-signature', false],
  ]) {
    router.post(`/${route}`, ...adminOnly, async (req, res) => {
      const employee = await signatures.decide(
        req.body.signatureId,
        req.auth.employeeCode,
        approved,
        req.body.expectedFilePath
      )
      setImmediate(async () => {
        try {
          const status = approved ? 'approved' : 'rejected'
          const body = `Dear ${employee.name_eng}, your Code of Conduct submission was ${status}.`
          await sendEmail(
            employee.email,
            `Your Code of Conduct Form Submission Was ${status}`,
            body,
            `<p>${escapeHtml(
              body
            )}</p><p><a href="https://portal.alkholi.com/code-of-conduct/coc-form">Code of Conduct Form</a></p>`
          )
        } catch {
          process.stderr.write('CoC notification failed\n')
        }
      })
      res.json({
        message: approved
          ? 'Signature approved successfully.'
          : 'Signature rejected successfully.',
      })
    })
  }

  // Endpoint: /get-submissions-history
  // Fetches the history of submissions made by employees
  // This includes the status of each submission and the associated CoC version
  router.get('/get-submissions-history', ...adminOnly, async (req, res) => {
    let portalDBConnection
    try {
      portalDBConnection = await portalDB()
      // Query to fetch submission history for only approved and rejected submissions
      const result = await portalDBConnection.request().query(`
      SELECT
        sh.id,
        e.employee_id,
        e.name_eng,
        e.title_e,
        e.branch_code,
        e.employee_picture,
        sh.status,
        sh.submitted_at AS signed_at,
        cv.version_number,
        sh.file_path
      FROM coc.submission_history sh
      INNER JOIN coc.employees e ON sh.employee_id = e.employee_id
      INNER JOIN coc.coc_versions cv ON sh.coc_version_id = cv.id
      WHERE sh.status IN ('approved', 'rejected')
      ORDER BY sh.submitted_at DESC
    `)

      res.status(200).json(result.recordset)
    } finally {
      if (portalDBConnection) await portalDBConnection.close().catch(() => {})
    }
  })

  // export signed or unsigned employees report
  router.get('/export-report', ...adminOnly, async (req, res) => {
    const portalDBConnection = await portalDB()
    try {
      const type = req.query.type
      const format = req.query.format || 'csv'

      if (!type || (type !== 'signed' && type !== 'unsigned')) {
        return res
          .status(400)
          .json({ message: 'Invalid or missing report type' })
      }
      if (!['csv', 'xlsx', 'pdf'].includes(format)) {
        return res.status(400).json({ message: 'Invalid format specified' })
      }

      const activeVersionResult = await portalDBConnection.request().query(`
      SELECT TOP 1 id FROM coc.coc_versions WHERE active_flag = 1 ORDER BY created_at DESC
    `)
      const activeVersionId = activeVersionResult.recordset[0]?.id
      if (!activeVersionId) {
        return res.status(404).json({ message: 'No active CoC version found' })
      }

      let query
      if (type === 'signed') {
        query = `
        SELECT
          e.employee_id,
          e.name_eng,
          e.title_e,
          e.branch_code,
          CONVERT(varchar, es.signed_at, 120) as signed_at,
          cv.version_number
        FROM coc.employees e
        INNER JOIN coc.employee_signatures es ON e.employee_id = es.employee_id
        INNER JOIN coc.coc_versions cv ON es.coc_version_id = cv.id
        WHERE e.is_active = 1 AND es.status = 'approved' AND es.coc_version_id = @versionId
      `
      } else {
        query = `
        SELECT
          e.employee_id,
          e.name_eng,
          e.title_e,
          e.branch_code
        FROM coc.employees e
        LEFT JOIN coc.employee_signatures es ON e.employee_id = es.employee_id AND es.coc_version_id = @versionId
        WHERE e.is_active = 1 AND (es.id IS NULL OR es.status != 'approved')
      `
      }

      const request = portalDBConnection.request()
      request.input('versionId', sql.Int, activeVersionId)
      const result = await request.query(query)
      const data = result.recordset

      if (format === 'csv') {
        const fields =
          type === 'signed'
            ? [
                { label: 'Employee ID', value: 'employee_id' },
                { label: 'Name', value: 'name_eng' },
                { label: 'Title', value: 'title_e' },
                { label: 'Branch', value: 'branch_code' },
                { label: 'Signed At', value: 'signed_at' },
                { label: 'Version', value: 'version_number' },
              ]
            : [
                { label: 'Employee ID', value: 'employee_id' },
                { label: 'Name', value: 'name_eng' },
                { label: 'Title', value: 'title_e' },
                { label: 'Branch', value: 'branch_code' },
              ]
        const parser = new Parser({ fields })
        const csv = parser.parse(data)
        res.header('Content-Type', 'text/csv')
        res.attachment(`${type}_employees.csv`)
        res.send(csv)
      } else if (format === 'xlsx') {
        const workbook = new ExcelJS.Workbook()
        const worksheet = workbook.addWorksheet('Employees')
        const columns =
          type === 'signed'
            ? [
                { header: 'Employee ID', key: 'employee_id', width: 15 },
                { header: 'Name', key: 'name_eng', width: 30 },
                { header: 'Title', key: 'title_e', width: 20 },
                { header: 'Branch', key: 'branch_code', width: 15 },
                { header: 'Signed At', key: 'signed_at', width: 20 },
                { header: 'Version', key: 'version_number', width: 10 },
              ]
            : [
                { header: 'Employee ID', key: 'employee_id', width: 15 },
                { header: 'Name', key: 'name_eng', width: 30 },
                { header: 'Title', key: 'title_e', width: 20 },
                { header: 'Branch', key: 'branch_code', width: 15 },
              ]
        worksheet.columns = columns
        worksheet.addRows(data)
        res.header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        res.attachment(`${type}_employees.xlsx`)
        await workbook.xlsx.write(res)
        res.end()
      } else if (format === 'pdf') {
        const pdfDoc = await PDFDocument.create()
        pdfDoc.registerFontkit(fontkit)
        const documentFont = await pdfDoc.embedFont(
          fs.readFileSync(
            path.join(
              __dirname,
              '../../../uploads/coc/fonts/AA_Stetica_Regular.otf'
            )
          )
        )
        let page = pdfDoc.addPage([842, 595]) // Landscape orientation
        const fontSize = 10 // Smaller font size
        const margin = 50
        let y = 550

        // Draw report title
        page.drawText(
          `${type.charAt(0).toUpperCase() + type.slice(1)} Employees Report`,
          {
            x: margin,
            y,
            size: 16,
            color: rgb(0, 0, 0),
            font: documentFont,
          }
        )
        y -= 30

        // Define column headers and their x positions for landscape
        const headers =
          type === 'signed'
            ? ['Employee ID', 'Name', 'Branch', 'Version']
            : ['Employee ID', 'Name', 'Branch']

        // Adjusted x positions for landscape with fewer columns
        const xPositionsSigned = [50, 150, 450, 600]
        const xPositionsUnsigned = [50, 150, 450]
        const xPositions =
          type === 'signed' ? xPositionsSigned : xPositionsUnsigned

        // Draw headers
        headers.forEach((header, index) => {
          page.drawText(header, {
            x: xPositions[index],
            y,
            size: fontSize,
            color: rgb(0, 0, 0),
            font: documentFont,
          })
        })
        y -= 20

        // Draw data rows
        data.forEach((row) => {
          const rowData =
            type === 'signed'
              ? [
                  row.employee_id,
                  row.name_eng,
                  row.branch_code,
                  row.version_number,
                ]
              : [row.employee_id, row.name_eng, row.branch_code]

          rowData.forEach((cell, index) => {
            page.drawText(cell ? cell.toString() : '', {
              x: xPositions[index],
              y,
              size: fontSize,
              color: rgb(0, 0, 0),
              font: documentFont,
            })
          })
          y -= 20

          // Add new page if needed
          if (y < 50) {
            page = pdfDoc.addPage([842, 595])
            y = 550
          }
        })

        const pdfBytes = await pdfDoc.save()
        res.header('Content-Type', 'application/pdf')
        res.attachment(`${type}_employees.pdf`)
        res.send(Buffer.from(pdfBytes))
      }
    } finally {
      await portalDBConnection.close().catch(() => {})
    }
  })

  return router
}
