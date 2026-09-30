// Fixed, server-owned DTR setup operations. Route and request values only
// select an entry from the maps below or are bound as typed parameters; they
// never reach SQL text.
const { AdministrationError } = require('./memberships')

// dtr.adminAssignment stores every organization code as varchar(10) and the
// employee code as varchar(10); HR branch_code is varchar(10).
const CODE_PATTERN = /^[A-Za-z0-9_-]{1,10}$/
const CODE_LENGTH = 10
// Existing rows store this text for the levels below an assignment. It stays
// inside this adapter: API callers omit the field instead.
const UNASSIGNED = 'undefined'

// Observed dtr.adminAssignment / dtr.adminAssignment_addData sizes.
const ASSIGNMENT_LIMITS = {
  employeeCode: 10,
  adminName: 100,
  adminEmail: 100,
  adminCompany: 100,
  picPath: 300,
}

// UI label -> request field, in hierarchy order. HR stores them under
// different names: see EMPLOYEE_QUERIES.
const PATH_FIELDS = [
  'branch',
  'division',
  'department',
  'project',
  'subProject',
]

// Assignment/employee levels and the path fields each one requires.
const LEVELS = new Map([
  ['division', PATH_FIELDS.slice(0, 2)],
  ['department', PATH_FIELDS.slice(0, 3)],
  ['project', PATH_FIELDS.slice(0, 4)],
  ['sub-project', PATH_FIELDS.slice(0, 5)],
])

const ROLE_FIELDS = [
  'isDTRAdmin',
  'isApprover',
  'isManpowerAdmin',
  'isMigrator',
  'isReportAdmin',
]

// pay_code_tables code types: 41 division, 42 department, 71 project,
// 72 sub-project. Parent codes live in major_code (division), section_code
// (department) and division_code (project).
const CHILD_COLUMNS = 'system_code, system_desp_a, system_desp_e'

const ORGANIZATION = new Map([
  [
    'companies',
    Object.freeze({
      fields: [],
      columns: [
        'company_code',
        'company_desc_a',
        'company_desc_e',
        'comp_logo',
      ],
      query: `SELECT company_code, company_desc_a, company_desc_e, comp_logo
  FROM dbo.adm_company`,
    }),
  ],
  [
    'branches',
    Object.freeze({
      fields: [],
      columns: ['branch_code', 'branch_name_a', 'branch_name_e', 'logo'],
      query: `SELECT branch_code, branch_name_a, branch_name_e, logo
  FROM dbo.adm_branch`,
    }),
  ],
  [
    'divisions',
    Object.freeze({
      fields: PATH_FIELDS.slice(0, 1),
      columns: ['system_code', 'system_desp_a', 'system_desp_e'],
      query: `SELECT ${CHILD_COLUMNS} FROM dbo.pay_code_tables
  WHERE branch_code = @branch AND system_code_type = '41'`,
    }),
  ],
  [
    'departments',
    Object.freeze({
      fields: PATH_FIELDS.slice(0, 2),
      columns: ['system_code', 'system_desp_a', 'system_desp_e'],
      query: `SELECT ${CHILD_COLUMNS} FROM dbo.pay_code_tables
  WHERE branch_code = @branch AND system_code_type = '42'
    AND major_code = @division`,
    }),
  ],
  [
    'projects',
    Object.freeze({
      fields: PATH_FIELDS.slice(0, 3),
      columns: ['system_code', 'system_desp_a', 'system_desp_e'],
      query: `SELECT ${CHILD_COLUMNS} FROM dbo.pay_code_tables
  WHERE branch_code = @branch AND system_code_type = '71'
    AND major_code = @division AND section_code = @department`,
    }),
  ],
  [
    'sub-projects',
    Object.freeze({
      fields: PATH_FIELDS.slice(0, 4),
      columns: [
        'system_code',
        'system_desp_a',
        'system_desp_e',
        'division_code',
      ],
      query: `SELECT ${CHILD_COLUMNS}, division_code FROM dbo.pay_code_tables
  WHERE branch_code = @branch AND system_code_type = '72'
    AND major_code = @division AND section_code = @department
    AND division_code = @project`,
    }),
  ],
])

