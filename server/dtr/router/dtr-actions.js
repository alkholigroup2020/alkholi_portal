const express = require('express')
const router = express.Router()
const sql = require('mssql')
const { format } = require('date-fns')
const sqlConfigs = require('../configs/sql')
const auth = require('../middleware/authorization')

// Moved the portalDB function outside of the route handler to avoid creating a new connection pool every time the route is called
const pool = new sql.ConnectionPool(sqlConfigs)

async function portalDB() {
  try {
    await pool.connect()
    return pool
  } catch (err) {
    return err
  }
}

router.post('/save-dtr-data', auth, async (req, res) => {
  try {
    // formate the log date value
    const logDate = format(new Date(), 'yyyy-MM-dd HH:mm:ss')

    // Ensure the connection is established before executing the query
    const portalDBConnection = await portalDB()

    // Destructure the required properties from req.body
    const {
      employeeCode,
      employeeName,
      employeePicture,
      startingDate,
      endingDate,
    } = req.body

    const Q =
      'exec [dtr].[dtrEntries_checkIfExist] @employeeCode, @startingDate, @endingDate'

    const dtrEntryCheck = await portalDBConnection
      .request()
      .input('employeeCode', sql.VarChar, employeeCode)
      .input('startingDate', sql.Date, startingDate)
      .input('endingDate', sql.Date, endingDate)
      .query(Q)

    const checkResult = dtrEntryCheck.recordset[0].dtrEntry

    if (checkResult === 1) {
      // Generate the SQL query with parameter placeholders
      const baseQuery = `UPDATE [dtr].[dtrEntries]
      SET [EmployeeCode] = @employeeCode,
          [employeeName] = @employeeName
          [employeePicture] = @employeePicture
          [ManagerCode] = @managerCode,
          [StartDate] = @startingDate,
          [EndDate] = @endingDate,
          [ModifiedDate] = @logDate,
          [ModifiedBy] = @dtrAdmin,
          [ApprovalStatus] = 0,
          [21] = @type0,
          [22] = @type1,
          [23] = @type2,
          [24] = @type3,
          [25] = @type4,
          [26] = @type5,
          [27] = @type6,
          [28] = @type7,
          [29] = @type8,
          [30] = @type9,
          [31] = @type10,
          [1] = @type11,
          [2] = @type12,
          [3] = @type13,
          [4] = @type14,
          [5] = @type15,
          [6] = @type16,
          [7] = @type17,
          [8] = @type18,
          [9] = @type19,
          [10] = @type20,
          [11] = @type21,
          [12] = @type22,
          [13] = @type23,
          [14] = @type24,
          [15] = @type25,
          [16] = @type26,
          [17] = @type27,
          [18] = @type28,
          [19] = @type29,
          [20] = @type30
      WHERE [EmployeeCode] = @employeeCode AND [StartDate] = @startingDate AND [EndDate] = @endingDate`

      // Prepare the SQL request
      const request = portalDBConnection.request()

      // Add parameters to the request
      request.input('employeeCode', req.body.employeeCode)
      request.input('employeeName', employeeName)
      request.input('employeePicture', employeePicture)
      request.input('managerCode', req.body.managerCode)
      request.input('startingDate', req.body.startingDate)
      request.input('endingDate', req.body.endingDate)
      request.input('logDate', logDate)
      request.input('dtrAdmin', req.body.dtrAdmin)

      req.body.dtrEntries.forEach((entry, index) => {
        request.input(`type${index}`, entry.type)
      })

      // Execute the query
      const theCall = await request.query(baseQuery)
      res.send(theCall.rowsAffected)
    } else {
      // Generate the SQL query with parameter placeholders
      const baseQuery = `INSERT INTO [dtr].[dtrEntries]
        ([EmployeeCode], [employeeName], [employeePicture], [ManagerCode], [StartDate], [EndDate], [ModifiedDate], [ModifiedBy], [ApprovalStatus],
          [21], [22], [23], [24], [25], [26], [27], [28], [29], [30], [31], [1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11], [12], [13], [14], [15], [16], [17], [18], [19], [20]
        )
        VALUES
        (@employeeCode, @employeeName, @employeePicture, @managerCode, @startingDate, @endingDate, @logDate, @dtrAdmin, 0,`

      // Generate placeholders for dtrEntries
      let dtrEntryPlaceholders
      if (req.body.dtrEntries.length === 31) {
        dtrEntryPlaceholders = req.body.dtrEntries
          .map((_, index) => `@type${index}`)
          .join(', ')
      } else if (req.body.dtrEntries.length === 30) {
        const entriesArray = req.body.dtrEntries
        entriesArray.splice(10, 0, { date: 31, type: null })
        dtrEntryPlaceholders = entriesArray
          .map((_, index) => `@type${index}`)
          .join(', ')
      } else if (req.body.dtrEntries.length === 29) {
        const entriesArray = req.body.dtrEntries
        entriesArray.splice(9, 0, { date: 30, type: null })
        entriesArray.splice(10, 0, { date: 31, type: null })
        dtrEntryPlaceholders = entriesArray
          .map((_, index) => `@type${index}`)
          .join(', ')
      } else if (req.body.dtrEntries.length === 28) {
        const entriesArray = req.body.dtrEntries
        entriesArray.splice(8, 0, { date: 29, type: null })
        entriesArray.splice(9, 0, { date: 30, type: null })
        entriesArray.splice(10, 0, { date: 31, type: null })
        dtrEntryPlaceholders = entriesArray
          .map((_, index) => `@type${index}`)
          .join(', ')
      }

      const query = baseQuery + dtrEntryPlaceholders + ')'

      // Prepare the SQL request
      const request = portalDBConnection.request()

      // Add parameters to the request
      request.input('employeeCode', employeeCode)
      request.input('employeeName', employeeName)
      request.input('employeePicture', employeePicture)
      request.input('managerCode', req.body.managerCode)
      request.input('startingDate', startingDate)
      request.input('endingDate', endingDate)
      request.input('logDate', logDate)
      request.input('dtrAdmin', req.body.dtrAdmin)

      req.body.dtrEntries.forEach((entry, index) => {
        request.input(`type${index}`, entry.type)
      })

      // Execute the query
      const theCall = await request.query(query)
      res.send(theCall.rowsAffected)
    }
  } catch (e) {
    const statusCode = e.statusCode || 500
    const message = e.message || e.toString().replace('Error: ', '')
    res.status(statusCode).json({ message })
  } finally {
    // Only close the connection if it exists
    if (pool.connected) {
      await pool.close()
    }
  }
})

