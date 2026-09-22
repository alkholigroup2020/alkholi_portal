const { randomUUID } = require('crypto')
const express = require('express')
const multer = require('multer')
const { PortalError } = require('../services/portalIdentity')

const MIME_EXTENSIONS = Object.freeze({
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
})

module.exports = function createProfileDataRouter({
  authorize,
  portalIdentity,
  uploadDirectory,
}) {
  const router = express.Router()
  const storage = multer.diskStorage({
    destination: uploadDirectory,
    filename(req, file, callback) {
      callback(
        null,
        `${Date.now()}-${randomUUID()}${MIME_EXTENSIONS[file.mimetype]}`
      )
    },
  })
  const upload = multer({
    storage,
    fileFilter(req, file, callback) {
      if (MIME_EXTENSIONS[file.mimetype]) return callback(null, true)
      return callback(new PortalError('fileTypeError', 400))
    },
    limits: {
      fileSize: 5242880,
      fieldSize: 1024,
      fields: 4,
      files: 1,
      parts: 5,
    },
  })

  router.post(
    '/save-user-profile',
    authorize,
    (req, res, next) => {
      upload.single('attachment')(req, res, (error) => {
        if (!error) return next()
        if (error.code === 'LIMIT_FILE_SIZE')
          return res.status(400).json({ message: 'fileTooLarge' })
        const status = error instanceof PortalError ? error.statusCode : 400
        return res.status(status).json({
          message:
            error instanceof PortalError ? error.message : 'invalidUpload',
        })
      })
    },
    async (req, res) => {
      try {
        const result = await portalIdentity.saveProfilePhoto(
          req.auth.employeeCode,
          req.file
        )
        return res.status(201).json({ message: 'imgSuccess', ...result })
      } catch (error) {
        const known = error instanceof PortalError
        return res.status(known ? error.statusCode : 503).json({
          message: known ? error.message : 'serviceUnavailable',
        })
      }
    }
  )

  router.post('/get-user-profile', authorize, async (req, res) => {
    try {
      const profile = await portalIdentity.getProfile(req.auth.employeeCode)
      return res.status(200).json(profile)
    } catch (error) {
      const known = error instanceof PortalError
      return res.status(known ? error.statusCode : 503).json({
        message: known ? error.message : 'serviceUnavailable',
      })
    }
  })

  return router
}
