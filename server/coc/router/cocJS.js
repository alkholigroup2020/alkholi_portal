const path = require('path')
const fs = require('fs')
const express = require('express')
const router = express.Router()
const multer = require('multer')
const { PDFDocument, rgb } = require('pdf-lib')
const fontkit = require('@pdf-lib/fontkit')
const ExcelJS = require('exceljs')
const sql = require('mssql')
const nodemailer = require('nodemailer')
const { Parser } = require('json2csv')
const sqlConfigs = require('../configs/sql')
const authorize = require('../middleware/authorization.js')

async function portalDB() {
  const pool = new sql.ConnectionPool(sqlConfigs)
  try {
    await pool.connect()
    return pool
  } catch (err) {
    return err
  }
}

// Create a transporter object to define email service settings
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST, // SMTP host (e.g., 'smtp.gmail.com')
  port: process.env.EMAIL_PORT, // SMTP port (e.g., 587 for TLS)
  secure: false, // Use SSL/TLS (true for port 465, false otherwise)
  auth: {
    user: process.env.EMAIL_USER, // Email account username (e.g., your Gmail address)
    pass: process.env.EMAIL_PASS, // Email account password or app-specific password
  },
})

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
    await portalDBConnection.close() // Ensure the DB connection is closed
  }
}

