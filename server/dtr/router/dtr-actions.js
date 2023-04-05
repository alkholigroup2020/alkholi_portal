const express = require('express')
const router = express.Router()
const sql = require('mssql')
// Import a date formatting library
const { format } = require('date-fns')
const sqlConfigs = require('../configs/sql')
// const hrSQLConfigs = require('../configs/hrSQL')
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

// async function hrDB() {
//   const pool = new sql.ConnectionPool(hrSQLConfigs)
//   try {
//     await pool.connect()
//     return pool
//   } catch (err) {
//     return err
//   }
// }

router.post('/save-dtr-data', auth, async (req, res) => {
  const portalDBConnection = await portalDB()

  try {
    // Format the date using the date-fns library
    const output = format(new Date(), 'yyyy-MM-dd HH:mm:ss')

    if (Array.isArray(req.body.dtrEntries)) {
      // Generate the SQL query with parameter placeholders
      const baseQuery = `
        INSERT INTO [dtr].[dtrEntries]
        ([EmployeeCode], [ManagerCode], [StartDate], [EndDate], [ModifiedDate], [ModifiedBy], [ApprovalStatus],
          [21], [22], [23], [24], [25], [26], [27], [28], [29], [30], [31], [1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11], [12], [13], [14], [15], [16], [17], [18], [19], [20]
        )
        VALUES
        (@employeeCode, @managerCode, @startingDate, @endingDate, @output, @dtrAdmin, 0,`

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
      request.input('employeeCode', req.body.employeeCode)
      request.input('managerCode', req.body.managerCode)
      request.input('startingDate', req.body.startingDate)
      request.input('endingDate', req.body.endingDate)
      request.input('output', output)
      request.input('dtrAdmin', req.body.dtrAdmin)

      req.body.dtrEntries.forEach((entry, index) => {
        request.input(`type${index}`, entry.type)
      })

      // Execute the query
      const theCall = await request.query(query)
      res.send(theCall)
    }
  } catch (e) {
    const statusCode = e.statusCode || 500
    const message = e.message || e.toString().replace('Error: ', '')
    res.status(statusCode).json({ message })
  } finally {
    await portalDBConnection.close()
  }
})

// router.post('/save-dtr-data', auth, async (req, res) => {
//   const portalDBConnection = await portalDB()

//   try {
//     const date = new Date()
//     const year = date.getFullYear()
//     const month = ('0' + (date.getMonth() + 1)).slice(-2)
//     const day = ('0' + date.getDate()).slice(-2)
//     const hours = ('0' + date.getHours()).slice(-2)
//     const minutes = ('0' + date.getMinutes()).slice(-2)
//     const seconds = ('0' + date.getSeconds()).slice(-2)
//     const output = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`

