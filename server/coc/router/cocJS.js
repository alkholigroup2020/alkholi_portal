const path = require('path')
const fs = require('fs')
const express = require('express')
const router = express.Router()
const multer = require('multer')
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

// attachments storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../../uploads/coc/cocDocuments'))
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

// Add endpoint to delete a specific version
/*
Something still missing here! When a version is deleted, no active document is assigned!
The delete feature is disabled in the frontend for now.
*/
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
      '../../../uploads/coc/cocDocuments',
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
