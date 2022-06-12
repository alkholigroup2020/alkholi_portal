const fs = require('fs')
const path = require('path')
const express = require('express')
const router = express.Router()
const multer = require('multer')
const sql = require('mssql')
const QRCode = require('qrcode')
const { createCanvas, loadImage } = require('canvas')
const sqlConfigs = require('../configs/sql')
const auth = require('../middleware/authorization')

async function portalDB() {
  const pool = new sql.ConnectionPool(sqlConfigs)
  try {
    await pool.connect()
    return pool
  } catch (err) {
    return err
  }
}
class CustomError extends Error {
  constructor(message, errorCode) {
    super(message) // this will replace the default 'message' property in the error - so it always take the message property name
    // this.name = 'Error:'
    this.statusCode = errorCode
  }
}

async function createQRCode(
  dataForQRcode,
  centerImage,
  qrBackgroundColor,
  qrFrontColor,
  width,
  cwidth
) {
  const canvas = createCanvas(width, width)
  QRCode.toCanvas(canvas, dataForQRcode, {
    color: {
      dark: qrFrontColor,
      light: qrBackgroundColor,
    },
    type: 'image/png',
    quality: 1,
    margin: 2,
    width,
    errorCorrectionLevel: 'M',
  })

  if (centerImage !== '') {
    const ctx = canvas.getContext('2d')
    const img = await loadImage(centerImage)
    const center = (width - cwidth) / 2
    // const center = width / 2
    ctx.drawImage(img, center, center, cwidth, cwidth)
    return canvas.toDataURL('image/png')
  }

  return canvas.toDataURL('image/png')
}

async function generateQR(
  employeeID,
  qrLogo,
  qrBackgroundColor,
  qrFrontColor,
  qrSize
) {
  try {
    const size = Number(qrSize)
    // check if adding an inner logo is required or not
    let logo
    if (qrLogo) {
      logo = `data:image/png;base64,${qrLogo}`
    } else {
      logo = ''
    }
    // call the createQRCode function to create the QR
    const qrCode = await createQRCode(
      `https://portal.alkholi.com/business-card/${employeeID}`,
      logo,
      qrBackgroundColor,
      qrFrontColor,
      size,
      size / 4
    )
    // wright the png file to disk
    const base64Image = qrCode.split(';base64,').pop()
    fs.writeFile(
      path.join(
        __dirname,
        `../../../uploads/businessCards/${employeeID}_QR_${qrSize}px.png`
      ),
      base64Image,
      { encoding: 'base64' },
      function (err) {
        if (err) throw new Error(err)
      }
    )
  } catch (error) {
    throw new Error(error)
  }
}

const generateID = async (min, max) => {
  const portalDBConnection = await portalDB()
  try {
    let ID = Math.floor(Math.random() * (max - min)) + min
    // check if the ID was already taken!

    const employeeIDCheck = await portalDBConnection.request().query(`
      exec [businessCards].[employeeData_checkIfExist] 'X${ID}'
    `)

    while (employeeIDCheck.recordset[0].exist > 0) {
      ID = Math.floor(Math.random() * (max - min)) + min
    }
    return ID
  } catch (error) {
    throw new Error(error)
  } finally {
    await portalDBConnection.close()
  }
}

