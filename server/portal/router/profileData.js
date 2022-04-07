const path = require('path')
const fs = require('fs')
const express = require('express')
const router = express.Router()
const multer = require('multer')
const sql = require('mssql')
const sqlConfigs = require('../configs/sql')
const authorize = require('../middleware/authorization.js')

// attachments storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../../uploads/portal/usersProfileImages'))
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`)
  },
})

// attachments filter
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/jpg'
  ) {
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

router.post(
  '/save-user-profile',
  authorize,
  upload.single('attachment'),
  async (req, res) => {
    try {
      // delete the profile image from HDD if any
      await sql.connect(sqlConfigs)

      const profilePic = await sql.query`
      SELECT [portalProfilePicPath] from [dbo].[usersInfo]
      WHERE [employeeID] = ${req.body.employeeCode}
      `

      if (profilePic.rowsAffected[0] === 1) {
        if (profilePic.recordset[0].portalProfilePicPath !== null) {
          const filePath = path.join(
            __dirname,
            `../../../uploads/portal/usersProfileImages/${profilePic.recordset[0].portalProfilePicPath}`
          )
          fs.unlinkSync(filePath)
        }
      }

      // save the new profile picture path to db
      await sql.query`exec dbo.usersInfo_updateProfilePicPath
        ${req.body.employeeCode}, ${req.file.filename}
      `

      // send the reply
      return res.status(201).json({
        message: 'imgSuccess',
      })
    } catch (e) {
      const error = e.toString()
      const newErrorString = error.replaceAll('Error: ', '')
      res.status(500).json({
        message: `${newErrorString}`,
      })
    } finally {
      await sql.close()
    }
  }
)

router.post('/get-user-profile', authorize, async (req, res) => {
  try {
    // throw new Error(`Just an Error!!`)
    // connect to the db
    await sql.connect(sqlConfigs)

    // get the data
    const userInfo =
      await sql.query`exec dbo.usersInfo_getProfileData ${req.body.employeeID}`

    const result = userInfo.recordset[0]

    res.send(result)
  } catch (error) {
    res.status(500).json({
      message: `${error}`,
    })
  } finally {
    await sql.close()
  }
})

module.exports = router