// Add endpoint to generate the print form
router.post('/generate-print-form', authorize, async (req, res) => {
  const portalDBConnection = await portalDB()
  try {
    // Extract data from request body
    const { name, position, employeeID, date } = req.body

    const fontBytes = fs.readFileSync(
      path.join(__dirname, '../../../uploads/coc/fonts/AA_Stetica_Regular.otf')
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
    const textWidthTitle = documentFont.widthOfTextAtSize(title, fontSizeTitle)
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
    const fileName = `PRINTFORM_B11088_${Date.now()}.pdf`
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
  } catch (error) {
    res.status(500).json({ message: 'Form generation failed' })
  } finally {
    await portalDBConnection.close()
  }
})

// attachments storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../../uploads/coc/cocVersions'))
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`)
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
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5242880 }, // 5mb file limit
})

// Add endpoint to save CoC document
router.post(
  '/save-coc-document',
  authorize,
  upload.single('attachment'),
  async (req, res) => {
    const portalDBConnection = await portalDB()
    try {
      // Validate inputs
      if (
        !req.file ||
        !req.body.versionNumber ||
        !req.body.adminID ||
        !req.body.adminName
      ) {
        return res.status(400).json({ message: 'Missing required fields!' })
      }

      // check if the version number is already in the database
      const versionCheck = await portalDBConnection
        .request()
        .input('version_number', sql.NVarChar(20), req.body.versionNumber)
        .query(
          `SELECT id FROM coc.coc_versions WHERE version_number = @version_number`
        )

      if (versionCheck.recordset.length > 0) {
        return res
          .status(400)
          .json({ message: 'Version number must be unique!' })
      }

      // if it is a new version, add it to the database
      await portalDBConnection
        .request()
        .input('version_number', sql.NVarChar(20), req.body.versionNumber)
        .input('file_path', sql.NVarChar(255), req.file.filename)
        .input('admin_id', sql.NVarChar(20), req.body.adminID)
        .input('admin_name', sql.NVarChar(100), req.body.adminName)
        .execute('coc.coc_versions_addVersion')

      // return ok response
      res.status(201).json({
        message: 'Version uploaded successfully',
        filename: req.file.filename,
      })
    } catch (e) {
      const error = e.toString()
      const newErrorString = error.replaceAll('Error: ', '')
      res.status(500).json({
        message: `${newErrorString}`,
      })
    } finally {
      await portalDBConnection.close()
    }
  }
)

// Add endpoint to fetch versions
router.get('/get-coc-versions', authorize, async (req, res) => {
  const portalDBConnection = await portalDB()
  try {
    const result = await portalDBConnection
      .request()
      .query(`SELECT * FROM coc.coc_versions ORDER BY created_at DESC`)

    res.status(200).json(result.recordset)
  } catch (e) {
    const error = e.toString().replace('Error: ', '')
    res.status(500).json({ message: error })
  } finally {
    await portalDBConnection.close()
  }
})

// Add endpoint to fetch a single employee's data
router.post('/get-single-employee-data', authorize, async (req, res) => {
  const portalDBConnection = await portalDB()
  try {
    const employeeId = req.body.employeeID
    if (!employeeId) {
      return res.status(400).json({ message: 'Missing employee ID!' })
    }
    const result = await portalDBConnection
      .request()
      .input('employee_id', sql.NVarChar(20), employeeId).query(`
        SELECT
          e.*,
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
        WHERE e.employee_id = @employee_id
      `)
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Employee not found!' })
    }
    res.status(200).json(result.recordset[0])
  } catch (e) {
    const error = e.toString().replace('Error: ', '')
    res.status(500).json({ message: error })
  } finally {
    await portalDBConnection.close()
  }
})

// Configure multer for signed form uploads
const uploadSignedForm = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Define where uploaded signed forms will be temporarily stored
      cb(null, path.join(__dirname, '../../../uploads/coc/signedForms'))
    },
    filename: (req, file, cb) => {
      const employeeId = req.body.employeeID
      // Create a unique filename using employeeId and timestamp
      cb(null, `SIGNED_${employeeId}_${Date.now()}.pdf`)
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

// Uploads a signed CoC form, processes it, and notifies admins asynchronously
router.post(
  '/upload-signed-form',
  authorize,
  uploadSignedForm.single('signedForm'),
  async (req, res) => {
    let portalDBConnection
    try {
      // Establish connection to the database
      portalDBConnection = await portalDB()

      // Extract required data from the request
      const employeeId = req.body.employeeID
      const signedFormPath = req.file.path
      const employeeFullName = req.body.employeeName
      if (!employeeId || !signedFormPath) {
        throw new Error('Missing employeeId or signed form file')
      }

      // Process the signed form by appending it to the CoC and storing metadata
      const combinedPdfPath = await appendSignatureToCoC(
        employeeId,
        signedFormPath
      )
      await storeSignatureMetadata(employeeId, combinedPdfPath)

      // Insert submission history into the database
      const versionResult = await portalDBConnection.request().query(`
          SELECT TOP 1 id
          FROM coc.coc_versions
          WHERE active_flag = 1
          ORDER BY created_at DESC
        `)
      if (!versionResult.recordset[0]) {
        throw new Error('No active CoC version found')
      }
      const cocVersionId = versionResult.recordset[0].id
      await portalDBConnection
        .request()
        .input('employee_id', sql.NVarChar(20), employeeId)
        .input('coc_version_id', sql.Int, cocVersionId)
        .input('status', sql.NVarChar(20), 'pending')
        .input('file_path', sql.NVarChar(255), combinedPdfPath).query(`
          INSERT INTO coc.submission_history (employee_id, coc_version_id, status, file_path, submitted_at)
          VALUES (@employee_id, @coc_version_id, @status, @file_path, GETDATE())
        `)

      // Send immediate response to the frontend after main tasks are complete
      res.status(200).json({
        message: 'Signed form uploaded and processed successfully!',
      })

      // Asynchronously send notification emails to admins
      setImmediate(async () => {
        try {
          // Retrieve admin emails
          const adminEmails = await getAdminEmails()
          const subject = 'New CoC Form Submission'
          const text = `An employee has submitted a signed Code of Conduct form.\n\nEmployee ID: ${employeeId}\nEmployee Name: ${employeeFullName}\nSubmission Time: ${new Date().toLocaleString()}`
          const html = `<p>An employee has submitted a signed Code of Conduct form.</p><p><strong>Employee ID:</strong> ${employeeId}</p><p><strong>Employee Name:</strong> ${employeeFullName}</p><p><strong>Submission Time:</strong> ${new Date().toLocaleString()}</p>`
          const attachment = {
            filename: path.basename(combinedPdfPath),
            path: path.join(
              __dirname,
              '../../../uploads/coc/combinedDocuments',
              combinedPdfPath
            ),
          }

          // Send emails to all admins concurrently
          await Promise.all(
            adminEmails.map((email) =>
              sendEmail(email, subject, text, html, [attachment])
            )
          )
        } catch (error) {
          // Log any errors during admin notification
          throw new Error(error)
        } finally {
          // Close the database connection
          if (portalDBConnection) await portalDBConnection.close()
        }
      })

      // Clean up the temporary uploaded signed form file
      if (fs.existsSync(signedFormPath)) {
        fs.unlinkSync(signedFormPath)
      }
    } catch (error) {
      // Handle errors during main tasks
      res.status(500).json({ message: error.message })
    }
  }
)

// Function to append the signature page to the CoC document
async function appendSignatureToCoC(employeeId, signedFormPath) {
  const portalDBConnection = await portalDB()
  try {
    // Query the latest active CoC version from the database
    const result = await portalDBConnection.request().query(`
      SELECT TOP 1 file_path
      FROM coc.coc_versions
      WHERE active_flag = 1
      ORDER BY created_at DESC
    `)

    // Check if an active CoC version exists
    if (result.recordset.length === 0) {
      throw new Error('No active CoC version found')
    }

    // Construct the full path to the latest CoC document
    const cocFilePath = path.join(
      __dirname,
      '../../../uploads/coc/cocVersions',
      result.recordset[0].file_path
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
    const combinedFileName = `${employeeId}_Signed_Form_${Date.now()}.pdf`
    const combinedFilePath = path.join(
      __dirname,
      '../../../uploads/coc/combinedDocuments',
      combinedFileName
    )
    fs.writeFileSync(combinedFilePath, combinedPdfBytes)

    // Return the filename of the combined document (relative path for DB storage)
    return combinedFileName
  } finally {
    await portalDBConnection.close()
  }
}

async function storeSignatureMetadata(employeeId, combinedPdfPath) {
  const portalDBConnection = await portalDB()
  try {
    // Get the current active CoC version
    const versionResult = await portalDBConnection.request().query(`
      SELECT TOP 1 id
      FROM coc.coc_versions
      WHERE active_flag = 1
      ORDER BY created_at DESC
    `)
    if (versionResult.recordset.length === 0) {
      throw new Error('No active CoC version found')
    }
    const versionId = versionResult.recordset[0].id

    // Check if a signature already exists for this employee and version
    const existingRecord = await portalDBConnection
      .request()
      .input('employee_id', sql.NVarChar(20), employeeId)
      .input('coc_version_id', sql.Int, versionId).query(`
        SELECT id, status FROM coc.employee_signatures
        WHERE employee_id = @employee_id AND coc_version_id = @coc_version_id
      `)

    if (existingRecord.recordset.length > 0) {
      const status = existingRecord.recordset[0].status
      if (status === 'pending') {
        // If pending, update the existing record with the new file
        await portalDBConnection
          .request()
          .input('employee_id', sql.NVarChar(20), employeeId)
          .input('coc_version_id', sql.Int, versionId)
          .input('file_path', sql.NVarChar(255), combinedPdfPath)
          .input('signed_at', sql.DateTime, new Date()).query(`
            UPDATE coc.employee_signatures
            SET file_path = @file_path,
                signed_at = @signed_at
            WHERE employee_id = @employee_id AND coc_version_id = @coc_version_id
          `)
      } else if (status === 'rejected') {
        // If rejected, update the existing record with the new file and set status to 'pending'
        await portalDBConnection
          .request()
          .input('employee_id', sql.NVarChar(20), employeeId)
          .input('coc_version_id', sql.Int, versionId)
          .input('file_path', sql.NVarChar(255), combinedPdfPath)
          .input('signed_at', sql.DateTime, new Date()).query(`
            UPDATE coc.employee_signatures
            SET file_path = @file_path,
                signed_at = @signed_at,
                status = 'pending'
            WHERE employee_id = @employee_id AND coc_version_id = @coc_version_id
          `)
      } else {
        // If approved or rejected, prevent re-submission
        throw new Error('Signature already processed for this version')
      }
    } else {
      // Insert a new record with status 'pending'
      await portalDBConnection
        .request()
        .input('employee_id', sql.NVarChar(20), employeeId)
        .input('coc_version_id', sql.Int, versionId)
        .input('file_path', sql.NVarChar(255), combinedPdfPath)
        .input('signed_at', sql.DateTime, new Date())
        .input('status', sql.VarChar(20), 'pending').query(`
          INSERT INTO coc.employee_signatures (employee_id, coc_version_id, file_path, signed_at, status)
          VALUES (@employee_id, @coc_version_id, @file_path, @signed_at, @status)
        `)
    }
  } finally {
    await portalDBConnection.close()
  }
}

// Add endpoint to delete a specific version
/* Something still missing here! When a version is deleted, no active document is assigned!
The delete feature is disabled in the frontend for now. */
router.delete('/delete-version/:id', authorize, async (req, res) => {
  const portalDBConnection = await portalDB()
  try {
    // Get file path first
    const versionRecord = await portalDBConnection
      .request()
      .input('id', sql.Int, req.params.id)
      .query(`SELECT file_path FROM coc.coc_versions WHERE id = @id`)

    if (!versionRecord.recordset.length) {
      return res.status(404).json({ message: 'Version not found' })
    }

    const filePath = path.join(
      __dirname,
      '../../../uploads/coc/cocVersions',
      versionRecord.recordset[0].file_path
    )

    // Delete file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // Delete database record
    await portalDBConnection
      .request()
      .input('id', sql.Int, req.params.id)
      .query(`DELETE FROM coc.coc_versions WHERE id = @id`)

    res.status(200).json({ message: 'Version deleted successfully' })
  } catch (e) {
    const error = e.toString().replace('Error: ', '')
    res.status(500).json({ message: error })
  } finally {
    await portalDBConnection.close()
  }
})

router.get('/get-employee-compliance', authorize, async (req, res) => {
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
      ORDER BY e.employee_id
    `)
    res.status(200).json(result.recordset)
  } catch (e) {
    res.status(500).json({ message: e.message.replace('Error: ', '') })
  } finally {
    await portalDBConnection.close()
  }
})

