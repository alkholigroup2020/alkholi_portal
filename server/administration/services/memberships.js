// Fixed, server-owned membership operations for the six administration lists.
// Route values only select an entry from MEMBERSHIPS; they never reach SQL text.
const EMPLOYEE_CODE_PATTERN = /^[A-Za-z0-9_-]{1,20}$/
const HR_EMPLOYEE_CODE_MAX_LENGTH = 15
const HR_BRANCH_MAX_LENGTH = 10
const HR_POSITION_MAX_LENGTH = 15

// Observed dbo.<membership table> / dbo.<prefix>_addData sizes.
const MEMBER_FIELD_LIMITS = {
  fullName: 50,
  title: 150,
  profilePicPath: 300,
  mailAddress: 50,
  branch: 50,
}

function existsStatement(table) {
  return `SELECT CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.${table}
    WHERE employeeID = @employeeCode) THEN 1 ELSE 0 END AS bit) AS memberExists`
}

function listStatement(table) {
  return `SELECT _id, employeeID, fullName, title, mailAddress, profilePicPath,
    hrPicture, portalPicture
  FROM dbo.${table}`
}

function addStatement(table, procedurePrefix) {
  return `SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRY
  BEGIN TRANSACTION;
  IF EXISTS (SELECT 1 FROM dbo.${table} WITH (UPDLOCK, HOLDLOCK)
    WHERE employeeID = @employeeID)
  BEGIN
    COMMIT TRANSACTION;
    SELECT CAST(1 AS bit) AS memberExists;
    RETURN;
  END;
  EXEC dbo.${procedurePrefix}_addData @employeeID = @employeeID,
    @fullName = @fullName, @title = @title, @profilePicPath = @profilePicPath,
    @mailAddress = @mailAddress, @branch = @branch, @hrPicture = @hrPicture,
    @portalPicture = @portalPicture;
  IF NOT EXISTS (SELECT 1 FROM dbo.${table} WHERE employeeID = @employeeID)
    THROW 50001, 'membershipNotAdded', 1;
  COMMIT TRANSACTION;
  SELECT CAST(0 AS bit) AS memberExists;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH`
}

function deleteStatement(table, procedurePrefix) {
  return `SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @memberCount int = (SELECT COUNT(*) FROM dbo.${table}
    WITH (UPDLOCK, HOLDLOCK) WHERE employeeID = @employeeID);
  IF @memberCount = 0
  BEGIN
    COMMIT TRANSACTION;
    SELECT 0 AS memberCount, 0 AS remainingCount;
    RETURN;
  END;
  EXEC dbo.${procedurePrefix}_deleteMember @memberID = @employeeID;
  DECLARE @remainingCount int = (SELECT COUNT(*) FROM dbo.${table}
    WHERE employeeID = @employeeID);
  COMMIT TRANSACTION;
  SELECT @memberCount AS memberCount, @remainingCount AS remainingCount;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH`
}

function membership(table, procedurePrefix) {
  return Object.freeze({
    table,
    exists: existsStatement(table),
    list: listStatement(table),
    add: addStatement(table, procedurePrefix),
    remove: deleteStatement(table, procedurePrefix),
  })
}

// Exactly the six accepted resource names. A Map avoids prototype-key lookups.
const MEMBERSHIPS = new Map([
  ['portal', membership('admin_members', 'admin_members')],
  [
    'business-cards',
    membership('business_card_admins', 'business_card_admins'),
  ],
  ['coc', membership('coc_admins', 'coc_admins')],
  ['elevators', membership('elevators_users', 'elevators_users')],
  ['hr-surveys', membership('hr_surveys_users', 'hr_surveys_users')],
  ['dtr', membership('dtr_users', 'dtr_users')],
])

const HR_EMPLOYEE_QUERY = `SELECT TOP (2) employee_code, branch_code,
    employee_name_eng, Email, position, employee_picture
  FROM dbo.Pay_employees WHERE employee_code = @employeeCode`

const HR_TITLE_QUERY = `SELECT TOP (1) system_desp_a, system_desp_e
  FROM dbo.pay_code_tables WHERE system_code = @position
  AND branch_code = @branch AND system_code_type = '21'`

const PORTAL_PICTURE_QUERY = `SELECT TOP (1) portalProfilePicPath
  FROM dbo.usersInfo WHERE employeeID = @employeeCode`