const EMPLOYEE_COLUMNS = [
  'employee_code',
  'employee_name_eng',
  'employee_name_a',
  'employee_picture',
  'Email',
]

// Active employees only (pay_emp_finance.stop_val_flag = 0), always scoped to
// the branch and division so equal codes in other branches are never mixed.
const ACTIVE_EMPLOYEES = `SELECT A.employee_code, A.employee_name_eng,
    A.employee_name_a, A.employee_picture, A.Email
  FROM dbo.Pay_employees AS A
  INNER JOIN dbo.pay_emp_finance AS B ON A.employee_code = B.employee_code
  WHERE B.stop_val_flag = 0 AND A.branch_code = @branch
    AND A.department = @division`

// HR employee columns do not match the UI labels: Pay_employees.department is
// the UI division, .section the UI department, .Division the UI project and
// .Unit the UI sub-project. The department and project levels keep the
// existing rule of listing employees through the child codes defined under
// that path.
const EMPLOYEE_QUERIES = new Map([
  ['division', ACTIVE_EMPLOYEES],
  [
    'department',
    `${ACTIVE_EMPLOYEES}
    AND EXISTS (SELECT 1 FROM dbo.pay_code_tables AS P
      WHERE P.branch_code = @branch AND P.system_code_type = '71'
        AND P.major_code = @division AND P.section_code = @department
        AND P.system_code = A.Division)`,
  ],
  [
    'project',
    `${ACTIVE_EMPLOYEES}
    AND A.section = @department AND A.Division = @project
    AND EXISTS (SELECT 1 FROM dbo.pay_code_tables AS U
      WHERE U.branch_code = @branch AND U.system_code_type = '72'
        AND U.major_code = @division AND U.section_code = @department
        AND U.division_code = @project AND U.system_code = A.Unit)`,
  ],
  [
    'sub-project',
    `${ACTIVE_EMPLOYEES}
    AND A.section = @department AND A.Division = @project
    AND A.Unit = @subProject`,
  ],
])

// Resolves a requested path to the codes HR stores, requiring every ancestor
// to exist under the same branch.
const PATH_FROM = `FROM dbo.pay_code_tables AS D`
const PATH_DEPARTMENT = `INNER JOIN dbo.pay_code_tables AS S
    ON S.branch_code = D.branch_code AND S.system_code_type = '42'
    AND S.major_code = D.system_code AND S.system_code = @department`
const PATH_PROJECT = `INNER JOIN dbo.pay_code_tables AS P
    ON P.branch_code = D.branch_code AND P.system_code_type = '71'
    AND P.major_code = D.system_code AND P.section_code = S.system_code
    AND P.system_code = @project`
const PATH_SUB_PROJECT = `INNER JOIN dbo.pay_code_tables AS U
    ON U.branch_code = D.branch_code AND U.system_code_type = '72'
    AND U.major_code = D.system_code AND U.section_code = S.system_code
    AND U.division_code = P.system_code AND U.system_code = @subProject`
const PATH_WHERE = `WHERE D.system_code_type = '41' AND D.branch_code = @branch
    AND D.system_code = @division
    AND EXISTS (SELECT 1 FROM dbo.adm_branch AS R
      WHERE R.branch_code = D.branch_code)`