router.post('/send-single-email', authorize, async (req, res) => {
  try {
    const employeeEmail = req.body.email
    const employeeName = req.body.name

    // Construct the notification email content
    const subject = 'Code of Conduct - Acknowledgement Request'
    const text = `Dear ${employeeName},\n\nPlease review and acknowledge the Code of Conduct at your earliest convenience.\n\nYou can access the submission page here: https://portal.alkholi.com/code-of-conduct/coc-form\n\nBest regards,\nHR Team`
    const html = `<p>Dear ${employeeName},</p><p>Please review and acknowledge the Code of Conduct at your earliest convenience.</p><p>You can access the submission page here: <a href="https://portal.alkholi.com/code-of-conduct/coc-form">Code of Conduct Form</a></p><p>Best regards,<br>HR Team</p>`

    // Send the approval email
    await sendEmail(employeeEmail, subject, text, html)

    res.status(200).json({ message: 'Email sent successfully' })
  } catch (e) {
    res.status(500).json({ message: e.message.replace('Error: ', '') })
  }
})

// Endpoint: /approve-signature
// Approves a signature and notifies the employee asynchronously
router.post('/approve-signature', authorize, async (req, res) => {
  let portalDBConnection
  try {
    // Establish connection to the database
    portalDBConnection = await portalDB()

    // Extract required data from the request
    const { signatureId, adminId } = req.body
    if (!signatureId) {
      return res.status(400).json({ message: 'Missing signature ID' })
    }

    // Update the signature status to 'approved' in the database
    await portalDBConnection
      .request()
      .input('id', sql.Int, signatureId)
      .input('approved_by', sql.NVarChar(20), adminId)
      .input('approved_at', sql.DateTime, new Date()).query(`
        UPDATE coc.employee_signatures
        SET status = 'approved',
            approved_by = @approved_by,
            approved_at = @approved_at
        WHERE id = @id AND status = 'pending'
      `)

    // get the employee ID and CoC version ID from the signature record
    const signature = await portalDBConnection
      .request()
      .input('id', sql.Int, signatureId).query(`
        SELECT employee_id, coc_version_id, file_path
        FROM coc.employee_signatures
        WHERE id = @id
      `)
    if (!signature.recordset[0]) {
      throw new Error('Signature not found')
    }
    const employeeId = signature.recordset[0].employee_id
    const cocVersionId = signature.recordset[0].coc_version_id
    const filePath = signature.recordset[0].file_path
    // update the submission history with the approved status
    await portalDBConnection
      .request()
      .input('employee_id', sql.NVarChar(20), employeeId)
      .input('coc_version_id', sql.Int, cocVersionId)
      .input('status', sql.NVarChar(20), 'approved')
      .input('file_path', sql.NVarChar(255), filePath)
      .input('approved_by', sql.NVarChar(20), adminId)
      .input('approved_at', sql.DateTime, new Date()).query(`
        INSERT INTO coc.submission_history (
          employee_id, coc_version_id, status, file_path, submitted_at, approved_by, approved_at
        )
        VALUES (
          @employee_id, @coc_version_id, @status, @file_path, GETDATE(), @approved_by, @approved_at
        )
      `)

    // Send immediate response to the frontend after main task is complete
    res.status(200).json({
      message: 'Signature approved successfully.',
    })

    // Asynchronously send notification email to the employee
    setImmediate(async () => {
      try {
        // Retrieve the employee ID associated with the signature
        const signature = await portalDBConnection
          .request()
          .input('id', sql.Int, signatureId)
          .query(
            `SELECT employee_id FROM coc.employee_signatures WHERE id = @id`
          )
        const employeeId = signature.recordset[0].employee_id

        // Fetch employee details (name and email)
        const employeeResult = await portalDBConnection
          .request()
          .input('employee_id', sql.NVarChar(20), employeeId)
          .query(
            `SELECT name_eng, email FROM coc.employees WHERE employee_id = @employee_id`
          )
        const employee = employeeResult.recordset[0]
        const firstName = employee.name_eng.split(' ')[0]
        const employeeEmail = employee.email

        // Prepare and send the approval notification email
        const subject = 'Your Code of Conduct Form Submission Was Approved'
        const text = `Dear ${firstName},\n\nYour recent submission for the Code of Conduct acknowledgment form has been reviewed and approved.\n\nThank you for completing this important step.\n\nBest regards,\nHR Team`
        const html = `<p>Dear ${firstName},</p><p>Your recent submission for the Code of Conduct acknowledgment form has been reviewed and <strong>approved</strong>.</p><p>Thank you for completing this important step.</p><p>Best regards,<br>HR Team</p>`
        await sendEmail(employeeEmail, subject, text, html)
      } catch (error) {
        throw new Error(error)
      } finally {
        // Close the database connection
        if (portalDBConnection) await portalDBConnection.close()
      }
    })
  } catch (e) {
    // Handle errors during main task
    res.status(500).json({ message: e.message.replace('Error: ', '') })
  }
})

