const sql = require('mssql')
const express = require('express')
const sqlConfigs = require('../configs/sql')
const hrSQLConfigs = require('../configs/hrSQL')
const router = express.Router()

async function portalDB() {
  const pool = new sql.ConnectionPool(sqlConfigs)
  try {
    await pool.connect()
    return pool
  } catch (err) {
    return err
  }
}

async function hrDB() {
  const pool = new sql.ConnectionPool(hrSQLConfigs)
  try {
    await pool.connect()
    return pool
  } catch (err) {
    return err
  }
}

// Main sync function
async function syncEmployees() {
  const hrDBConnection = await hrDB()
  const portalDBConnection = await portalDB()
  try {
    // Fetch employee data from HR database
    const employees = await fetchEmployeesFromHR(hrDBConnection)

    // Sync to portal database
    await syncToPortalDB(portalDBConnection, employees)
  } finally {
    if (hrDBConnection) await hrDBConnection.close()
    if (portalDBConnection) await portalDBConnection.close()
  }
}

// API endpoint to trigger sync
async function fetchEmployeesFromHR(hrDBConnection) {
  // Get company groups
  const groupsResult = await hrDBConnection.request().query(`
    SELECT [company_code], [company_desc_a], [company_desc_e], comp_logo 
    FROM [dbo].[adm_company]
  `)
  const groups = groupsResult.recordset

  // Get branches for each group
  const branchesPromises = groups.map(async (group) => {
    const branchRequest = hrDBConnection
      .request()
      .input('companyCode', sql.VarChar, group.company_code)
    const branchesResult = await branchRequest.query(`
      SELECT branch_code 
      FROM [dbo].[adm_branch] 
      WHERE company_code = @companyCode
    `)
    return branchesResult.recordset
  })

  const branchesResults = await Promise.all(branchesPromises)
  const allBranches = branchesResults.flat()

  // Get employees for each branch (now includes position)
  const employeesPromises = allBranches.map(async (branch) => {
    const employeeRequest = hrDBConnection
      .request()
      .input('branchCode', sql.VarChar, branch.branch_code)
    const employeesResult = await employeeRequest.query(`
      SELECT 
        A.employee_code, A.branch_code, A.employee_name_a, A.Email, 
        A.employee_name_eng, A.employee_picture, A.position 
      FROM 
        [MenaITech].[dbo].[Pay_employees] AS A
        INNER JOIN [MenaITech].[dbo].[pay_emp_finance] AS B 
          ON A.employee_code = B.employee_code
      WHERE 
        A.branch_code = @branchCode
        AND A.FDimension = '1'
        AND B.stop_val_flag = '0'
    `)
    return employeesResult.recordset
  })

  const employeesResults = await Promise.all(employeesPromises)
  const allEmployees = employeesResults.flat()

  // Get unique branch_code + position combinations
  const titlesMap = new Map()
  const uniquePairs = Array.from(
    new Set(allEmployees.map((emp) => `${emp.branch_code}|${emp.position}`))
  )

  // Fetch titles for each unique combination
  const titlesPromises = uniquePairs.map(async (pair) => {
    const [branchCode, systemCode] = pair.split('|')
    const titleRequest = hrDBConnection
      .request()
      .input('branchCode', sql.VarChar, branchCode)
      .input('systemCode', sql.VarChar, systemCode)

    const titleResult = await titleRequest.query(`
      SELECT system_desp_e, system_desp_a  
      FROM [MenaITech].[dbo].[pay_code_tables] 
      WHERE system_code_type = '21' 
        AND branch_code = @branchCode 
        AND system_code = @systemCode
    `)

    return {
      key: pair,
      title: titleResult.recordset[0] || {
        system_desp_e: null,
        system_desp_a: null,
      },
    }
  })

  const titlesResults = await Promise.all(titlesPromises)
  titlesResults.forEach(({ key, title }) => titlesMap.set(key, title))

  // Add titles to employees
  allEmployees.forEach((emp) => {
    const key = `${emp.branch_code}|${emp.position}`
    const title = titlesMap.get(key) || {}
    emp.title_e = title.system_desp_e
    emp.title_a = title.system_desp_a
  })

  return allEmployees
}

// Sync employees to portal database
async function syncToPortalDB(portalDBConnection, employees) {
  for (const emp of employees) {
    const employeeId = emp.employee_code
    const nameEng = emp.employee_name_eng
    const nameA = emp.employee_name_a
    const branchCode = emp.branch_code
    const email = emp.Email
    const employeePicture = emp.employee_picture
    const position = emp.position
    const titleE = emp.title_e
    const titleA = emp.title_a

    // Check if employee exists
    const existsResult = await portalDBConnection
      .request()
      .input('employee_id', sql.NVarChar(20), employeeId)
      .query(
        `SELECT employee_id FROM coc.employees WHERE employee_id = @employee_id`
      )

    if (existsResult.recordset.length > 0) {
      // Update existing employee
      await portalDBConnection
        .request()
        .input('employee_id', sql.NVarChar(20), employeeId)
        .input('name_eng', sql.NVarChar(100), nameEng)
        .input('name_a', sql.NVarChar(100), nameA)
        .input('branch_code', sql.NVarChar(50), branchCode)
        .input('email', sql.NVarChar(100), email)
        .input('employee_picture', sql.NVarChar(255), employeePicture)
        .input('position', sql.NVarChar(100), position)
        .input('title_e', sql.NVarChar(100), titleE)
        .input('title_a', sql.NVarChar(100), titleA).query(`
          UPDATE coc.employees
          SET name_eng = @name_eng,
              name_a = @name_a,
              branch_code = @branch_code,
              email = @email,
              employee_picture = @employee_picture,
              position = @position,
              title_e = @title_e,
              title_a = @title_a
          WHERE employee_id = @employee_id
        `)
    } else {
      // Insert new employee
      await portalDBConnection
        .request()
        .input('employee_id', sql.NVarChar(20), employeeId)
        .input('name_eng', sql.NVarChar(100), nameEng)
        .input('name_a', sql.NVarChar(100), nameA)
        .input('branch_code', sql.NVarChar(50), branchCode)
        .input('email', sql.NVarChar(100), email)
        .input('employee_picture', sql.NVarChar(255), employeePicture)
        .input('position', sql.NVarChar(100), position)
        .input('title_e', sql.NVarChar(100), titleE)
        .input('title_a', sql.NVarChar(100), titleA).query(`
          INSERT INTO coc.employees 
          (employee_id, name_eng, name_a, branch_code, email, 
           employee_picture, position, title_e, title_a)
          VALUES (@employee_id, @name_eng, @name_a, @branch_code, @email, 
                  @employee_picture, @position, @title_e, @title_a)
        `)
    }
  }
}

// Export both the router and syncEmployees function
module.exports = {
  router,
  syncEmployees,
}