const saveEmployeeData = async (
  payload,
  qrLogo,
  qrBackgroundColor,
  qrFrontColor,
  qrSize,
  companyLogo,
  employeePicture
) => {
  const portalDBConnection = await portalDB()
  try {
    const qrFileName = `${payload.employeeID}_QR_${qrSize}px.png`

    // check if the employee already exist in db or not

    const employeeCheck = await portalDBConnection.request().query(`
    exec businessCards.employeeData_checkIfExist '${payload.employeeID}'
    `)

    if (employeeCheck.recordset[0].exist > 0) {
      // the employee has a qr code - update his record
      // delete old files from the disk

      let empComLogo = companyLogo
      let empImage = employeePicture

      if (companyLogo) {
        const oldCompanyLogo = await portalDBConnection.request().query(`
          SELECT [companyLogo] from [businessCards].[employeeData] WHERE employeeID = '${payload.employeeID}'
        `)

        if (
          oldCompanyLogo.recordset.length > 0 &&
          oldCompanyLogo.recordset[0].companyLogo !== undefined
        ) {
          fs.unlinkSync(
            path.join(
              __dirname,
              `../../../uploads/businessCards/${oldCompanyLogo.recordset[0].companyLogo}`
            )
          )
        }
      } else {
        const oldCompanyLogo = await portalDBConnection.request().query(`
          SELECT [companyLogo] from [businessCards].[employeeData] WHERE employeeID = '${payload.employeeID}'
        `)
        empComLogo = oldCompanyLogo.recordset[0].companyLogo
      }

      if (employeePicture) {
        const oldEmployeePicture = await portalDBConnection.request().query(`
          SELECT [profilePic] from [businessCards].[employeeData] WHERE employeeID = '${payload.employeeID}'
        `)

        if (
          oldEmployeePicture.recordset.length > 0 &&
          oldEmployeePicture.recordset[0].profilePic !== undefined
        ) {
          fs.unlinkSync(
            path.join(
              __dirname,
              `../../../uploads/businessCards/${oldEmployeePicture.recordset[0].profilePic}`
            )
          )
        }
      } else {
        const oldEmployeePicture = await portalDBConnection.request().query(`
          SELECT [profilePic] from [businessCards].[employeeData] WHERE employeeID = '${payload.employeeID}'
        `)
        empImage = oldEmployeePicture.recordset[0].profilePic
      }

      const oldQrCode = await portalDBConnection.request().query(`
        SELECT [qrCodePath] from [businessCards].[employeeData] WHERE employeeID = '${payload.employeeID}'
      `)

      if (
        oldQrCode.recordset.length > 0 &&
        oldQrCode.recordset[0].qrCodePath !== undefined
      ) {
        fs.unlinkSync(
          path.join(
            __dirname,
            `../../../uploads/businessCards/${oldQrCode.recordset[0].qrCodePath}`
          )
        )
      }

      const employeeData = await portalDBConnection.request().query(`
        exec businessCards.employeeData_updateData '${payload.employeeID}',
        '${empComLogo}', '${empImage}', N'${payload.employeeArabicName}',
        '${payload.employeeEnglishName}', N'${payload.employeeArabicTitle}',
        '${payload.employeeEnglishTitle}', '${payload.employeeMobileNumber}',
        '${payload.employeeLandLines}', '${payload.employeeMailAddress}', '${
        payload.employeeWebSite
      }',
        '${qrFileName}', '${payload.employeeCompany}', ${
        payload.faxLine ? `'${payload.faxLine}'` : null
      }
      `)
      if (employeeData.rowsAffected[0] === 1) {
        // generate the QR code and will be saved on disk
        await generateQR(
          payload.employeeID,
          qrLogo,
          qrBackgroundColor,
          qrFrontColor,
          qrSize
        )
        return payload.employeeID
      }
    }

    const employeeData = await portalDBConnection.request().query(`
        exec businessCards.employeeData_addData '${payload.employeeID}',
        '${companyLogo}', '${employeePicture}', N'${
      payload.employeeArabicName
    }',
        '${payload.employeeEnglishName}', N'${payload.employeeArabicTitle}',
        '${payload.employeeEnglishTitle}', '${payload.employeeMobileNumber}',
        '${payload.employeeLandLines}', '${payload.employeeMailAddress}', '${
      payload.employeeWebSite
    }', '${qrFileName}', '${payload.employeeCompany}', ${
      payload.faxLine ? `'${payload.faxLine}'` : null
    }
      `)

    if (employeeData.rowsAffected[0] === 1) {
      // generate the QR code and will be saved on disk
      await generateQR(
        payload.employeeID,
        qrLogo,
        qrBackgroundColor,
        qrFrontColor,
        qrSize
      )
      return payload.employeeID
    }
  } catch (error) {
    throw new Error(error)
  } finally {
    await portalDBConnection.close()
  }
}

