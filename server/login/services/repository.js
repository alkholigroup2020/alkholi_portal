const { AuthError } = require('./errors')
const { TOKEN_MAX_LENGTH } = require('./session')

function createRepository({ sql, portalConfig, hrConfig }) {
  async function withPool(config, operation) {
    const pool = new sql.ConnectionPool(config)
    try {
      await pool.connect()
      return await operation(pool)
    } finally {
      // A cleanup failure must not replace the original database error.
      await pool.close().catch(() => {})
    }
  }

  function input(request, name, type, length, value) {
    if (
      value !== null &&
      value !== undefined &&
      String(value).length > length
    ) {
      throw new AuthError('accountDataInvalid', 503)
    }
    return request.input(
      name,
      type(length),
      value == null ? null : String(value)
    )
  }

  const portal = (operation) => withPool(portalConfig, operation)
  const hr = (operation) => withPool(hrConfig, operation)

  return {
    getMoreInfo(email) {
      return hr(async (pool) => {
        const result = await input(
          pool.request(),
          'email',
          sql.VarChar,
          100,
          email
        )
          .query(`SELECT company_code, employee_code, branch_code, employee_name_a,
            first_name_a, second_name_a, third_name_a, family_name_a, employee_picture,
            employee_name_eng, first_name_e, second_name_e, third_name_e, family_name_e,
            Manager_Code, Email, position
            FROM dbo.Pay_employees WHERE Email = @email`)
        if (result.recordset.length !== 1)
          throw new AuthError('hrDataMissing', 404)
        const employee = result.recordset[0]
        const position = Number(employee.position)
        if (!Number.isFinite(position))
          throw new AuthError('hrTitleMissing', 404)
        const request = pool.request()
        input(request, 'position', sql.VarChar, 15, position)
        input(request, 'branch', sql.VarChar, 10, employee.branch_code)
        const titles = await request.query(`SELECT system_desp_a, system_desp_e
          FROM dbo.pay_code_tables WHERE system_code = @position
          AND branch_code = @branch AND system_code_type = '21'`)
        if (!titles.recordset.length) throw new AuthError('hrTitleMissing', 404)
        const { position: unusedPosition, ...moreInfo } = employee
        return {
          ...moreInfo,
          title: titles.recordset[0].system_desp_e,
          title_a: titles.recordset[0].system_desp_a,
        }
      })
    },
    getManagerInfo(employeeCode) {
      return hr(async (pool) => {
        const result = await input(
          pool.request(),
          'employeeCode',
          sql.VarChar,
          15,
          employeeCode
        ).query(
          'SELECT Email FROM dbo.Pay_employees WHERE employee_code = @employeeCode'
        )
        if (!result.recordset.length)
          throw new AuthError('hrManagerMessing', 404)
        return result.recordset[0]
      })
    },
    saveLogin({ moreInfo, managerInfo, user, encryptedPassword, token }) {
      return portal(async (pool) => {
        const check = await input(
          pool.request(),
          'employeeID',
          sql.VarChar,
          20,
          moreInfo.employee_code
        ).execute('dbo.userInfo_checkIfExist')
        const request = pool.request()
        // Types/sizes verified against production metadata; reject truncation.
        input(request, 'employeeID', sql.VarChar, 20, moreInfo.employee_code)
        input(request, 'fullName', sql.VarChar, 50, user.cn)
        input(request, 'groupID', sql.VarChar, 300, encryptedPassword)
        input(request, 'company', sql.VarChar, 25, moreInfo.company_code)
        input(
          request,
          'profilePicPath',
          sql.NVarChar,
          300,
          moreInfo.employee_picture
        )
        input(request, 'mailAddress', sql.VarChar, 50, user.mail)
        input(request, 'branch', sql.VarChar, 50, moreInfo.branch_code)
        input(
          request,
          'arabicName',
          sql.NVarChar,
          100,
          moreInfo.employee_name_a
        )
        input(request, 'managerCode', sql.VarChar, 25, moreInfo.Manager_Code)
        input(request, 'managerEmail', sql.VarChar, 50, managerInfo.Email)
        input(request, 'title', sql.VarChar, 100, moreInfo.title)
        input(request, 'arabicTitle', sql.NVarChar, 100, moreInfo.title_a)
        if (check.recordset[0].employeeMail === 0) {
          await request.execute('dbo.usersInfo_addData')
        } else {
          await request.execute('dbo.usersInfo_updateData')
        }
        const register = pool.request()
        input(register, 'employeeID', sql.VarChar, 20, moreInfo.employee_code)
        input(register, 'userToken', sql.VarChar, TOKEN_MAX_LENGTH, token)
        await register.execute('dbo.userTokens_addToken')
      })
    },
    getCredentials(employeeCode) {
      return portal(async (pool) => {
        const result = await input(
          pool.request(),
          'employeeCode',
          sql.VarChar,
          20,
          employeeCode
        ).query(
          'SELECT groupID, mailAddress FROM dbo.usersInfo WHERE employeeID = @employeeCode'
        )
        if (result.recordset.length !== 1) throw new AuthError('authFailed')
        return result.recordset[0]
      })
    },
    isRegistered(identity) {
      return portal(async (pool) => {
        const request = pool.request()
        input(
          request,
          'userToken',
          sql.VarChar,
          TOKEN_MAX_LENGTH,
          identity.token
        )
        input(request, 'employeeID', sql.VarChar, 20, identity.employeeCode)
        const result =
          await request.query(`SELECT TOP (1) 1 AS registered FROM dbo.userTokens
          WHERE userToken = @userToken AND employeeID = @employeeID`)
        return result.recordset.length === 1
      })
    },
    revokeToken(token) {
      return portal(async (pool) => {
        await input(
          pool.request(),
          'token',
          sql.VarChar,
          TOKEN_MAX_LENGTH,
          token
        ).execute('dbo.usersInfo_deleteToken')
        const remaining = await input(
          pool.request(),
          'token',
          sql.VarChar,
          TOKEN_MAX_LENGTH,
          token
        ).query(
          'SELECT TOP (1) 1 AS registered FROM dbo.userTokens WHERE userToken = @token'
        )
        if (remaining.recordset.length)
          throw new AuthError('serviceUnavailable', 503)
        // Zero affected rows is already logged out and is intentionally success.
      })
    },
  }
}

module.exports = { createRepository }
