const path = require('path')
const fs = require('fs')
const express = require('express')
const router = express.Router()
const multer = require('multer')
const { PDFDocument, rgb } = require('pdf-lib')
const fontkit = require('@pdf-lib/fontkit')
const sql = require('mssql')
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

router.post('/generate-print-form', authorize, async (req, res) => {
  const portalDBConnection = await portalDB()
  try {
    // Extract data from request body
    const { name, position, employeeId, dateOfReceipt } = req.body

    const fontBytes = fs.readFileSync(
      path.join(__dirname, '../../../uploads/coc/fonts/Calibri.ttf')
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
    const fontSizeTitle = 20 // Title font size
    const fontSizeSubtitle = 18 // Subtitle font size
    const fontSizeSection = 16 // Section header font size
    const fontSizeField = 14 // Field label and paragraph font size

    // Add the logo
    const logoPath = path.join(__dirname, '../../../uploads/coc/logo.png')
    const logoBytes = fs.readFileSync(logoPath)
    const logoImage = await pdfDoc.embedPng(logoBytes) // Use embedJpg if it’s a JPEG
    const originalWidth = logoImage.width
    const originalHeight = logoImage.height
    const logoWidth = 100 // Desired width in points
    const logoHeight = (originalHeight / originalWidth) * logoWidth // Maintain aspect ratio
    const marginRight = 40 // Margin from right edge
    const marginTop = 40 // Margin from top edge
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
      y: 720,
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
    page.drawText('Employee Details:', {
      x: leftMargin,
      y: 660,
      size: fontSizeSection,
      font: documentFont,
      color: rgb(0, 0, 0),
    })

    // Draw employee information fields with data from request
    drawFormField(page, 'Name: ', name || 'Not Provided', 640)
    drawFormField(page, 'Position: ', position || 'Not Provided', 620)
    drawFormField(page, 'Employee ID: ', employeeId || 'Not Provided', 600)

    // Draw "Acknowledgement Details" section
    page.drawText('Acknowledgement Details:', {
      x: leftMargin,
      y: 570,
      size: fontSizeSection,
      font: documentFont,
      color: rgb(0, 0, 0),
    })

    // Draw the acknowledgement paragraph
    const paragraph =
      'I, the undersigned, hereby acknowledge that I have received and reviewed the Alkholi Group’s Code of Conduct. I understand that it is my responsibility to read, understand, and comply with the guidelines set forth in the Code of Conduct while performing my duties at Alkholi Group. I further acknowledge that failure to adhere to the Code of Conduct may result in disciplinary action in accordance with the company’s policies. I understand that if I have any questions or require clarification regarding any part of the Code of Conduct, I am encouraged to reach out to Human Resources or my supervisor.'
    page.drawText(paragraph, {
      x: leftMargin,
      y: 540,
      size: fontSizeField,
      font: documentFont,
      color: rgb(0, 0, 0),
      maxWidth: contentWidth,
      lineHeight: 18,
    })

    // Draw "Acknowledgement of Receipt" section
    page.drawText('Acknowledgement of Receipt:', {
      x: leftMargin,
      y: 380,
      size: fontSizeSection,
      font: documentFont,
      color: rgb(0, 0, 0),
    })

    // Draw receipt fields with data from request
    drawFormField(
      page,
      'Date of Receipt: ',
      dateOfReceipt || 'Not Provided',
      360
    )
    drawFormField(
      page,
      'Employee Signature: ',
      '...................................................',
      320
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

// Define the endpoint to handle signed form uploads
router.post(
  '/upload-signed-form',
  authorize, // Middleware to ensure the user is authenticated
  uploadSignedForm.single('signedForm'), // Handle single file upload with field name 'signedForm'
  async (req, res) => {
    const portalDBConnection = await portalDB()
    try {
      const employeeId = req.body.employeeID // Extract employeeId from request body
      const signedFormPath = req.file.path // Get the path of the uploaded signed form

      // Validate required fields
      if (!employeeId || !signedFormPath) {
        throw new Error('Missing employeeId or signed form file')
      }

      // Step 2: Append the signature page to the CoC document
      const combinedPdfPath = await appendSignatureToCoC(
        employeeId,
        signedFormPath
      )

      // Step 3: Store the combined document metadata in the database
      await storeSignatureMetadata(employeeId, combinedPdfPath)

      // Step 4: Update the employee's signature status
      await updateEmployeeSignatureStatus(employeeId)

      // Respond with success message
      res
        .status(200)
        .json({ message: 'Signed form uploaded and processed successfully' })

      // Clean up the temporary signed form file
      if (fs.existsSync(signedFormPath)) {
        fs.unlinkSync(signedFormPath)
      }
    } catch (error) {
      // Handle errors and send appropriate response
      res.status(500).json({ message: error.message })
    } finally {
      // Ensure database connection is closed
      await portalDBConnection.close()
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
    const combinedFileName = `COMBINED_${employeeId}_${Date.now()}.pdf`
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

// Function to store metadata of the combined document in the database
async function storeSignatureMetadata(employeeId, combinedPdfPath) {
  const portalDBConnection = await portalDB()
  try {
    // Get the ID of the latest active CoC version
    const versionResult = await portalDBConnection.request().query(`
      SELECT TOP 1 id
      FROM coc.coc_versions
      WHERE active_flag = 1
      ORDER BY created_at DESC
    `)
    const versionId = versionResult.recordset[0].id

    // Insert metadata into the employee_signatures table
    await portalDBConnection
      .request()
      .input('employee_id', sql.NVarChar(20), employeeId)
      .input('coc_version_id', sql.Int, versionId)
      .input('file_path', sql.NVarChar(255), combinedPdfPath)
      .input('signed_at', sql.DateTime, new Date()) // Record the signing timestamp
      .query(`
        INSERT INTO coc.employee_signatures (employee_id, coc_version_id, file_path, signed_at)
        VALUES (@employee_id, @coc_version_id, @file_path, @signed_at)
      `)
  } finally {
    await portalDBConnection.close()
  }
}

// Function to update the employee's signature status
async function updateEmployeeSignatureStatus(employeeId) {
  const portalDBConnection = await portalDB()
  try {
    // Update the employees table to reflect that the employee has signed
    await portalDBConnection
      .request()
      .input('employee_id', sql.NVarChar(20), employeeId).query(`
        UPDATE coc.employees
        SET has_signed = 1, last_signed_at = GETDATE()
        WHERE employee_id = @employee_id
      `)
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

module.exports = router