// attachments upload

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../../uploads/businessCards'))
  },
  filename: (req, file, cb) => {
    const extension = file.originalname.match(/\.([^.]*)$/)
    cb(
      null,
      `${req.body.employeeID}_${
        Math.floor(Math.random() * (999999 - 100001)) + 100001
      }${extension[0]}`
    )
  },
})
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/jpg'
  ) {
    cb(null, true)
  } else {
    return cb(new Error('Please upload a PNG, JPEG, or JPG file only!'), false)
  }
}
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5120000 },
})

const allFiles = upload.fields([
  { name: 'qrLogo', maxCount: 1 },
  { name: 'companyLogo', maxCount: 1 },
  { name: 'employeePicture', maxCount: 1 },
])

router.post('/save-employee-data', auth, allFiles, async (req, res) => {
  try {
    const qrBackgroundColor = req.body.bgColor
    const qrFrontColor = req.body.frColor
    let qrSize = req.body.qrSize
    if (qrSize === 'null') {
      qrSize = '300'
    }
    let qrLogo
    let companyLogo
    let employeePicture

    if (req.files) {
      if (req.files.qrLogo) {
        // convert the logo image to base64
        const imageAsBase64 = fs.readFileSync(
          req.files.qrLogo[0].path,
          'base64'
        )
        qrLogo = imageAsBase64
        // delete the logo file from the desk
        fs.unlinkSync(req.files.qrLogo[0].path)
      }
      if (req.files.companyLogo) {
        companyLogo = req.files.companyLogo[0].filename
      }
      if (req.files.employeePicture) {
        employeePicture = req.files.employeePicture[0].filename
      }
    }

    // if employee ID is defined
    const saveToDB = await saveEmployeeData(
      req.body,
      qrLogo,
      qrBackgroundColor,
      qrFrontColor,
      qrSize,
      companyLogo,
      employeePicture
    )

    // if no employee ID is defined
    if (req.body.employeeID === 'null') {
      const uniqueID = await generateID(10001, 99999)
      const employeeData = req.body
      employeeData.employeeID = `X${uniqueID}`
      const saveToDB = await saveEmployeeData(
        employeeData,
        qrLogo,
        qrBackgroundColor,
        qrFrontColor,
        qrSize,
        companyLogo,
        employeePicture
      )
      return res.status(200).send(saveToDB)
    }

    res.status(200).send(saveToDB)
  } catch (error) {
    // delete the newly uploaded files

    // fs.unlinkSync(
    //   path.join(
    //     __dirname,
    //     `../../../uploads/businessCards/${req.files.employeePicture[0].filename}`
    //   )
    // )

    // fs.unlinkSync(
    //   path.join(
    //     __dirname,
    //     `../../../uploads/businessCards/${req.files.companyLogo[0].filename}`
    //   )
    // )

    res.status(500).json({
      message: `${error}`,
    })
  }
})

router.post('/get-employee-data', auth, async (req, res) => {
  const portalDBConnection = await portalDB()
  try {
    // check if the employee has a QR code already
    const employeeCheck = await portalDBConnection.request().query(`
      exec [businessCards].[employeeData_checkIfExist] '${req.body.code}'
    `)

    if (employeeCheck.recordset[0].exist > 0) {
      // if he has QR code, then return the employee data
      const employeeData = await portalDBConnection.request().query(`
        SELECT * FROM businessCards.employeeData WHERE employeeID = '${req.body.code}'
      `)
      return res.status(200).send(employeeData.recordset[0])
    }

    throw new CustomError('noData', 501)
  } catch (e) {
    if (!e.statusCode) {
      const error = e.toString()
      const newErrorString = error.replaceAll('Error: ', '')
      res.status(500).json({
        message: `${newErrorString}`,
      })
    } else {
      res.status(e.statusCode).json({
        message: `${e.message}`,
      })
    }
  } finally {
    await portalDBConnection.close()
  }
})

module.exports = router
