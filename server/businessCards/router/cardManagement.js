const express = require('express')
const multer = require('multer')
const { CardError } = require('../services/cardManagement')

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg'])
const UPLOAD_FIELDS = ['qrLogo', 'companyLogo', 'employeePicture']

function sendError(res, error) {
  const known = error instanceof CardError
  return res.status(known ? error.statusCode : 503).json({
    message: known ? error.message : 'serviceUnavailable',
  })
}

// `cardsAdminOnly` is [authorize, requireBusinessCardsAdmin]. The caller is
// always `req.auth.employeeCode`; body values only describe the target card.
module.exports = function createCardManagementRouter({
  cardsAdminOnly,
  cardManagement,
}) {
  const router = express.Router()

  // Files stay in memory until the card is validated, so a rejected request
  // leaves nothing in the public upload directory.
  const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter(req, file, callback) {
      if (IMAGE_TYPES.has(file.mimetype)) return callback(null, true)
      return callback(new CardError('fileTypeError', 400))
    },
    limits: {
      fileSize: 5120000,
      fieldSize: 2048,
      fields: 24,
      files: 3,
      parts: 27,
    },
  }).fields(UPLOAD_FIELDS.map((name) => ({ name, maxCount: 1 })))

  function receiveUploads(req, res, next) {
    upload(req, res, (error) => {
      if (!error) return next()
      if (error instanceof CardError) return sendError(res, error)
      if (error.code === 'LIMIT_FILE_SIZE')
        return res.status(400).json({ message: 'fileTooLarge' })
      // Oversized or too many text fields are a data problem, not a file one.
      return res.status(400).json({
        message: /^LIMIT_(FIELD|PART)_/.test(error.code || '')
          ? 'invalidCardData'
          : 'invalidUpload',
      })
    })
  }

  router.get('/cards', ...cardsAdminOnly, async (req, res) => {
    res.set('Cache-Control', 'no-store')
    try {
      return res.status(200).json(await cardManagement.listCards())
    } catch (error) {
      return sendError(res, error)
    }
  })

  router.get('/cards/:employeeCode', ...cardsAdminOnly, async (req, res) => {
    res.set('Cache-Control', 'no-store')
    try {
      return res
        .status(200)
        .json(await cardManagement.getCard(req.params.employeeCode))
    } catch (error) {
      return sendError(res, error)
    }
  })

  router.get('/activity-logs', ...cardsAdminOnly, async (req, res) => {
    res.set('Cache-Control', 'no-store')
    try {
      return res.status(200).json(await cardManagement.listActivityLogs())
    } catch (error) {
      return sendError(res, error)
    }
  })

  // Authorization runs before multer reads any upload.
  router.post(
    '/save-employee-data',
    ...cardsAdminOnly,
    receiveUploads,
    async (req, res) => {
      try {
        const files = {}
        for (const name of UPLOAD_FIELDS)
          if (req.files && req.files[name]) files[name] = req.files[name][0]
        return res.status(200).json(
          await cardManagement.saveCard({
            actorCode: req.auth.employeeCode,
            fields: req.body,
            files,
          })
        )
      } catch (error) {
        return sendError(res, error)
      }
    }
  )

  router.post('/delete-business-card', ...cardsAdminOnly, async (req, res) => {
    try {
      return res.status(200).json(
        await cardManagement.deleteCard({
          actorCode: req.auth.employeeCode,
          employeeCode:
            req.body && typeof req.body === 'object'
              ? req.body.bCardID
              : undefined,
        })
      )
    } catch (error) {
      return sendError(res, error)
    }
  })

  return router
}
