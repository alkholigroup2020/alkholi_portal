const path = require('path')
const express = require('express')
const router = express.Router()
const vCardsJS = require('vcards-js')
const sql = require('mssql')
const short = require('short-uuid')
const sqlConfigs = require('../configs/sql')

async function portalDB() {
  const pool = new sql.ConnectionPool(sqlConfigs)
  try {
    await pool.connect()
    return pool
  } catch (err) {
    return err
  }
}

router.get('/vcard', async (req, res) => {
  const portalDBConnection = await portalDB()
  try {
    const uuid = short.uuid()

    await sql.connect(sqlConfigs)
    const employeeData = await portalDBConnection.request().query(`
      SELECT * FROM businessCards.employeeData WHERE employeeID = '${req.query.employeeID}'
    `)

    // create a new vCard
    const vCard = vCardsJS()

    if (employeeData.recordset[0].company === 'Custom') {
      vCard.firstName = employeeData.recordset[0].fullName_e
      vCard.uid = uuid
      vCard.cellPhone = `${employeeData.recordset[0].mobileNumber}`
      vCard.title = employeeData.recordset[0].title
      vCard.workPhone = employeeData.recordset[0].landLines
      vCard.workEmail = employeeData.recordset[0].mailAddress
      // just for the Dr. Hamza case!
      vCard.email = 'hbkholi@gmail.com'
      vCard.homeAddress.label = 'Address'
      vCard.homeAddress.street = req.query.firstAddress
      vCard.workAddress.label = 'Address'
      vCard.workAddress.street = req.query.secondAddress
      vCard.source = `https://portal.alkholi.com/portal-administrations/vcard/?employeeID=${employeeData.recordset[0].employeeID}` // set URL where the vCard can be found
      vCard.isOrganization = false // that fixes the iphone not saving the contact issue
      vCard.photo.embedFromFile(
        path.join(
          __dirname,
          `../../../uploads/businessCards/${employeeData.recordset[0].profilePic}`
        )
      )
      // set content-type and disposition including desired filename
      res.set(
        'Content-Type',
        `text/vcard; name="${employeeData.recordset[0].employeeID}.vcf"`
      )
      res.set(
        'Content-Disposition',
        `inline; filename="${employeeData.recordset[0].employeeID}.vcf"`
      )
      // send the response
      res.send(vCard.getFormattedString())
    } else {
      // set properties
      vCard.firstName = employeeData.recordset[0].fullName_e
      // vCard.middleName = 'J'
      // vCard.lastName = 'Nesser'
      vCard.organization = employeeData.recordset[0].company
      vCard.uid = uuid
      vCard.cellPhone = `${employeeData.recordset[0].mobileNumber}`
      // vCard.birthday = new Date(1985, 0, 1);
      vCard.title = employeeData.recordset[0].title
      vCard.url = employeeData.recordset[0].webSite
      // vCard.workUrl = ''
      // vCard.note = 'Notes on Eric';
      // vCard.nickname = 'Scarface';
      // vCard.namePrefix = 'Mr.';
      // vCard.nameSuffix = 'JR';
      // vCard.gender = 'M';
      // vCard.anniversary = new Date(2004, 0, 1);
      // vCard.role = 'Software Development';
      // vCard.homePhone = '312-555-1313'

      // ---> Land Lines
      if (employeeData.recordset[0].landLines !== 'undefined') {
        if (employeeData.recordset[0].landLines[0] === '9') {
          // the Elevators company land lines
          const A = employeeData.recordset[0].landLines.split(' ')
          const firstLandLineNumber = A[0]
          const secondLandLineNumber = A[2]
          vCard.workPhone = [
            `+966${firstLandLineNumber}`,
            `+966${secondLandLineNumber}`,
          ]
        } else {
          // all other land lines
          const A = employeeData.recordset[0].landLines.split(' ')
          const firstLandLineCode = A[0]
          const firstLandLineNumber = A[1]
          const secondLandLineCode = A[3]
          const secondLandLineNumber = A[4]
          const thirdLandLineCode = A[6]
          const thirdLandLineNumber = A[7]
          const X = firstLandLineCode.replace('(', '')
          const Y = X.replace(')', '')
          let N
          let Z
          if (secondLandLineCode) {
            const M = secondLandLineCode.replace('(', '')
            N = M.replace(')', '')
          }
          if (thirdLandLineCode) {
            const O = secondLandLineCode.replace('(', '')
            Z = O.replace(')', '')
          }

          // if no second or third lines
          if (!secondLandLineNumber && !thirdLandLineNumber) {
            vCard.workPhone = [`+966${Y}${firstLandLineNumber}`]
          }
          // if no third
          else if (!thirdLandLineNumber) {
            vCard.workPhone = [
              `+966${Y}${firstLandLineNumber}`,
              `${`+966${N}${secondLandLineNumber}`}`,
            ]
          }
          // if all are available
          else {
            vCard.workPhone = [
              `+966${Y}${firstLandLineNumber}`,
              `${`+966${N}${secondLandLineNumber}`}`,
              `${`+966${Z}${thirdLandLineNumber}`}`,
            ]
          }

          // vCard.workPhone = [
          //   `+966${Y}${firstLandLineNumber}`,
          //   `${
          //     secondLandLineCode != undefined
          //       ? `${`+966${N}${secondLandLineNumber}`}`
          //       : ''
          //   }`,
          //   `${
          //     thirdLandLineCode != undefined
          //       ? `${`+966${Z}${thirdLandLineNumber}`}`
          //       : null
          //   }`,
          // ]
        }
      }

      // vCard.workPhone = '312-555-1414';
      // // multiple cellphone
      // vCard.cellPhone = [`${A[0]}`, `${B[0]}`]
      // vCard.pagerPhone = '312-555-1515';
      // vCard.homeFax = '312-555-1616'

      // ---> Fax Lines
      if (employeeData.recordset[0].faxLine !== 'undefined') {
        const B = employeeData.recordset[0].faxLine.split(' ')
        const firstFaxLineCode = B[0]
        const firstFaxLineNumber = B[1]
        const secondFaxLineCode = B[3]
        const secondFaxLineNumber = B[4]
        const XX = firstFaxLineCode.replace('(', '')
        const YY = XX.replace(')', '')
        let NN
        if (secondFaxLineCode) {
          const MM = secondFaxLineCode.replace('(', '')
          NN = MM.replace(')', '')
        }

        // if no second fax line
        if (!secondFaxLineCode) {
          vCard.workFax = [`+966${YY}${firstFaxLineNumber}`]
        }
        // if all numbers are there
        else {
          vCard.workFax = [
            `+966${YY}${firstFaxLineNumber}`,
            `${`+966${NN}${secondFaxLineNumber}`}`,
          ]
        }

        // vCard.workFax = [
        //   `+966${YY}${firstFaxLineNumber}`,
        //   `${
        //     secondFaxLineCode != undefined
        //       ? `${`+966${NN}${secondFaxLineNumber}`}`
        //       : ''
        //   }`,
        //   `${
        //     employeeData.recordset[0].eFaxLine != undefined
        //       ? `${`+1${413}${employeeData.recordset[0].eFaxLine}`}`
        //       : ''
        //   }`,
        // ]
      }

      // vCard.email = 'e.nesser@emailhost.tld';
      vCard.workEmail = employeeData.recordset[0].mailAddress
      // vCard.source = 'http://mywebpage/myvcard.vcf' //set URL where the vCard can be found
      vCard.source = `https://portal.alkholi.com/portal-administrations/vcard/?employeeID=${employeeData.recordset[0].employeeID}` // set URL where the vCard can be found
      // vCard.homeAddress.label = 'Home Address'
      // vCard.homeAddress.street = '123 Main Street'
      // vCard.homeAddress.city = 'Chicago'
      // vCard.homeAddress.stateProvince = 'IL'
      // vCard.homeAddress.postalCode = '12345'
      // vCard.homeAddress.countryRegion = 'United States of America'
      // vCard.workAddress.label = 'Work Address'
      // vCard.workAddress.street = '123 Corporate Loop\nSuite 500'
      // vCard.workAddress.city = 'Los Angeles'
      // vCard.workAddress.stateProvince = 'CA'
      // vCard.workAddress.postalCode = '54321'
      // vCard.workAddress.countryRegion = 'United States of America'
      // // set social media URLs
      // vCard.socialUrls['facebook'] = 'https://...'
      // vCard.socialUrls['linkedIn'] = 'https://www.linkedin.com/company/alkholi-group-of-companies'
      // vCard.socialUrls['twitter'] = 'https://...'
      // vCard.socialUrls['flickr'] = 'https://...'
      // vCard.socialUrls['custom'] = 'https://...'
      // vCard.version = '3.0' //can also support 2.1 and 4.0, certain versions only support certain fields
      vCard.isOrganization = false // that fixes the iphone not saving the contact issue
      vCard.photo.embedFromFile(
        path.join(
          __dirname,
          `../../../uploads/businessCards/${employeeData.recordset[0].profilePic}`
        )
      )
      // vCard.logo.embedFromFile(
      //   path.join(
      //     __dirname,
      //     `../../../uploads/businessCards/Alkholi Group White.png`
      //     // `../../../uploads/businessCards/${
      //     //   employeeData.recordset[0].companyLogo == 'undefined'
      //     //     ? 'Alkholi Group White.png'
      //     //     : `${employeeData.recordset[0].companyLogo}`
      //     // }`
      //   )
      // )

      // set content-type and disposition including desired filename
      res.set(
        'Content-Type',
        `text/vcard; name="${employeeData.recordset[0].employeeID}.vcf"`
      )
      res.set(
        'Content-Disposition',
        `inline; filename="${employeeData.recordset[0].employeeID}.vcf"`
      )

      // save to file
      // vCard.saveToFile(
      //   path.join(
      //     __dirname,
      //     `../../../uploads/businessCards/${employeeData.recordset[0].employeeID}_Contact.vcf`
      //   )
      // )

      // send the response
      res.send(vCard.getFormattedString())

      // if (process.env.NODE_ENV === 'development') {
      //   return res
      //     .status(200)
      //     .redirect(
      //       `${process.env.baseURL_dev}portal-administrations/vcard/${employeeData.recordset[0].employeeID}_Contact.vcf`
      //     )
      // }

      // res
      //   .status(200)
      //   .redirect(
      //     `${process.env.baseURL_prod}portal-administrations/vcard/${employeeData.recordset[0].employeeID}_Contact.vcf`
      //   )
    }
  } catch (error) {
    res.status(401).json({
      message: `${error}`,
    })
  } finally {
    await portalDBConnection.close()
  }
})

module.exports = router