module.exports = router

// Mine

// const express = require('express')
// const router = express.Router()
// const sql = require('mssql')
// // Import a date formatting library
// const { format } = require('date-fns')
// const sqlConfigs = require('../configs/sql')
// // const hrSQLConfigs = require('../configs/hrSQL')
// const auth = require('../middleware/authorization')

// async function portalDB() {
//   const pool = new sql.ConnectionPool(sqlConfigs)
//   try {
//     await pool.connect()
//     return pool
//   } catch (err) {
//     return err
//   }
// }

// async function hrDB() {
//   const pool = new sql.ConnectionPool(hrSQLConfigs)
//   try {
//     await pool.connect()
//     return pool
//   } catch (err) {
//     return err
//   }
// }

// router.post('/save-dtr-data', auth, async (req, res) => {
//   const portalDBConnection = await portalDB()

//   try {
//     // Format the date using the date-fns library
//     const logDate = format(new Date(), 'yyyy-MM-dd HH:mm:ss')
//     const employeeCode = req.body.employeeCode
//     const startingDate = req.body.startingDate
//     const endingDate = req.body.endingDate

//     // check if the dtr entry was already there
//     const dtrEntryCheck = await portalDBConnection
//       .request()
//       .query(
//         `exec [dtr].[dtrEntries_checkIfExist] '${employeeCode}', '${startingDate}', '${endingDate}'`
//       )