const PATH_QUERIES = new Map([
  [
    'division',
    `SELECT DISTINCT TOP (2) D.branch_code AS branch, D.system_code AS division
  ${PATH_FROM}
  ${PATH_WHERE}`,
  ],
  [
    'department',
    `SELECT DISTINCT TOP (2) D.branch_code AS branch, D.system_code AS division,
    S.system_code AS department
  ${PATH_FROM}
  ${PATH_DEPARTMENT}
  ${PATH_WHERE}`,
  ],
  [
    'project',
    `SELECT DISTINCT TOP (2) D.branch_code AS branch, D.system_code AS division,
    S.system_code AS department, P.system_code AS project
  ${PATH_FROM}
  ${PATH_DEPARTMENT}
  ${PATH_PROJECT}
  ${PATH_WHERE}`,
  ],
  [
    'sub-project',
    `SELECT DISTINCT TOP (2) D.branch_code AS branch, D.system_code AS division,
    S.system_code AS department, P.system_code AS project,
    U.system_code AS subProject
  ${PATH_FROM}
  ${PATH_DEPARTMENT}
  ${PATH_PROJECT}
  ${PATH_SUB_PROJECT}
  ${PATH_WHERE}`,
  ],
])

const ASSIGNMENT_COLUMNS = [
  'id',
  'employeeCode',
  'adminName',
  'picPath',
  'isHrPic',
  'isPortalPic',
  'isDTRAdmin',
  'isApprover',
  'isManpowerAdmin',
  'isMigrator',
  'isReportAdmin',
]

const ASSIGNMENT_PATH_MATCH = `branchName = @branchName
    AND divisionCode = @divisionCode AND departmentCode = @departmentCode
    AND projectCode = @projectCode AND subProjectCode = @subProjectCode`

const ASSIGNMENT_LIST_QUERY = `SELECT id, employeeCode, adminName, picPath,
    isHrPic, isPortalPic, isDTRAdmin, isApprover, isManpowerAdmin, isMigrator,
    isReportAdmin
  FROM dtr.adminAssignment
  WHERE ${ASSIGNMENT_PATH_MATCH}`

// dtr.adminAssignment has no unique key on the employee/path columns, so the
// duplicate check holds a range lock until the insert commits.
const ASSIGNMENT_ADD_STATEMENT = `SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRY
  BEGIN TRANSACTION;
  IF EXISTS (SELECT 1 FROM dtr.adminAssignment WITH (UPDLOCK, HOLDLOCK)
    WHERE employeeCode = @employeeCode AND ${ASSIGNMENT_PATH_MATCH})
  BEGIN
    COMMIT TRANSACTION;
    SELECT CAST(1 AS bit) AS assignmentExists;
    RETURN;
  END;
  EXEC dtr.adminAssignment_addData @employeeCode = @employeeCode,
    @adminName = @adminName, @adminEmail = @adminEmail,
    @adminCompany = @adminCompany, @picPath = @picPath, @isHrPic = @isHrPic,
    @isPortalPic = @isPortalPic, @isDTRAdmin = @isDTRAdmin,
    @isApprover = @isApprover, @isManpowerAdmin = @isManpowerAdmin,
    @isMigrator = @isMigrator, @isReportAdmin = @isReportAdmin,
    @branchName = @branchName, @divisionCode = @divisionCode,
    @departmentCode = @departmentCode, @projectCode = @projectCode,
    @subProjectCode = @subProjectCode;
  IF NOT EXISTS (SELECT 1 FROM dtr.adminAssignment
    WHERE employeeCode = @employeeCode AND ${ASSIGNMENT_PATH_MATCH})
    THROW 50001, 'assignmentNotAdded', 1;
  COMMIT TRANSACTION;
  SELECT CAST(0 AS bit) AS assignmentExists;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH`

function getLevel(level) {
  const fields = typeof level === 'string' && LEVELS.get(level)
  if (!fields) throw new AdministrationError('invalidLevel', 400)
  return fields
}

function isCode(value) {
  return (
    typeof value === 'string' &&
    CODE_PATTERN.test(value) &&
    value.toLowerCase() !== UNASSIGNED
  )
}