// Endpoint: /reject-signature
// Rejects a signature and notifies the employee asynchronously
router.post('/reject-signature', authorize, async (req, res) => {
  let portalDBConnection
  try {
    // Establish connection to the database
    portalDBConnection = await portalDB()

    // Extract required data from the request
    const { signatureId } = req.body
    if (!signatureId) {
      return res.status(400).json({ message: 'Missing signature ID' })
    }

    // Update the signature status to 'rejected' in the database
    await portalDBConnection.request().input('id', sql.Int, signatureId).query(`
        UPDATE coc.employee_signatures
        SET status = 'rejected'
        WHERE id = @id AND status = 'pending'
      `)

    // get the employee ID and CoC version ID from the signature record
    const signature = await portalDBConnection
      .request()
      .input('id', sql.Int, signatureId).query(`
        SELECT employee_id, coc_version_id, file_path
        FROM coc.employee_signatures
        WHERE id = @id
      `)

    if (!signature.recordset[0]) {
      throw new Error('Signature not found')
    }
    const employeeId = signature.recordset[0].employee_id
    const cocVersionId = signature.recordset[0].coc_version_id
    const filePath = signature.recordset[0].file_path
    // update the submission history with the rejected status
    await portalDBConnection
      .request()
      .input('employee_id', sql.NVarChar(20), employeeId)
      .input('coc_version_id', sql.Int, cocVersionId)
      .input('status', sql.NVarChar(20), 'rejected')
      .input('file_path', sql.NVarChar(255), filePath)
      .input('approved_at', sql.DateTime, new Date()).query(`
        INSERT INTO coc.submission_history (
          employee_id, coc_version_id, status, file_path, submitted_at, approved_at
        )
        VALUES (
          @employee_id, @coc_version_id, @status, @file_path, GETDATE(), @approved_at
        )
      `)

    // Send immediate response to the frontend after main task is complete
    res.status(200).json({
      message: 'Signature rejected successfully.',
    })

    // Asynchronously send notification email to the employee
    setImmediate(async () => {
      try {
        // Retrieve the employee ID associated with the signature
        const signature = await portalDBConnection
          .request()
          .input('id', sql.Int, signatureId)
          .query(
            `SELECT employee_id FROM coc.employee_signatures WHERE id = @id`
          )
        const employeeId = signature.recordset[0].employee_id

        // Fetch employee details (name and email)
        const employeeResult = await portalDBConnection
          .request()
          .input('employee_id', sql.NVarChar(20), employeeId)
          .query(
            `SELECT name_eng, email FROM coc.employees WHERE employee_id = @employee_id`
          )
        const employee = employeeResult.recordset[0]
        const firstName = employee.name_eng.split(' ')[0]
        const employeeEmail = employee.email

        // Prepare and send the rejection notification email
        const subject =
          'Action Required: Your Code of Conduct Form Submission Was Rejected'
        const text = `Dear ${firstName},\n\nYour recent submission for the Code of Conduct acknowledgment form has been reviewed and rejected. Please review the form and resubmit it at your earliest convenience.\n\nYou can access the submission page here: https://portal.alkholi.com/code-of-conduct/coc-form\n\nIf you have any questions, please contact HR.\n\nBest regards,\nHR Team`
        const html = `<p>Dear ${firstName},</p><p>Your recent submission for the Code of Conduct acknowledgment form has been reviewed and <strong>rejected</strong>. Please review the form and resubmit it at your earliest convenience.</p><p>You can access the submission page <a href="https://portal.alkholi.com/code-of-conduct/coc-form">here</a>.</p><p>If you have any questions, please contact HR.</p><p>Best regards,<br>HR Team</p>`
        await sendEmail(employeeEmail, subject, text, html)
      } catch (error) {
        throw new Error(error)
      } finally {
        // Close the database connection
        if (portalDBConnection) await portalDBConnection.close()
      }
    })
  } catch (e) {
    // Handle errors during main task
    res.status(500).json({ message: e.message.replace('Error: ', '') })
  }
})

// Endpoint: /get-submissions-history
// Fetches the history of submissions made by employees
// This includes the status of each submission and the associated CoC version
router.get('/get-submissions-history', authorize, async (req, res) => {
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
  } catch (e) {
    res.status(500).json({ message: e.message.replace('Error: ', '') })
  } finally {
    if (portalDBConnection) await portalDBConnection.close()
  }
})

// export signed or unsigned employees report
router.get('/export-report', authorize, async (req, res) => {
  const portalDBConnection = await portalDB()
  try {
    const type = req.query.type
    const format = req.query.format || 'csv'

    if (!type || (type !== 'signed' && type !== 'unsigned')) {
      return res.status(400).json({ message: 'Invalid or missing report type' })
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
        WHERE es.status = 'approved' AND es.coc_version_id = @versionId
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
        WHERE es.id IS NULL OR es.status != 'approved'
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
  } catch (e) {
    res.status(500).json({ message: e.message.replace('Error: ', '') })
  } finally {
    await portalDBConnection.close()
  }
})

module.exports = router