//     if (req.body.dtrEntries.length === 31) {
//       const theCall = await portalDBConnection.request().query(`
//       INSERT INTO [dtr].[dtrEntries]
//       ([EmployeeCode], [ManagerCode], [StartDate], [EndDate], [ModifiedDate], [ModifiedBy], [ApprovalStatus],
//         [21], [22], [23], [24], [25], [26], [27], [28], [29], [30], [31], [1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11], [12], [13], [14], [15], [16], [17], [18], [19], [20]
//       )
//       VALUES
//       ('${req.body.employeeCode}', '${req.body.managerCode}', '${req.body.startingDate}', '${req.body.endingDate}', '${output}', '${req.body.dtrAdmin}', 0,
//       '${req.body.dtrEntries[0].type}', '${req.body.dtrEntries[1].type}', '${req.body.dtrEntries[2].type}', '${req.body.dtrEntries[3].type}', '${req.body.dtrEntries[4].type}',
//       '${req.body.dtrEntries[5].type}', '${req.body.dtrEntries[6].type}', '${req.body.dtrEntries[7].type}', '${req.body.dtrEntries[8].type}', '${req.body.dtrEntries[9].type}',
//       '${req.body.dtrEntries[10].type}',  '${req.body.dtrEntries[11].type}', '${req.body.dtrEntries[12].type}', '${req.body.dtrEntries[13].type}', '${req.body.dtrEntries[14].type}',
//       '${req.body.dtrEntries[15].type}', '${req.body.dtrEntries[16].type}', '${req.body.dtrEntries[17].type}', '${req.body.dtrEntries[18].type}', '${req.body.dtrEntries[19].type}',
//       '${req.body.dtrEntries[20].type}', '${req.body.dtrEntries[21].type}', '${req.body.dtrEntries[22].type}', '${req.body.dtrEntries[23].type}', '${req.body.dtrEntries[24].type}',
//       '${req.body.dtrEntries[25].type}','${req.body.dtrEntries[26].type}', '${req.body.dtrEntries[27].type}', '${req.body.dtrEntries[28].type}', '${req.body.dtrEntries[29].type}',
//       '${req.body.dtrEntries[30].type}')`)
//       res.send(theCall.recordset)
//     } else if (req.body.dtrEntries.length === 30) {
//       const theCall = await portalDBConnection.request().query(`
//       INSERT INTO [dtr].[dtrEntries]
//       ([EmployeeCode], [ManagerCode], [StartDate], [EndDate], [ModifiedDate], [ModifiedBy], [ApprovalStatus],
//         [21], [22], [23], [24], [25], [26], [27], [28], [29], [30], [31], [1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11], [12], [13], [14], [15], [16], [17], [18], [19], [20]
//       )
//       VALUES
//       ('${req.body.employeeCode}', '${req.body.managerCode}', '${req.body.startingDate}', '${req.body.endingDate}', '${output}', '${req.body.dtrAdmin}', 0,
//       '${req.body.dtrEntries[0].type}', '${req.body.dtrEntries[1].type}', '${req.body.dtrEntries[2].type}', '${req.body.dtrEntries[3].type}', '${req.body.dtrEntries[4].type}',
//       '${req.body.dtrEntries[5].type}', '${req.body.dtrEntries[6].type}', '${req.body.dtrEntries[7].type}', '${req.body.dtrEntries[8].type}', '${req.body.dtrEntries[9].type}',
//       null, '${req.body.dtrEntries[10].type}', '${req.body.dtrEntries[11].type}', '${req.body.dtrEntries[12].type}', '${req.body.dtrEntries[13].type}',
//       '${req.body.dtrEntries[14].type}', '${req.body.dtrEntries[15].type}', '${req.body.dtrEntries[16].type}', '${req.body.dtrEntries[17].type}', '${req.body.dtrEntries[18].type}',
//       '${req.body.dtrEntries[19].type}', '${req.body.dtrEntries[20].type}', '${req.body.dtrEntries[21].type}', '${req.body.dtrEntries[22].type}', '${req.body.dtrEntries[23].type}',
//       '${req.body.dtrEntries[24].type}','${req.body.dtrEntries[25].type}', '${req.body.dtrEntries[26].type}', '${req.body.dtrEntries[27].type}', '${req.body.dtrEntries[28].type}',
//       '${req.body.dtrEntries[29].type}')`)
//       res.send(theCall.recordset)
//     } else if (req.body.dtrEntries.length === 29) {
//       const theCall = await portalDBConnection.request().query(`
//       INSERT INTO [dtr].[dtrEntries]
//       ([EmployeeCode], [ManagerCode], [StartDate], [EndDate], [ModifiedDate], [ModifiedBy], [ApprovalStatus],
//         [21], [22], [23], [24], [25], [26], [27], [28], [29], [30], [31], [1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11], [12], [13], [14], [15], [16], [17], [18], [19], [20]
//       )
//       VALUES
//       ('${req.body.employeeCode}', '${req.body.managerCode}', '${req.body.startingDate}', '${req.body.endingDate}', '${output}', '${req.body.dtrAdmin}', 0,
//       '${req.body.dtrEntries[0].type}', '${req.body.dtrEntries[1].type}', '${req.body.dtrEntries[2].type}', '${req.body.dtrEntries[3].type}', '${req.body.dtrEntries[4].type}',
//       '${req.body.dtrEntries[5].type}', '${req.body.dtrEntries[6].type}', '${req.body.dtrEntries[7].type}', '${req.body.dtrEntries[8].type}', null,
//       null, '${req.body.dtrEntries[9].type}', '${req.body.dtrEntries[10].type}', '${req.body.dtrEntries[11].type}', '${req.body.dtrEntries[12].type}',
//       '${req.body.dtrEntries[13].type}', '${req.body.dtrEntries[14].type}', '${req.body.dtrEntries[15].type}', '${req.body.dtrEntries[16].type}', '${req.body.dtrEntries[17].type}',
//       '${req.body.dtrEntries[18].type}', '${req.body.dtrEntries[19].type}', '${req.body.dtrEntries[20].type}', '${req.body.dtrEntries[21].type}', '${req.body.dtrEntries[22].type}',
//       '${req.body.dtrEntries[23].type}','${req.body.dtrEntries[24].type}', '${req.body.dtrEntries[25].type}', '${req.body.dtrEntries[26].type}', '${req.body.dtrEntries[27].type}',
//       '${req.body.dtrEntries[28].type}')`)
//       res.send(theCall.recordset)
//     } else {
//       const theCall = await portalDBConnection.request().query(`
//       INSERT INTO [dtr].[dtrEntries]
//       ([EmployeeCode], [ManagerCode], [StartDate], [EndDate], [ModifiedDate], [ModifiedBy], [ApprovalStatus],
//         [21], [22], [23], [24], [25], [26], [27], [28], [29], [30], [31], [1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11], [12], [13], [14], [15], [16], [17], [18], [19], [20]
//       )
//       VALUES
//       ('${req.body.employeeCode}', '${req.body.managerCode}', '${req.body.startingDate}', '${req.body.endingDate}', '${output}', '${req.body.dtrAdmin}', 0,
//       '${req.body.dtrEntries[0].type}', '${req.body.dtrEntries[1].type}', '${req.body.dtrEntries[2].type}', '${req.body.dtrEntries[3].type}', '${req.body.dtrEntries[4].type}',
//       '${req.body.dtrEntries[5].type}', '${req.body.dtrEntries[6].type}', '${req.body.dtrEntries[7].type}', null, null, null, '${req.body.dtrEntries[8].type}',
//       '${req.body.dtrEntries[9].type}', '${req.body.dtrEntries[10].type}', '${req.body.dtrEntries[11].type}', '${req.body.dtrEntries[12].type}', '${req.body.dtrEntries[13].type}',
//       '${req.body.dtrEntries[14].type}', '${req.body.dtrEntries[15].type}', '${req.body.dtrEntries[16].type}', '${req.body.dtrEntries[17].type}', '${req.body.dtrEntries[18].type}',
//       '${req.body.dtrEntries[19].type}', '${req.body.dtrEntries[20].type}', '${req.body.dtrEntries[21].type}', '${req.body.dtrEntries[22].type}', '${req.body.dtrEntries[23].type}',
//       '${req.body.dtrEntries[24].type}', '${req.body.dtrEntries[25].type}', '${req.body.dtrEntries[26].type}', '${req.body.dtrEntries[27].type}')`)
//       res.send(theCall.recordset)
//     }
//   } catch (e) {
//     if (!e.statusCode) {
//       const error = e.toString()
//       const newErrorString = error.replaceAll('Error: ', '')
//       res.status(500).json({
//         message: `${newErrorString}`,
//       })
//     } else {
//       res.status(e.statusCode).json({
//         message: `${e.message}`,
//       })
//     }
//   } finally {
//     await portalDBConnection.close()
//   }
// })

module.exports = router