// Exactly the fields of the level: a missing, malformed or extra path value
// is rejected instead of being reinterpreted as another level.
function validatePath(fields, source) {
  const values = source && typeof source === 'object' ? source : {}
  const path = {}
  for (const field of PATH_FIELDS) {
    const value = values[field]
    if (fields.includes(field)) {
      if (!isCode(value)) throw new AdministrationError('invalidPath', 400)
      path[field] = value
    } else if (value !== undefined) {
      throw new AdministrationError('invalidPath', 400)
    }
  }
  return path
}

// Keeps the popup's rules: at least one role, and DTR admin and site manager
// (approver) are mutually exclusive.
function validateRoles(source) {
  const values = source && typeof source === 'object' ? source : {}
  const roles = {}
  for (const field of ROLE_FIELDS) {
    const value = values[field]
    if (value !== undefined && typeof value !== 'boolean')
      throw new AdministrationError('invalidRoles', 400)
    roles[field] = value === true
  }
  if (
    !ROLE_FIELDS.some((field) => roles[field]) ||
    (roles.isDTRAdmin && roles.isApprover)
  )
    throw new AdministrationError('invalidRoles', 400)
  return roles
}

function storedPath(path) {
  return {
    branchName: path.branch,
    divisionCode: path.division,
    departmentCode:
      path.department === undefined ? UNASSIGNED : path.department,
    projectCode: path.project === undefined ? UNASSIGNED : path.project,
    subProjectCode:
      path.subProject === undefined ? UNASSIGNED : path.subProject,
  }
}

function project(columns, row) {
  const result = {}
  for (const column of columns) result[column] = row[column]
  return result
}

function lastRecordset(result) {
  const recordsets = (result && result.recordsets) || []
  return recordsets.length
    ? recordsets[recordsets.length - 1]
    : (result && result.recordset) || []
}

function isFilled(value) {
  return typeof value === 'string' && value.trim() !== ''
}