//     console.log('🚀 dtrEntryCheck:', dtrEntryCheck.recordset[0].dtrEntry)

//     // if (dtrEntryCheck === 1) {
//     //   //
//     // } else {
//     //   //
//     // }

//     // const request = portalDBConnection.request()

//     // request.input('employeeCode', sql.VarChar, employeeCode)
//     // request.input('startingDate', sql.Date, startingDate)
//     // request.input('endingDate', sql.Date, endingDate)

//     // const result = await request.execute('[dtr].[dtrEntries_checkIfExist]')
//     // console.log('🚀 result:', result)

//     if (Array.isArray(req.body.dtrEntries)) {
//       // Generate the SQL query with parameter placeholders
//       const baseQuery = `
//         INSERT INTO [dtr].[dtrEntries]
//         ([EmployeeCode], [ManagerCode], [StartDate], [EndDate], [ModifiedDate], [ModifiedBy], [ApprovalStatus],
//           [21], [22], [23], [24], [25], [26], [27], [28], [29], [30], [31], [1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11], [12], [13], [14], [15], [16], [17], [18], [19], [20]
//         )
//         VALUES
//         (@employeeCode, @managerCode, @startingDate, @endingDate, @logDate, @dtrAdmin, 0,`

//       // Generate placeholders for dtrEntries
//       let dtrEntryPlaceholders
//       if (req.body.dtrEntries.length === 31) {
//         dtrEntryPlaceholders = req.body.dtrEntries
//           .map((_, index) => `@type${index}`)
//           .join(', ')
//       } else if (req.body.dtrEntries.length === 30) {
//         const entriesArray = req.body.dtrEntries
//         entriesArray.splice(10, 0, { date: 31, type: null })
//         dtrEntryPlaceholders = entriesArray
//           .map((_, index) => `@type${index}`)
//           .join(', ')
//       } else if (req.body.dtrEntries.length === 29) {
//         const entriesArray = req.body.dtrEntries
//         entriesArray.splice(9, 0, { date: 30, type: null })
//         entriesArray.splice(10, 0, { date: 31, type: null })
//         dtrEntryPlaceholders = entriesArray
//           .map((_, index) => `@type${index}`)
//           .join(', ')
//       } else if (req.body.dtrEntries.length === 28) {
//         const entriesArray = req.body.dtrEntries
//         entriesArray.splice(8, 0, { date: 29, type: null })
//         entriesArray.splice(9, 0, { date: 30, type: null })
//         entriesArray.splice(10, 0, { date: 31, type: null })
//         dtrEntryPlaceholders = entriesArray
//           .map((_, index) => `@type${index}`)
//           .join(', ')
//       }

//       const query = baseQuery + dtrEntryPlaceholders + ')'

//       // Prepare the SQL request
//       const request = portalDBConnection.request()

//       // Add parameters to the request
//       request.input('employeeCode', req.body.employeeCode)
//       request.input('managerCode', req.body.managerCode)
//       request.input('startingDate', req.body.startingDate)
//       request.input('endingDate', req.body.endingDate)
//       request.input('logDate', logDate)
//       request.input('dtrAdmin', req.body.dtrAdmin)

//       req.body.dtrEntries.forEach((entry, index) => {
//         request.input(`type${index}`, entry.type)
//       })

//       // Execute the query
//       const theCall = await request.query(query)
//       res.send(theCall)
//     }
//   } catch (e) {
//     const statusCode = e.statusCode || 500
//     const message = e.message || e.toString().replace('Error: ', '')
//     res.status(statusCode).json({ message })
//   } finally {
//     await portalDBConnection.close()
//   }
// })

// module.exports = router