class AdministrationError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.statusCode = statusCode
  }
}

function getMembership(moduleName) {
  const found = typeof moduleName === 'string' && MEMBERSHIPS.get(moduleName)
  if (!found) throw new AdministrationError('invalidModule', 400)
  return found
}

function validateEmployeeCode(value) {
  if (typeof value !== 'string' || !EMPLOYEE_CODE_PATTERN.test(value))
    throw new AdministrationError('invalidEmployeeCode', 400)
  return value
}

function isFilled(value) {
  return typeof value === 'string' && value.trim() !== ''
}

function lastRecordset(result) {
  const recordsets = (result && result.recordsets) || []
  return recordsets.length
    ? recordsets[recordsets.length - 1]
    : (result && result.recordset) || []
}

function isDuplicateKeyError(error) {
  const number =
    error &&
    (error.number || (error.originalError && error.originalError.number))
  return number === 2627 || number === 2601
}

function createMemberships({ sql, portalConfig, hrConfig }) {
  async function withPool(config, operation) {
    const pool = new sql.ConnectionPool(config)
    try {
      await pool.connect()
      return await operation(pool)
    } finally {
      await pool.close().catch(() => {})
    }
  }

  async function lookupEmployee(portal, employeeCode) {
    // The HR key is varchar(15): longer valid-looking codes cannot exist there,
    // and binding them to the shorter type could truncate the lookup value.
    if (employeeCode.length > HR_EMPLOYEE_CODE_MAX_LENGTH)
      throw new AdministrationError('employeeInfoMessing', 404)

    const hr = await withPool(hrConfig, async (pool) => {
      const employees = await pool
        .request()
        .input(
          'employeeCode',
          sql.VarChar(HR_EMPLOYEE_CODE_MAX_LENGTH),
          employeeCode
        )
        .query(HR_EMPLOYEE_QUERY)
      if (employees.recordset.length > 1)
        throw new AdministrationError('serviceUnavailable', 503)
      if (!employees.recordset.length)
        throw new AdministrationError('employeeInfoMessing', 404)
      const employee = employees.recordset[0]

      // Preserve the existing lookup: HR position codes are compared as numbers.
      const position = String(Number(employee.position))
      if (
        !Number.isFinite(Number(employee.position)) ||
        position.length > HR_POSITION_MAX_LENGTH ||
        typeof employee.branch_code !== 'string' ||
        employee.branch_code.length > HR_BRANCH_MAX_LENGTH
      )
        throw new AdministrationError('employeeInfoMessing', 404)
      const titles = await pool
        .request()
        .input('position', sql.VarChar(HR_POSITION_MAX_LENGTH), position)
        .input(
          'branch',
          sql.VarChar(HR_BRANCH_MAX_LENGTH),
          employee.branch_code
        )
        .query(HR_TITLE_QUERY)
      if (!titles.recordset.length)
        throw new AdministrationError('employeeInfoMessing', 404)
      return { employee, title: titles.recordset[0] }
    })

    const portalPictures = await portal
      .request()
      .input('employeeCode', sql.VarChar(20), employeeCode)
      .query(PORTAL_PICTURE_QUERY)
    const portalPicturePath =
      portalPictures.recordset.length &&
      portalPictures.recordset[0].portalProfilePicPath

    let memberPicturePath, hrPicture, portalPicture
    if (isFilled(portalPicturePath)) {
      memberPicturePath = portalPicturePath
      hrPicture = false
      portalPicture = true
    } else if (isFilled(hr.employee.employee_picture)) {
      memberPicturePath = hr.employee.employee_picture
      hrPicture = true
      portalPicture = false
    } else {
      memberPicturePath = 'profile.png'
      hrPicture = false
      portalPicture = true
    }

    return {
      memberInfo: {
        employee_code: hr.employee.employee_code,
        branch_code: hr.employee.branch_code,
        employee_name_eng: hr.employee.employee_name_eng,
        Email: hr.employee.Email,
        position: hr.employee.position,
      },
      titleInfo: {
        system_desp_a: hr.title.system_desp_a,
        system_desp_e: hr.title.system_desp_e,
      },
      memberPicturePath,
      hrPicture,
      portalPicture,
    }
  }

  async function memberExists(portal, entry, employeeCode) {
    const { recordset } = await portal
      .request()
      .input('employeeCode', sql.VarChar(20), employeeCode)
      .query(entry.exists)
    return Boolean(recordset.length && recordset[0].memberExists)
  }

  function memberValues(info) {
    const values = {
      employeeID: info.memberInfo.employee_code,
      fullName: info.memberInfo.employee_name_eng,
      title: info.titleInfo.system_desp_e,
      profilePicPath: info.memberPicturePath,
      mailAddress: info.memberInfo.Email,
      branch: info.memberInfo.branch_code,
    }
    // Required NOT NULL columns; the old handlers stored the text 'null'.
    if (!isFilled(values.fullName) || !isFilled(values.mailAddress))
      throw new AdministrationError('employeeInfoMessing', 404)
    for (const [name, limit] of Object.entries(MEMBER_FIELD_LIMITS)) {
      const value = values[name]
      if (value != null && String(value).length > limit)
        throw new AdministrationError('employeeInfoInvalid', 422)
    }
    if (values.title != null) values.title = String(values.title)
    return values
  }

  return {
    async listMembers(moduleName) {
      const entry = getMembership(moduleName)
      return await withPool(portalConfig, async (pool) => {
        const { recordset } = await pool.request().query(entry.list)
        return recordset.map((row) => ({
          _id: row._id,
          employeeID: row.employeeID,
          fullName: row.fullName,
          title: row.title,
          mailAddress: row.mailAddress,
          profilePicPath: row.profilePicPath,
          hrPicture: row.hrPicture,
          portalPicture: row.portalPicture,
        }))
      })
    },

    async getEmployeeInfo(employeeCode) {
      const code = validateEmployeeCode(employeeCode)
      return await withPool(portalConfig, (pool) => lookupEmployee(pool, code))
    },

    async addMember(moduleName, employeeCode) {
      const entry = getMembership(moduleName)
      const code = validateEmployeeCode(employeeCode)
      return await withPool(portalConfig, async (pool) => {
        // Keep the existing precedence: duplicates are reported before HR checks.
        if (await memberExists(pool, entry, code))
          throw new AdministrationError('memberExist', 409)
        const info = await lookupEmployee(pool, code)
        const values = memberValues(info)
        let result
        try {
          result = await pool
            .request()
            .input('employeeID', sql.VarChar(20), values.employeeID)
            .input('fullName', sql.VarChar(50), values.fullName)
            .input('title', sql.VarChar(150), values.title)
            .input('profilePicPath', sql.NVarChar(300), values.profilePicPath)
            .input('mailAddress', sql.VarChar(50), values.mailAddress)
            .input('branch', sql.VarChar(50), values.branch)
            .input('hrPicture', sql.Bit, info.hrPicture)
            .input('portalPicture', sql.Bit, info.portalPicture)
            .query(entry.add)
        } catch (error) {
          if (isDuplicateKeyError(error))
            throw new AdministrationError('memberExist', 409)
          throw error
        }
        const rows = lastRecordset(result)
        if (rows.length !== 1)
          throw new AdministrationError('serviceUnavailable', 503)
        if (rows[0].memberExists === true || rows[0].memberExists === 1)
          throw new AdministrationError('memberExist', 409)
        return info
      })
    },

    async deleteMember(moduleName, employeeCode) {
      const entry = getMembership(moduleName)
      const code = validateEmployeeCode(employeeCode)
      return await withPool(portalConfig, async (pool) => {
        const result = await pool
          .request()
          .input('employeeID', sql.VarChar(20), code)
          .query(entry.remove)
        const rows = lastRecordset(result)
        if (rows.length !== 1)
          throw new AdministrationError('serviceUnavailable', 503)
        const { memberCount, remainingCount } = rows[0]
        if (!memberCount) throw new AdministrationError('notFound', 404)
        // Do not claim success unless the procedure actually removed rows.
        if (!(remainingCount < memberCount))
          throw new AdministrationError('serviceUnavailable', 503)
        return { message: 'successfullyDeleted' }
      })
    },
  }
}

module.exports = {
  createMemberships,
  getMembership,
  validateEmployeeCode,
  AdministrationError,
  MEMBERSHIPS,
  HR_EMPLOYEE_QUERY,
  HR_TITLE_QUERY,
  PORTAL_PICTURE_QUERY,
}