// `getEmployeeInfo` is the trusted HR/portal lookup of the memberships service.
function createDtrSetup({ sql, portalConfig, hrConfig, getEmployeeInfo }) {
  async function withPool(config, operation) {
    const pool = new sql.ConnectionPool(config)
    try {
      await pool.connect()
      return await operation(pool)
    } finally {
      await pool.close().catch(() => {})
    }
  }

  function bindCodes(request, path) {
    for (const [field, value] of Object.entries(path))
      request.input(field, sql.VarChar(CODE_LENGTH), value)
    return request
  }

  function bindStoredPath(request, path) {
    const stored = storedPath(path)
    return request
      .input('branchName', sql.VarChar(100), stored.branchName)
      .input('divisionCode', sql.VarChar(CODE_LENGTH), stored.divisionCode)
      .input('departmentCode', sql.VarChar(CODE_LENGTH), stored.departmentCode)
      .input('projectCode', sql.VarChar(CODE_LENGTH), stored.projectCode)
      .input('subProjectCode', sql.VarChar(CODE_LENGTH), stored.subProjectCode)
  }

  // The path as HR stores it, or pathNotFound when any part does not exist.
  async function resolvePath(level, fields, path) {
    const rows = await withPool(hrConfig, async (pool) => {
      const { recordset } = await bindCodes(pool.request(), path).query(
        PATH_QUERIES.get(level)
      )
      return recordset
    })
    if (!rows.length) throw new AdministrationError('pathNotFound', 404)
    if (rows.length > 1)
      throw new AdministrationError('serviceUnavailable', 503)
    const resolved = {}
    for (const field of fields) {
      if (!isCode(rows[0][field]))
        throw new AdministrationError('pathNotFound', 404)
      resolved[field] = rows[0][field]
    }
    return resolved
  }

  function assignmentValues(info) {
    const values = {
      employeeCode: info.memberInfo.employee_code,
      adminName: info.memberInfo.employee_name_eng,
      // adminEmail is NOT NULL; HR employees without an email stay assignable.
      adminEmail: isFilled(info.memberInfo.Email) ? info.memberInfo.Email : '',
      adminCompany: info.memberInfo.branch_code,
      picPath: info.memberPicturePath,
    }
    if (!isFilled(values.employeeCode) || !isFilled(values.adminName))
      throw new AdministrationError('employeeInfoMessing', 404)
    for (const [name, limit] of Object.entries(ASSIGNMENT_LIMITS)) {
      const value = values[name]
      if (value != null && String(value).length > limit)
        throw new AdministrationError('employeeInfoInvalid', 422)
    }
    return values
  }

  return {
    async listOrganization(kind, query) {
      const entry = typeof kind === 'string' && ORGANIZATION.get(kind)
      if (!entry) throw new AdministrationError('invalidLevel', 400)
      const path = validatePath(entry.fields, query)
      return await withPool(hrConfig, async (pool) => {
        const { recordset } = await bindCodes(pool.request(), path).query(
          entry.query
        )
        return recordset.map((row) => project(entry.columns, row))
      })
    },

    async listEmployees(level, query) {
      const path = validatePath(getLevel(level), query)
      return await withPool(hrConfig, async (pool) => {
        const { recordset } = await bindCodes(pool.request(), path).query(
          EMPLOYEE_QUERIES.get(level)
        )
        return recordset.map((row) => project(EMPLOYEE_COLUMNS, row))
      })
    },

    async listAssignments(level, query) {
      const path = validatePath(getLevel(level), query)
      return await withPool(portalConfig, async (pool) => {
        const { recordset } = await bindStoredPath(pool.request(), path).query(
          ASSIGNMENT_LIST_QUERY
        )
        return recordset.map((row) => project(ASSIGNMENT_COLUMNS, row))
      })
    },

    async createAssignment(level, body) {
      const fields = getLevel(level)
      const requested = validatePath(fields, body)
      const roles = validateRoles(body)
      const employeeCode = body && typeof body === 'object' && body.employeeCode
      if (typeof employeeCode !== 'string')
        throw new AdministrationError('invalidEmployeeCode', 400)

      // Trusted lookups first: browser-supplied names, emails, pictures or
      // companies are never stored.
      const info = await getEmployeeInfo(employeeCode)
      const values = assignmentValues(info)
      const path = await resolvePath(level, fields, requested)

      return await withPool(portalConfig, async (pool) => {
        const request = bindStoredPath(pool.request(), path)
          .input('employeeCode', sql.VarChar(10), values.employeeCode)
          .input('adminName', sql.VarChar(100), values.adminName)
          .input('adminEmail', sql.VarChar(100), values.adminEmail)
          .input('adminCompany', sql.VarChar(100), values.adminCompany)
          .input('picPath', sql.NVarChar(300), values.picPath)
          .input('isHrPic', sql.Int, info.hrPicture ? 1 : 0)
          .input('isPortalPic', sql.Int, info.portalPicture ? 1 : 0)
        for (const field of ROLE_FIELDS)
          request.input(field, sql.Int, roles[field] ? 1 : 0)
        const rows = lastRecordset(
          await request.query(ASSIGNMENT_ADD_STATEMENT)
        )
        if (rows.length !== 1)
          throw new AdministrationError('serviceUnavailable', 503)
        if (rows[0].assignmentExists === true || rows[0].assignmentExists === 1)
          throw new AdministrationError('assignmentExists', 409)
        return { message: 'assignmentAdded' }
      })
    },
  }
}

module.exports = {
  createDtrSetup,
  validatePath,
  validateRoles,
  storedPath,
  LEVELS,
  ORGANIZATION,
  EMPLOYEE_QUERIES,
  PATH_QUERIES,
  ASSIGNMENT_LIST_QUERY,
  ASSIGNMENT_ADD_STATEMENT,
  ROLE_FIELDS,
  UNASSIGNED,
}
