const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const express = require('express')
const babel = require('@babel/core')
const createApi = require('../../server/administration/createApi')
const {
  createMemberships,
  MEMBERSHIPS,
  HR_EMPLOYEE_QUERY,
  HR_TITLE_QUERY,
  PORTAL_PICTURE_QUERY,
} = require('../../server/administration/services/memberships')
const {
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
} = require('../../server/administration/services/dtrSetup')
const {
  createRoleChecks,
  requireRole,
  ROLE_QUERIES,
} = require('../../server/shared/roles')
const { createAuth } = require('../../server/login/services/auth')
const { createSessions } = require('../../server/login/services/session')

const root = path.resolve(__dirname, '../..')
const ADMIN = 'ADM001'
const USER = 'USR001'
const TARGET = '00123'

const FULL_PATH = {
  branch: 'BR1',
  division: '1',
  department: '10',
  project: '100',
  subProject: '01',
}

function levelPath(level, overrides = {}) {
  const result = {}
  for (const field of LEVELS.get(level)) result[field] = FULL_PATH[field]
  return { ...result, ...overrides }
}

function queryString(values) {
  return new URLSearchParams(values).toString()
}

function codeRow(branch, type, code, major, section, division) {
  return {
    branch_code: branch,
    system_code_type: type,
    system_code: code,
    major_code: major,
    section_code: section,
    division_code: division,
    system_desp_a: `ع ${type}-${code}`,
    system_desp_e: `${branch} ${type}-${code}`,
    company_code: 'private',
  }
}

function employee(code, branch, department, section, division, unit, active) {
  return {
    employee_code: code,
    branch_code: branch,
    department,
    section,
    Division: division,
    Unit: unit,
    employee_name_eng: `Employee ${code}`,
    employee_name_a: `موظف ${code}`,
    employee_picture: `${code}.jpg`,
    Email: `${code.toLowerCase()}@example.invalid`,
    position: '0042',
    salary: 'private',
    active,
  }
}

// Mocked mssql. Each fixed statement is interpreted over in-memory HR and
// portal data; every call is recorded with its typed inputs and pool config.
function databaseFixture() {
  const portalConfig = { name: 'portal' }
  const hrConfig = { name: 'hr' }
  const calls = []
  const pools = []
  const state = {
    failAt: null,
    admins: [ADMIN],
    assignments: [],
    nextId: 1,
    portalPictures: {},
    companies: [
      {
        company_code: 'ALK',
        company_desc_a: 'الخولي',
        company_desc_e: 'Alkholi',
        comp_logo: 'alk.png',
        Address_Id: 'private',
      },
    ],
    branches: ['BR1', 'BR2', 'BR3'].map((code) => ({
      branch_code: code,
      branch_name_a: `فرع ${code}`,
      branch_name_e: `Branch ${code}`,
      logo: `${code}.png`,
      logo_a: 'private',
      design_logo_e: 'private',
    })),
    codes: [
      // BR1 and BR2 deliberately share every code.
      ...['BR1', 'BR2'].flatMap((branch) => [
        codeRow(branch, '41', '1', '0', null, null),
        codeRow(branch, '42', '10', '1', null, null),
        codeRow(branch, '71', '100', '1', '10', ''),
        codeRow(branch, '72', '01', '1', '10', '100'),
      ]),
      // BR1 only: a division without departments and a second department.
      codeRow('BR1', '41', '2', '0', null, null),
      codeRow('BR1', '42', '11', '1', null, null),
      codeRow('BR1', '71', '101', '1', '11', ''),
    ],
    employees: [
      employee('E1', 'BR1', '1', '10', '100', '01', true),
      employee('E2', 'BR1', '1', '10', '100', '', true),
      employee('E3', 'BR1', '1', '10', '100', '01', false),
      employee('E4', 'BR2', '1', '10', '100', '01', true),
      employee('E5', 'BR1', '1', '', '', '', true),
      employee('E6', 'BR1', '1', '11', '101', '', true),
      employee(TARGET, 'BR1', '2', '', '', '', true),
      employee('NOMAIL', 'BR1', '2', '', '', '', true),
      employee('LONGCODE123', 'BR1', '2', '', '', '', true),
    ],
    titles: { 'BR1:42': { system_desp_a: 'مهندس', system_desp_e: 'Engineer' } },
  }
  state.employees.find((row) => row.employee_code === 'NOMAIL').Email = null

  const active = () => state.employees.filter((row) => row.active)
  const codesOf = (type, v, match) =>
    state.codes.filter(
      (row) =>
        row.system_code_type === type &&
        row.branch_code === v.branch &&
        match(row)
    )
  const samePath = (row, v) =>
    row.branchName === v.branchName &&
    row.divisionCode === v.divisionCode &&
    row.departmentCode === v.departmentCode &&
    row.projectCode === v.projectCode &&
    row.subProjectCode === v.subProjectCode

  function resolvePath(level, v) {
    const fields = LEVELS.get(level)
    if (!state.branches.some((row) => row.branch_code === v.branch)) return []
    const checks = [
      () => codesOf('41', v, (row) => row.system_code === v.division),
      () =>
        codesOf(
          '42',
          v,
          (row) =>
            row.major_code === v.division && row.system_code === v.department
        ),
      () =>
        codesOf(
          '71',
          v,
          (row) =>
            row.major_code === v.division &&
            row.section_code === v.department &&
            row.system_code === v.project
        ),
      () =>
        codesOf(
          '72',
          v,
          (row) =>
            row.major_code === v.division &&
            row.section_code === v.department &&
            row.division_code === v.project &&
            row.system_code === v.subProject
        ),
    ].slice(0, fields.length - 1)
    if (checks.some((check) => !check().length)) return []
    return [Object.fromEntries(fields.map((field) => [field, v[field]]))]
  }

  const handlers = new Map([
    [ORGANIZATION.get('companies').query, () => state.companies],
    [ORGANIZATION.get('branches').query, () => state.branches],
    [ORGANIZATION.get('divisions').query, (v) => codesOf('41', v, () => true)],
    [
      ORGANIZATION.get('departments').query,
      (v) => codesOf('42', v, (row) => row.major_code === v.division),
    ],
    [
      ORGANIZATION.get('projects').query,
      (v) =>
        codesOf(
          '71',
          v,
          (row) =>
            row.major_code === v.division && row.section_code === v.department
        ),
    ],
    [
      ORGANIZATION.get('sub-projects').query,
      (v) =>
        codesOf(
          '72',
          v,
          (row) =>
            row.major_code === v.division &&
            row.section_code === v.department &&
            row.division_code === v.project
        ),
    ],
    [
      EMPLOYEE_QUERIES.get('division'),
      (v) =>
        active().filter(
          (row) => row.branch_code === v.branch && row.department === v.division
        ),
    ],
    [
      EMPLOYEE_QUERIES.get('department'),
      (v) =>
        active().filter(
          (row) =>
            row.branch_code === v.branch &&
            row.department === v.division &&
            handlers
              .get(ORGANIZATION.get('projects').query)(v)
              .some((code) => code.system_code === row.Division)
        ),
    ],
    [
      EMPLOYEE_QUERIES.get('project'),
      (v) =>
        active().filter(
          (row) =>
            row.branch_code === v.branch &&
            row.department === v.division &&
            row.section === v.department &&
            row.Division === v.project &&
            handlers
              .get(ORGANIZATION.get('sub-projects').query)(v)
              .some((code) => code.system_code === row.Unit)
        ),
    ],
    [
      EMPLOYEE_QUERIES.get('sub-project'),
      (v) =>
        active().filter(
          (row) =>
            row.branch_code === v.branch &&
            row.department === v.division &&
            row.section === v.department &&
            row.Division === v.project &&
            row.Unit === v.subProject
        ),
    ],
    ...[...PATH_QUERIES].map(([level, statement]) => [
      statement,
      (v) => resolvePath(level, v),
    ]),
    [
      HR_EMPLOYEE_QUERY,
      (v) =>
        state.employees.filter((row) => row.employee_code === v.employeeCode),
    ],
    [
      HR_TITLE_QUERY,
      (v) => {
        const row = state.titles[`${v.branch}:${v.position}`]
        return row ? [row] : []
      },
    ],
    [
      PORTAL_PICTURE_QUERY,
      (v) => {
        const found = state.portalPictures[v.employeeCode]
        return found === undefined ? [] : [{ portalProfilePicPath: found }]
      },
    ],
    [
      ROLE_QUERIES.get('portalAdmin'),
      (v) => [{ hasRole: state.admins.includes(v.employeeCode) }],
    ],
    [MEMBERSHIPS.get('portal').list, () => []],
    [
      ASSIGNMENT_LIST_QUERY,
      (v) => state.assignments.filter((row) => samePath(row, v)),
    ],
    [
      // The real batch holds UPDLOCK/HOLDLOCK; here check+insert is one step.
      ASSIGNMENT_ADD_STATEMENT,
      (v) => {
        const exists = state.assignments.some(
          (row) => row.employeeCode === v.employeeCode && samePath(row, v)
        )
        if (!exists) state.assignments.push({ id: state.nextId++, ...v })
        return [{ assignmentExists: exists }]
      },
    ],
  ])

  class ConnectionPool {
    constructor(config) {
      this.config = config
      this.closed = false
      pools.push(this)
    }

    // eslint-disable-next-line require-await
    async connect() {
      if (state.failAt === 'connect') throw new Error('private connection')
    }

    // eslint-disable-next-line require-await
    async close() {
      this.closed = true
    }

    request() {
      const pool = this
      const inputs = {}
      return {
        input(name, type, value) {
          inputs[name] = { type, value }
          return this
        },
        async query(statement) {
          calls.push({ statement, inputs, config: pool.config.name })
          // Yield so concurrent requests really interleave between statements.
          await new Promise((resolve) => setImmediate(resolve))
          if (state.failAt === statement)
            throw new Error('private SQL detail: dtr.secret_table')
          const handler = handlers.get(statement)
          if (!handler) throw new Error('statement is not server-owned')
          const values = Object.fromEntries(
            Object.entries(inputs).map(([name, input]) => [name, input.value])
          )
          const recordset = handler(values)
          return { recordset, recordsets: [recordset] }
        },
      }
    }
  }

  const sql = {
    ConnectionPool,
    VarChar: (length) => ({ name: 'varchar', length }),
    NVarChar: (length) => ({ name: 'nvarchar', length }),
    Bit: { name: 'bit' },
    Int: { name: 'int' },
  }
  const memberships = createMemberships({ sql, portalConfig, hrConfig })
  return {
    calls,
    pools,
    state,
    sql,
    memberships,
    roles: createRoleChecks({ sql, portalConfig }),
    dtrSetup: createDtrSetup({
      sql,
      portalConfig,
      hrConfig,
      getEmployeeInfo: memberships.getEmployeeInfo,
    }),
  }
}

async function httpFixture(t) {
  const f = databaseFixture()
  const sessions = createSessions('dtr-setup-tests-only-key')
  const tokens = {
    admin: sessions.issue({
      employeeCode: ADMIN,
      userAccount: 'admin',
      domain: 'alkholi',
    }),
    user: sessions.issue({
      employeeCode: USER,
      userAccount: 'user',
      domain: 'alkholi',
    }),
  }
  const revoked = new Set()
  const auth = createAuth({
    sessions,
    repository: {
      isRegistered: async (identity) => !revoked.has(identity.token),
    },
    adAuth: async () => {},
    cipher: {},
  })
  const app = express()
  app.use(
    '/administration-api',
    createApi({
      authorize: auth.authorize,
      requirePortalAdmin: requireRole(f.roles, 'portalAdmin'),
      memberships: f.memberships,
      dtrSetup: f.dtrSetup,
    })
  )
  const server = await new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server))
  })
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections()
        server.close(resolve)
      })
  )
  const base = `http://127.0.0.1:${server.address().port}/administration-api`
  async function request(suffix, { as = 'admin', method, body, headers } = {}) {
    const allHeaders = { ...(headers || {}) }
    if (as) allHeaders.Authorization = `Bearer ${tokens[as] || as}`
    if (body !== undefined) allHeaders['Content-Type'] = 'application/json'
    const response = await fetch(base + suffix, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: allHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    return {
      status: response.status,
      body: text ? JSON.parse(text) : null,
      cacheControl: response.headers.get('cache-control'),
    }
  }
  const get = (resource, level, values, options) =>
    request(
      `/dtr-setup/${resource}/${level}?${queryString(values || {})}`,
      options
    )
  const assign = (level, body, options) =>
    request(`/dtr-setup/assignments/${level}`, { body, ...options })
  return {
    ...f,
    request,
    get,
    assign,
    tokens,
    revoke: (token) => revoked.add(token),
  }
}

const codes = (rows, key = 'system_code') => rows.map((row) => row[key]).sort()

test('levels, statements and HR mappings are fixed and server-owned', () => {
  assert.deepEqual(
    [...LEVELS.keys()],
    ['division', 'department', 'project', 'sub-project']
  )
  assert.deepEqual(
    [...ORGANIZATION.keys()],
    [
      'companies',
      'branches',
      'divisions',
      'departments',
      'projects',
      'sub-projects',
    ]
  )
  assert.deepEqual([...EMPLOYEE_QUERIES.keys()], [...LEVELS.keys()])
  assert.deepEqual([...PATH_QUERIES.keys()], [...LEVELS.keys()])
  for (const entry of ORGANIZATION.values()) {
    assert.ok(Object.isFrozen(entry))
    assert.doesNotMatch(entry.query, /SELECT \*/)
  }
  // Code types and parent columns of the existing hierarchy.
  const types = { divisions: 41, departments: 42, projects: 71 }
  for (const [kind, type] of Object.entries(types))
    assert.match(
      ORGANIZATION.get(kind).query,
      new RegExp(`branch_code = @branch AND system_code_type = '${type}'`)
    )
  assert.match(
    ORGANIZATION.get('sub-projects').query,
    /system_code_type = '72'\s+AND major_code = @division AND section_code = @department\s+AND division_code = @project/
  )
  // Employees: active only, always scoped to branch + division, and the UI
  // department/project/sub-project map to HR section/Division/Unit.
  for (const statement of EMPLOYEE_QUERIES.values()) {
    assert.match(statement, /B\.stop_val_flag = 0 AND A\.branch_code = @branch/)
    assert.match(statement, /A\.department = @division/)
    assert.doesNotMatch(statement, /SELECT \*|MenaITech/)
  }
  assert.match(
    EMPLOYEE_QUERIES.get('sub-project'),
    /A\.section = @department AND A\.Division = @project\s+AND A\.Unit = @subProject/
  )
  assert.match(
    EMPLOYEE_QUERIES.get('department'),
    /P\.branch_code = @branch AND P\.system_code_type = '71'/
  )
  assert.match(
    EMPLOYEE_QUERIES.get('project'),
    /U\.branch_code = @branch AND U\.system_code_type = '72'/
  )
  for (const statement of PATH_QUERIES.values())
    assert.match(statement, /D\.branch_code = @branch/)

  assert.match(ASSIGNMENT_LIST_QUERY, /FROM dtr\.adminAssignment/)
  assert.doesNotMatch(ASSIGNMENT_LIST_QUERY, /SELECT \*|adminEmail/)
  // Duplicate check and insert share one transaction and a held range lock.
  assert.match(
    ASSIGNMENT_ADD_STATEMENT,
    /BEGIN TRANSACTION;\s+IF EXISTS \(SELECT 1 FROM dtr\.adminAssignment WITH \(UPDLOCK, HOLDLOCK\)\s+WHERE employeeCode = @employeeCode AND branchName = @branchName/
  )
  assert.match(
    ASSIGNMENT_ADD_STATEMENT,
    /EXEC dtr\.adminAssignment_addData @employeeCode = @employeeCode,/
  )
  assert.match(ASSIGNMENT_ADD_STATEMENT, /SET XACT_ABORT ON/)
  assert.match(ASSIGNMENT_ADD_STATEMENT, /ROLLBACK TRANSACTION/)
  assert.equal(UNASSIGNED, 'undefined')
})

test('paths must match the level exactly and never carry the sentinel', () => {
  for (const [level, fields] of LEVELS) {
    assert.deepEqual(validatePath(fields, levelPath(level)), levelPath(level))
    // Unrelated request fields are ignored; path fields of other levels are not.
    assert.deepEqual(
      validatePath(fields, { ...levelPath(level), adminName: 'x' }),
      levelPath(level)
    )
  }
  const division = LEVELS.get('division')
  for (const source of [
    undefined,
    null,
    'BR1',
    {},
    { branch: 'BR1' },
    { division: '1' },
    { branch: 'BR1', division: '1', department: '10' },
    { branch: 'BR1', division: '1', subProject: '' },
    { branch: 'BR1', division: '1', project: null },
    { branch: 'BR1', division: 'undefined' },
    { branch: 'Undefined', division: '1' },
    { branch: 'BR1', division: '' },
    { branch: 'BR1', division: ' 1' },
    { branch: 'BR1', division: "1' OR '1'='1" },
    { branch: 'BR1', division: '1;DROP' },
    { branch: 'BR1', division: '1'.repeat(11) },
    { branch: 'BR1', division: 1 },
    { branch: ['BR1'], division: '1' },
    { branch: { toString: () => 'BR1' }, division: '1' },
    { branch: 'BR1', division: '١' },
  ])
    assert.throws(() => validatePath(division, source), {
      message: 'invalidPath',
      statusCode: 400,
    })

  assert.deepEqual(storedPath(levelPath('division')), {
    branchName: 'BR1',
    divisionCode: '1',
    departmentCode: 'undefined',
    projectCode: 'undefined',
    subProjectCode: 'undefined',
  })
  assert.deepEqual(storedPath(levelPath('sub-project')), {
    branchName: 'BR1',
    divisionCode: '1',
    departmentCode: '10',
    projectCode: '100',
    subProjectCode: '01',
  })
})

test('role flags keep the popup rules', () => {
  assert.deepEqual(validateRoles({ isReportAdmin: true }), {
    isDTRAdmin: false,
    isApprover: false,
    isManpowerAdmin: false,
    isMigrator: false,
    isReportAdmin: true,
  })
  assert.equal(
    validateRoles({ isDTRAdmin: true, isMigrator: true }).isMigrator,
    true
  )
  for (const source of [
    {},
    null,
    Object.fromEntries(ROLE_FIELDS.map((field) => [field, false])),
    { isDTRAdmin: true, isApprover: true },
    { isDTRAdmin: 1 },
    { isReportAdmin: 'true' },
    { isReportAdmin: true, isMigrator: null },
  ])
    assert.throws(() => validateRoles(source), {
      message: 'invalidRoles',
      statusCode: 400,
    })
})

test('every organization level returns its children with typed, scoped inputs', async (t) => {
  const f = await httpFixture(t)
  const companies = await f.get('organization', 'companies')
  assert.equal(companies.status, 200)
  assert.equal(companies.cacheControl, 'no-store')
  assert.deepEqual(companies.body, [
    {
      company_code: 'ALK',
      company_desc_a: 'الخولي',
      company_desc_e: 'Alkholi',
      comp_logo: 'alk.png',
    },
  ])
  const branches = await f.get('organization', 'branches')
  assert.deepEqual(codes(branches.body, 'branch_code'), ['BR1', 'BR2', 'BR3'])
  assert.deepEqual(Object.keys(branches.body[0]).sort(), [
    'branch_code',
    'branch_name_a',
    'branch_name_e',
    'logo',
  ])

  const p = FULL_PATH
  const divisions = await f.get('organization', 'divisions', {
    branch: p.branch,
  })
  assert.deepEqual(codes(divisions.body), ['1', '2'])
  assert.deepEqual(Object.keys(divisions.body[0]).sort(), [
    'system_code',
    'system_desp_a',
    'system_desp_e',
  ])
  assert.deepEqual(f.calls.at(-1).inputs, {
    branch: { type: { name: 'varchar', length: 10 }, value: 'BR1' },
  })
  assert.equal(f.calls.at(-1).config, 'hr')

  const departments = await f.get(
    'organization',
    'departments',
    levelPath('division')
  )
  assert.deepEqual(codes(departments.body), ['10', '11'])
  const projects = await f.get(
    'organization',
    'projects',
    levelPath('department')
  )
  assert.deepEqual(codes(projects.body), ['100'])
  const subProjects = await f.get(
    'organization',
    'sub-projects',
    levelPath('project')
  )
  assert.deepEqual(subProjects.body, [
    {
      system_code: '01',
      system_desp_a: 'ع 72-01',
      system_desp_e: 'BR1 72-01',
      division_code: '100',
    },
  ])
  assert.deepEqual(
    Object.keys(f.calls.at(-1).inputs).sort(),
    ['branch', 'department', 'division', 'project'].sort()
  )

  // Same codes under another branch return that branch's rows only.
  const other = await f.get('organization', 'departments', {
    branch: 'BR2',
    division: '1',
  })
  assert.deepEqual(
    other.body.map((row) => row.system_desp_e),
    ['BR2 42-10']
  )
  // Empty branches of the tree are empty lists, not errors.
  for (const [kind, values] of [
    ['divisions', { branch: 'BR3' }],
    ['departments', { branch: 'BR1', division: '2' }],
    ['projects', { branch: 'BR1', division: '2', department: '10' }],
    ['sub-projects', { ...levelPath('project'), project: '101' }],
  ]) {
    const empty = await f.get('organization', kind, values)
    assert.deepEqual([empty.status, empty.body], [200, []], kind)
  }
  for (const call of f.calls) assert.doesNotMatch(call.statement, /BR1|BR2/)
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('employee lists are active-only and never mix branches with equal codes', async (t) => {
  const f = await httpFixture(t)
  const expected = {
    division: ['E1', 'E2', 'E5', 'E6'],
    department: ['E1', 'E2'],
    project: ['E1'],
    'sub-project': ['E1'],
  }
  for (const [level, employees] of Object.entries(expected)) {
    const listed = await f.get('employees', level, levelPath(level))
    assert.equal(listed.status, 200, level)
    assert.equal(listed.cacheControl, 'no-store')
    assert.deepEqual(codes(listed.body, 'employee_code'), employees, level)
    assert.deepEqual(Object.keys(listed.body[0]).sort(), [
      'Email',
      'employee_code',
      'employee_name_a',
      'employee_name_eng',
      'employee_picture',
    ])
    const call = f.calls.at(-1)
    assert.equal(call.statement, EMPLOYEE_QUERIES.get(level))
    assert.equal(call.config, 'hr')
    assert.deepEqual(
      Object.keys(call.inputs).sort(),
      [...LEVELS.get(level)].sort()
    )
    for (const input of Object.values(call.inputs))
      assert.deepEqual(input.type, { name: 'varchar', length: 10 })

    const other = await f.get(
      'employees',
      level,
      levelPath(level, { branch: 'BR2' })
    )
    assert.deepEqual(codes(other.body, 'employee_code'), ['E4'], level)
  }
  const empty = await f.get('employees', 'department', {
    branch: 'BR1',
    division: '2',
    department: '10',
  })
  assert.deepEqual([empty.status, empty.body], [200, []])
})

function storedRow(employeeCode, level, extra = {}) {
  return {
    employeeCode,
    adminName: `Admin ${employeeCode}`,
    adminEmail: 'private@example.invalid',
    adminCompany: 'private',
    picPath: 'profile.png',
    isHrPic: 0,
    isPortalPic: 1,
    isDTRAdmin: 1,
    isApprover: 0,
    isManpowerAdmin: 0,
    isMigrator: 0,
    isReportAdmin: 1,
    ...storedPath(levelPath(level)),
    ...extra,
  }
}

test('assignment lists keep the stored sentinel semantics for every level', async (t) => {
  const f = await httpFixture(t)
  const levels = [...LEVELS.keys()]
  levels.forEach((level, index) =>
    f.state.assignments.push({
      id: index + 1,
      ...storedRow(`A${index}`, level),
    })
  )
  // Same codes under another branch.
  f.state.assignments.push({
    id: 9,
    ...storedRow('B2', 'division', { branchName: 'BR2' }),
  })

  for (const [index, level] of levels.entries()) {
    const listed = await f.get('assignments', level, levelPath(level))
    assert.equal(listed.status, 200, level)
    assert.equal(listed.cacheControl, 'no-store')
    assert.deepEqual(listed.body, [
      {
        id: index + 1,
        employeeCode: `A${index}`,
        adminName: `Admin A${index}`,
        picPath: 'profile.png',
        isHrPic: 0,
        isPortalPic: 1,
        isDTRAdmin: 1,
        isApprover: 0,
        isManpowerAdmin: 0,
        isMigrator: 0,
        isReportAdmin: 1,
      },
    ])
    const call = f.calls.at(-1)
    assert.equal(call.statement, ASSIGNMENT_LIST_QUERY)
    assert.equal(call.config, 'portal')
    const stored = storedPath(levelPath(level))
    assert.deepEqual(call.inputs, {
      branchName: { type: { name: 'varchar', length: 100 }, value: 'BR1' },
      divisionCode: { type: { name: 'varchar', length: 10 }, value: '1' },
      departmentCode: {
        type: { name: 'varchar', length: 10 },
        value: stored.departmentCode,
      },
      projectCode: {
        type: { name: 'varchar', length: 10 },
        value: stored.projectCode,
      },
      subProjectCode: {
        type: { name: 'varchar', length: 10 },
        value: stored.subProjectCode,
      },
    })
  }
  assert.equal(f.calls.at(-1).inputs.subProjectCode.value, '01')
  const other = await f.get('assignments', 'division', {
    branch: 'BR2',
    division: '1',
  })
  assert.deepEqual(codes(other.body, 'employeeCode'), ['B2'])
  const empty = await f.get('assignments', 'division', {
    branch: 'BR1',
    division: '2',
  })
  assert.deepEqual([empty.status, empty.body], [200, []])
})

test('assignments are created at every level from trusted lookups', async (t) => {
  const f = await httpFixture(t)
  const flags = {
    division: { isDTRAdmin: true, isReportAdmin: true },
    department: { isApprover: true, isManpowerAdmin: true },
    project: { isMigrator: true },
    'sub-project': { isReportAdmin: true },
  }
  for (const [level, roles] of Object.entries(flags)) {
    const before = f.calls.length
    const created = await f.assign(level, {
      ...levelPath(level),
      employeeCode: TARGET,
      ...roles,
      // Browser-supplied details must never be stored.
      adminName: 'Spoofed Name',
      adminEmail: 'spoof@example.invalid',
      adminCompany: 'SPOOF',
      picPath: '../spoof.png',
      isHrPic: 0,
      branchName: 'BR2',
      subProjectCode: 'zz',
    })
    assert.deepEqual(
      [created.status, created.body],
      [201, { message: 'assignmentAdded' }],
      level
    )
    const row = f.state.assignments.at(-1)
    assert.deepEqual(
      { ...row, id: undefined },
      {
        id: undefined,
        ...storedPath(levelPath(level)),
        employeeCode: TARGET,
        adminName: `Employee ${TARGET}`,
        adminEmail: `${TARGET}@example.invalid`,
        adminCompany: 'BR1',
        picPath: `${TARGET}.jpg`,
        isHrPic: 1,
        isPortalPic: 0,
        isDTRAdmin: roles.isDTRAdmin ? 1 : 0,
        isApprover: roles.isApprover ? 1 : 0,
        isManpowerAdmin: roles.isManpowerAdmin ? 1 : 0,
        isMigrator: roles.isMigrator ? 1 : 0,
        isReportAdmin: roles.isReportAdmin ? 1 : 0,
      },
      level
    )
    const executed = f.calls.slice(before)
    const add = executed.at(-1)
    assert.equal(add.statement, ASSIGNMENT_ADD_STATEMENT)
    assert.equal(add.config, 'portal')
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(add.inputs).map(([name, input]) => [name, input.type])
      ),
      {
        branchName: { name: 'varchar', length: 100 },
        divisionCode: { name: 'varchar', length: 10 },
        departmentCode: { name: 'varchar', length: 10 },
        projectCode: { name: 'varchar', length: 10 },
        subProjectCode: { name: 'varchar', length: 10 },
        employeeCode: { name: 'varchar', length: 10 },
        adminName: { name: 'varchar', length: 100 },
        adminEmail: { name: 'varchar', length: 100 },
        adminCompany: { name: 'varchar', length: 100 },
        picPath: { name: 'nvarchar', length: 300 },
        isHrPic: { name: 'int' },
        isPortalPic: { name: 'int' },
        isDTRAdmin: { name: 'int' },
        isApprover: { name: 'int' },
        isManpowerAdmin: { name: 'int' },
        isMigrator: { name: 'int' },
        isReportAdmin: { name: 'int' },
      }
    )
    // The path is confirmed against HR before the single write statement.
    assert.ok(
      executed.some(
        (call) =>
          call.statement === PATH_QUERIES.get(level) && call.config === 'hr'
      )
    )
    assert.equal(
      executed.filter(
        (call) => call.config === 'portal' && /dtr\./.test(call.statement)
      ).length,
      1,
      'duplicate check and insert are one statement'
    )

    // The new assignment is listed at its own level only.
    const listed = await f.get('assignments', level, levelPath(level))
    assert.deepEqual(codes(listed.body, 'employeeCode'), [TARGET])

    const again = await f.assign(level, {
      ...levelPath(level),
      employeeCode: TARGET,
      ...roles,
    })
    assert.deepEqual(
      [again.status, again.body],
      [409, { message: 'assignmentExists' }]
    )
  }
  assert.equal(f.state.assignments.length, 4)

  // Portal photo wins over the HR photo; an employee without email stays assignable.
  f.state.portalPictures.NOMAIL = 'portal-photo.png'
  const noMail = await f.assign('division', {
    ...levelPath('division'),
    employeeCode: 'NOMAIL',
    isReportAdmin: true,
  })
  assert.equal(noMail.status, 201)
  const row = f.state.assignments.at(-1)
  assert.deepEqual(
    [row.adminEmail, row.picPath, row.isHrPic, row.isPortalPic],
    ['', 'portal-photo.png', 0, 1]
  )
  // The same employee on the same codes of another branch is not a duplicate.
  const otherBranch = await f.assign('division', {
    branch: 'BR2',
    division: '1',
    employeeCode: TARGET,
    isReportAdmin: true,
  })
  assert.equal(otherBranch.status, 201)
  assert.equal(f.state.assignments.at(-1).branchName, 'BR2')
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('concurrent duplicate attempts create one row', async (t) => {
  const f = await httpFixture(t)
  const body = {
    ...levelPath('project'),
    employeeCode: TARGET,
    isApprover: true,
  }
  const responses = await Promise.all(
    Array.from({ length: 6 }, () => f.assign('project', body))
  )
  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [201, 409, 409, 409, 409, 409]
  )
  assert.equal(f.state.assignments.length, 1)
  // No separate pre-check exists whose result could go stale before the insert.
  assert.ok(
    f.calls
      .filter((call) => /dtr\.adminAssignment/.test(call.statement))
      .every((call) => call.statement === ASSIGNMENT_ADD_STATEMENT)
  )
})

test('invalid input, unknown paths, missing employees and failed writes leave no assignment', async (t) => {
  const f = await httpFixture(t)
  const valid = {
    ...levelPath('department'),
    employeeCode: TARGET,
    isReportAdmin: true,
  }
  const sqlBefore = () => f.calls.filter((call) => call.config === 'hr').length

  // Rejected before any HR or assignment statement.
  const hrCalls = sqlBefore()
  for (const [level, body, message] of [
    ['departments', valid, 'invalidLevel'],
    ['__proto__', valid, 'invalidLevel'],
    ['constructor', valid, 'invalidLevel'],
    ['Division', valid, 'invalidLevel'],
    ['division', valid, 'invalidPath'],
    ['project', valid, 'invalidPath'],
    ['department', { ...valid, department: 'undefined' }, 'invalidPath'],
    ['department', { ...valid, branch: "BR1' OR 1=1 --" }, 'invalidPath'],
    ['department', { ...valid, subProject: '' }, 'invalidPath'],
    ['department', { ...valid, division: ['1'] }, 'invalidPath'],
    ['department', { ...valid, isReportAdmin: false }, 'invalidRoles'],
    [
      'department',
      { ...valid, isDTRAdmin: true, isApprover: true },
      'invalidRoles',
    ],
    ['department', { ...valid, isReportAdmin: 1 }, 'invalidRoles'],
    [
      'department',
      { ...valid, employeeCode: undefined },
      'invalidEmployeeCode',
    ],
    ['department', { ...valid, employeeCode: 123 }, 'invalidEmployeeCode'],
    [
      'department',
      { ...valid, employeeCode: "1' OR '1'='1" },
      'invalidEmployeeCode',
    ],
    [
      'department',
      { ...valid, employeeCode: ` ${TARGET}` },
      'invalidEmployeeCode',
    ],
    ['department', [], 'invalidPath'],
  ]) {
    const response = await f.assign(level, body)
    assert.deepEqual(
      [response.status, response.body],
      [400, { message }],
      `${level} ${JSON.stringify(body)}`
    )
  }
  assert.equal(sqlBefore(), hrCalls)

  for (const [body, status, message] of [
    // Valid-looking employee that HR does not know.
    [{ ...valid, employeeCode: 'NOPE01' }, 404, 'employeeInfoMessing'],
    // The assignment column is varchar(10): never truncated into another code.
    [{ ...valid, employeeCode: 'LONGCODE123' }, 422, 'employeeInfoInvalid'],
    // Paths that do not exist in HR, including a wrong parent and a wrong branch.
    [{ ...valid, department: '99' }, 404, 'pathNotFound'],
    [{ ...valid, division: '2' }, 404, 'pathNotFound'],
    [{ ...valid, branch: 'BR3' }, 404, 'pathNotFound'],
    [{ ...valid, branch: 'BR9' }, 404, 'pathNotFound'],
  ]) {
    const response = await f.assign('department', body)
    assert.deepEqual(
      [response.status, response.body],
      [status, { message }],
      JSON.stringify(body)
    )
  }
  assert.equal(
    f.calls.some((call) => call.statement === ASSIGNMENT_ADD_STATEMENT),
    false
  )

  for (const failAt of [
    ASSIGNMENT_ADD_STATEMENT,
    PATH_QUERIES.get('department'),
    HR_EMPLOYEE_QUERY,
    'connect',
  ]) {
    f.state.failAt = failAt
    const response = await f.assign('department', valid)
    assert.deepEqual(
      [response.status, response.body],
      [503, { message: 'serviceUnavailable' }]
    )
  }
  f.state.failAt = null
  assert.equal(f.state.assignments.length, 0)

  // Read routes: controlled validation and failures without database detail.
  for (const [suffix, message] of [
    ['/dtr-setup/organization/units?branch=BR1', 'invalidLevel'],
    ['/dtr-setup/organization/pay_code_tables', 'invalidLevel'],
    ['/dtr-setup/organization/companies?branch=BR1', 'invalidPath'],
    ['/dtr-setup/organization/divisions', 'invalidPath'],
    ['/dtr-setup/organization/divisions?branch=BR1&branch=BR2', 'invalidPath'],
    ['/dtr-setup/organization/divisions?branch[a]=BR1', 'invalidPath'],
    ['/dtr-setup/organization/divisions?branch=BR1&division=1', 'invalidPath'],
    ['/dtr-setup/employees/branch?branch=BR1', 'invalidLevel'],
    ['/dtr-setup/employees/division?branch=BR1', 'invalidPath'],
    [
      '/dtr-setup/employees/division?branch=BR1&division=undefined',
      'invalidPath',
    ],
    [
      '/dtr-setup/employees/division?branch=BR1&division=1%27%20OR%201%3D1',
      'invalidPath',
    ],
    ['/dtr-setup/assignments/toString?branch=BR1&division=1', 'invalidLevel'],
    [
      '/dtr-setup/assignments/division?branch=BR1&division=1&project=100',
      'invalidPath',
    ],
    ['/dtr-setup/assignments/sub-project?branch=BR1&division=1', 'invalidPath'],
  ]) {
    const before = f.calls.length
    const response = await f.request(suffix)
    assert.deepEqual(
      [response.status, response.body],
      [400, { message }],
      suffix
    )
    // Only the role check ran.
    assert.equal(f.calls.length, before + 1, suffix)
  }
  for (const [resource, level, statement] of [
    ['organization', 'departments', ORGANIZATION.get('departments').query],
    ['employees', 'division', EMPLOYEE_QUERIES.get('division')],
    ['assignments', 'division', ASSIGNMENT_LIST_QUERY],
  ]) {
    f.state.failAt = statement
    const response = await f.get(resource, level, levelPath('division'))
    assert.deepEqual(
      [response.status, response.body],
      [503, { message: 'serviceUnavailable' }]
    )
  }
  f.state.failAt = null
  // Disabled edit/delete features have no endpoints.
  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    const response = await f.request(
      `/dtr-setup/assignments/division?${queryString(levelPath('division'))}`,
      { method }
    )
    assert.deepEqual(
      [response.status, response.body],
      [404, { message: 'notFound' }]
    )
  }
  assert.ok(f.pools.every((pool) => pool.closed))
})

function newRouteRequests() {
  return [
    ['/dtr-setup/organization/companies', {}],
    ['/dtr-setup/organization/branches', {}],
    ['/dtr-setup/organization/divisions?branch=BR1', {}],
    [
      `/dtr-setup/organization/departments?${queryString(
        levelPath('division')
      )}`,
      {},
    ],
    [
      `/dtr-setup/organization/projects?${queryString(
        levelPath('department')
      )}`,
      {},
    ],
    [
      `/dtr-setup/organization/sub-projects?${queryString(
        levelPath('project')
      )}`,
      {},
    ],
    ...[...LEVELS.keys()].flatMap((level) => [
      [`/dtr-setup/employees/${level}?${queryString(levelPath(level))}`, {}],
      [`/dtr-setup/assignments/${level}?${queryString(levelPath(level))}`, {}],
      [
        `/dtr-setup/assignments/${level}`,
        {
          body: {
            ...levelPath(level),
            employeeCode: TARGET,
            isReportAdmin: true,
          },
        },
      ],
    ]),
  ]
}

test('every DTR setup operation requires a current portal administrator', async (t) => {
  const f = await httpFixture(t)
  for (const [suffix, options] of newRouteRequests()) {
    for (const as of [null, 'not-a-token']) {
      const before = f.calls.length
      const response = await f.request(suffix, { ...options, as })
      assert.deepEqual(
        [response.status, response.body],
        [401, { message: 'authFailed' }],
        suffix
      )
      assert.equal(f.calls.length, before)
    }
    const before = f.calls.length
    const response = await f.request(suffix, {
      ...options,
      as: 'user',
      // Client-side identity and role claims are never consulted.
      headers: { 'X-Employee-Code': ADMIN, 'X-Portal-Admin': 'true' },
      body: options.body && {
        ...options.body,
        isPortalAdmin: true,
        auth: { employeeCode: ADMIN },
      },
    })
    assert.deepEqual(
      [response.status, response.body],
      [403, { message: 'forbidden' }],
      suffix
    )
    const executed = f.calls.slice(before)
    assert.equal(executed.length, 1, `${suffix} ran only the role check`)
    assert.equal(executed[0].statement, ROLE_QUERIES.get('portalAdmin'))
    assert.equal(executed[0].inputs.employeeCode.value, USER)
  }
  assert.equal(f.state.assignments.length, 0)

  // Membership is re-evaluated per request; a revoked session is rejected.
  const body = {
    ...levelPath('division'),
    employeeCode: TARGET,
    isReportAdmin: true,
  }
  f.state.admins = []
  assert.equal((await f.assign('division', body)).status, 403)
  f.state.admins = [ADMIN]
  f.revoke(f.tokens.admin)
  assert.equal((await f.assign('division', body)).status, 401)
  assert.equal(f.state.assignments.length, 0)
})

test('retired administration SQL endpoints return 404 and execute nothing', async (t) => {
  const f = await httpFixture(t)
  for (const suffix of [
    '/sql-call',
    '/sql-call/',
    '/hr-sql-call',
    '/hr-sql-call/',
    '/SQL-CALL',
    '/dtr-setup/sql-call',
  ]) {
    for (const as of ['admin', 'user', null]) {
      for (const options of [
        { body: { query: 'SELECT 1' } },
        { body: {} },
        { method: 'GET' },
      ]) {
        const response = await f.request(suffix, { ...options, as })
        assert.deepEqual(
          [response.status, response.body],
          [404, { message: 'notFound' }],
          `${suffix} as ${as}`
        )
      }
    }
  }
  assert.equal(f.calls.length, 0)
  // Phase 4 membership routes are still served by the same composition.
  assert.equal((await f.request('/members/portal')).status, 200)
  assert.equal(
    fs.existsSync(path.join(root, 'server/administration/router/sqlCalls.js')),
    false
  )
  for (const file of ['createApi.js', 'main.js'])
    assert.doesNotMatch(
      fs.readFileSync(path.join(root, 'server/administration', file), 'utf8'),
      /sqlCalls|sql-call/i
    )
})

// Frontend: run the real store module and component scripts with mocks.
function transform(source) {
  return babel.transformSync(source, {
    configFile: false,
    babelrc: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code
}

function loadModule(relative, source) {
  const filename = path.resolve(root, relative)
  const module = { exports: {} }
  vm.runInNewContext(transform(source || fs.readFileSync(filename, 'utf8')), {
    module,
    exports: module.exports,
    require: (specifier) =>
      specifier.startsWith('~/')
        ? loadModule(`${specifier.slice(2)}.js`)
        : require(specifier),
  })
  return module.exports
}

function loadComponent(relative) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
  const script = /<script>([\s\S]*?)<\/script>/.exec(source)[1]
  return loadModule(relative, script).default
}

const plain = (value) => JSON.parse(JSON.stringify(value))

function storeRuntime(axios) {
  const en = JSON.parse(
    fs.readFileSync(path.join(root, 'locales/en.json'), 'utf8')
  )
  const lookup = (key) =>
    key.split('.').reduce((value, part) => value && value[part], en)
  return {
    $config: { baseURL: 'https://portal.invalid' },
    $axios: axios,
    app: {
      i18n: {
        te: (key) => typeof lookup(key) === 'string',
        t: (key) => lookup(key) || key,
      },
    },
  }
}

function rejection(status, message) {
  const error = new Error('Request failed')
  error.response = { status, data: { message } }
  return error
}

test('the DTR setup store calls the fixed endpoints without SQL or sentinels', async () => {
  const en = JSON.parse(
    fs.readFileSync(path.join(root, 'locales/en.json'), 'utf8')
  ).errorMessages
  const store = loadModule('store/administration/dtrSetup.js')
  const requests = []
  const notifications = []
  const runtime = storeRuntime({
    get: async (url, config) => {
      requests.push({ method: 'get', url, config: plain(config) })
      return { status: 200, data: [{ row: 1 }] }
    },
    post: async (url, body) => {
      requests.push({ method: 'post', url, body: plain(body) })
      return { status: 201, data: { message: 'assignmentAdded' } }
    },
  })
  const context = {
    commit: () => {},
    dispatch: async (name, value) => notifications.push(value),
  }
  const base = 'https://portal.invalid/administration-api/dtr-setup'
  const division = {
    branch: 'BR1',
    division: '1',
    department: undefined,
    project: undefined,
    subProject: undefined,
  }

  assert.deepEqual(
    await store.actions.getOrganization.call(runtime, context, {
      kind: 'companies',
    }),
    [{ row: 1 }]
  )
  await store.actions.getOrganization.call(runtime, context, {
    kind: 'departments',
    path: division,
  })
  await store.actions.getEmployees.call(runtime, context, {
    level: 'division',
    path: division,
  })
  await store.actions.getAssignments.call(runtime, context, {
    level: 'sub-project',
    path: FULL_PATH,
  })
  assert.equal(
    await store.actions.createAssignment.call(runtime, context, {
      level: 'division',
      path: division,
      employeeCode: TARGET,
      roles: { isDTRAdmin: true, isReportAdmin: true },
    }),
    'created'
  )
  assert.deepEqual(requests, [
    {
      method: 'get',
      url: `${base}/organization/companies`,
      config: { params: {} },
    },
    {
      method: 'get',
      url: `${base}/organization/departments`,
      config: { params: { branch: 'BR1', division: '1' } },
    },
    {
      method: 'get',
      url: `${base}/employees/division`,
      config: { params: { branch: 'BR1', division: '1' } },
    },
    {
      method: 'get',
      url: `${base}/assignments/sub-project`,
      config: { params: FULL_PATH },
    },
    {
      method: 'post',
      url: `${base}/assignments/division`,
      body: {
        branch: 'BR1',
        division: '1',
        employeeCode: TARGET,
        isDTRAdmin: true,
        isReportAdmin: true,
      },
    },
  ])
  assert.doesNotMatch(JSON.stringify(requests), /undefined|select|exec|query/i)
  assert.equal(notifications.length, 0)

  // A successful response that is not a list is treated as empty.
  runtime.$axios.get = async () => ({ status: 200, data: '<html></html>' })
  assert.deepEqual(
    plain(
      await store.actions.getAssignments.call(runtime, context, {
        level: 'division',
        path: division,
      })
    ),
    []
  )

  // Failures: translated message, empty list, and no thrown error.
  runtime.$axios.get = async () => {
    throw rejection(403, 'forbidden')
  }
  for (const [action, payload] of [
    ['getOrganization', { kind: 'divisions', path: division }],
    ['getEmployees', { level: 'division', path: division }],
    ['getAssignments', { level: 'division', path: division }],
  ]) {
    assert.deepEqual(
      plain(await store.actions[action].call(runtime, context, payload)),
      []
    )
    assert.equal(
      notifications.at(-1).message,
      en.administration.dtrSetup.forbidden
    )
  }
  runtime.$axios.get = async () => {
    throw new Error('Network Error')
  }
  assert.deepEqual(
    plain(
      await store.actions.getEmployees.call(runtime, context, {
        level: 'division',
        path: division,
      })
    ),
    []
  )
  assert.equal(notifications.at(-1).message, en.login.serviceUnavailable)

  const payload = {
    level: 'division',
    path: division,
    employeeCode: TARGET,
    roles: { isReportAdmin: true },
  }
  runtime.$axios.post = async () => {
    throw rejection(409, 'assignmentExists')
  }
  assert.equal(
    await store.actions.createAssignment.call(runtime, context, payload),
    'exists'
  )
  assert.equal(
    notifications.at(-1).message,
    en.administration.dtrSetup.assignmentExists
  )
  for (const error of [
    rejection(404, 'pathNotFound'),
    new Error('Network Error'),
  ]) {
    runtime.$axios.post = async () => {
      throw error
    }
    assert.equal(
      await store.actions.createAssignment.call(runtime, context, payload),
      'failed'
    )
  }
  assert.ok(notifications.every((entry) => entry.type === 'error'))
})

const PAGE_CASES = [
  [
    'pages/administration/dtr-setup/divisions/_divisions.vue',
    { branch: 'BR1' },
    [['getBranchDivisions', 'getOrganization', 'divisions', { branch: 'BR1' }]],
  ],
  [
    'pages/administration/dtr-setup/departments/_departments.vue',
    { branch: 'BR1', divisionCode: '1' },
    [
      ['getDepartmentsPerDivision', 'getOrganization', 'departments'],
      ['listAllEmployees', 'getEmployees', 'division'],
      ['getDTRAdmins', 'getAssignments', 'division'],
    ],
    levelPath('division'),
  ],
  [
    'pages/administration/dtr-setup/projects/_projects.vue',
    { branch: 'BR1', divisionCode: '1', departmentCode: '10' },
    [
      ['getProjectsPerDepartment', 'getOrganization', 'projects'],
      ['listAllEmployees', 'getEmployees', 'department'],
      ['getDTRAdmins', 'getAssignments', 'department'],
    ],
    levelPath('department'),
  ],
  [
    'pages/administration/dtr-setup/sub-projects/_subProjects.vue',
    {
      branch: 'BR1',
      divisionCode: '1',
      departmentCode: '10',
      projectCode: '100',
    },
    [
      ['getSubProjectsPerProject', 'getOrganization', 'sub-projects'],
      ['listAllEmployees', 'getEmployees', 'project'],
      ['getDTRAdmins', 'getAssignments', 'project'],
    ],
    levelPath('project'),
  ],
  [
    'pages/administration/dtr-setup/sub-project/_subProject.vue',
    {
      branch: 'BR1',
      divisionCode: '1',
      departmentCode: '10',
      projectCode: '100',
      subProjectCode: '01',
    },
    [
      ['getAllEmployeesPerSubProject', 'getEmployees', 'sub-project'],
      ['getDTRAdmins', 'getAssignments', 'sub-project'],
    ],
    levelPath('sub-project'),
  ],
]

test('every DTR setup page requests its own level and path through the store', async () => {
  for (const [file, data, cases, expectedPath] of PAGE_CASES) {
    const component = loadComponent(file)
    assert.equal(component.layout, 'adminPage', file)
    for (const [method, action, level, explicitPath] of cases) {
      const dispatched = []
      const context = {
        ...component.data.call({}),
        ...data,
        ...component.methods,
        $store: {
          dispatch: async (name, payload) => {
            dispatched.push([name, plain(payload)])
            return [{ system_code: 'X' }]
          },
        },
      }
      await component.methods[method].call(context)
      assert.deepEqual(
        dispatched,
        [
          [
            `administration/dtrSetup/${action}`,
            {
              [action === 'getOrganization' ? 'kind' : 'level']: level,
              path: explicitPath || expectedPath,
            },
          ],
        ],
        `${file} ${method}`
      )
      assert.equal(context.overlay, false)
    }
  }

  const index = loadComponent('pages/administration/dtr-setup/index.vue')
  const dispatched = []
  const context = {
    ...index.data.call({}),
    ...index.methods,
    $store: {
      dispatch: async (name, payload) => {
        dispatched.push([name, plain(payload)])
        return [{ company_code: 'ALK' }]
      },
    },
  }
  await index.methods.getGroupBranches.call(context)
  assert.deepEqual(dispatched, [
    ['administration/dtrSetup/getOrganization', { kind: 'companies' }],
    ['administration/dtrSetup/getOrganization', { kind: 'branches' }],
  ])
})

function popupContext(component, props, overrides = {}) {
  const events = []
  const dispatched = []
  const context = {
    ...component.data.call({}),
    brach: undefined,
    division: undefined,
    department: undefined,
    project: undefined,
    subproject: undefined,
    ...props,
    ...component.methods,
    adminCode: ` ${TARGET} `,
    employeeName: 'Displayed Name',
    employeeEmail: 'displayed@example.invalid',
    memberPicturePath: 'displayed.png',
    result: 'created',
    $t: (key) => key,
    $emit: (name) => events.push(name),
    $store: {
      dispatch: async (name, payload) => {
        dispatched.push([name, plain(payload)])
        return context.result
      },
    },
    ...overrides,
  }
  return { context, events, dispatched }
}

test('the assignment popup sends codes and flags only, at the level of its props', async () => {
  const file = 'components/administration/dtrSetup/drtAdminPopup.vue'
  const component = loadComponent(file)
  const propsByLevel = {
    division: { brach: 'BR1', division: '1' },
    department: { brach: 'BR1', division: '1', department: '10' },
    project: { brach: 'BR1', division: '1', department: '10', project: '100' },
    'sub-project': {
      brach: 'BR1',
      division: '1',
      department: '10',
      project: '100',
      subproject: '01',
    },
  }
  for (const [level, props] of Object.entries(propsByLevel)) {
    const { context, events, dispatched } = popupContext(component, props, {
      isApprover: true,
      isMigrator: true,
    })
    await component.methods.saveDTRAdmin.call(context)
    assert.deepEqual(dispatched, [
      [
        'administration/dtrSetup/createAssignment',
        {
          level,
          // Lower levels are absent, not the text "undefined".
          path: levelPath(level),
          employeeCode: TARGET,
          roles: {
            isDTRAdmin: false,
            isApprover: true,
            isManpowerAdmin: false,
            isMigrator: true,
            isReportAdmin: true,
          },
        },
      ],
    ])
    assert.doesNotMatch(JSON.stringify(dispatched), /Displayed|displayed/)
    assert.deepEqual(events, ['resetPopupValue'])
    assert.equal(context.dialog, false)
    assert.equal(context.overlay, false)
  }

  // A duplicate closes the popup as before; other failures keep it open.
  const duplicate = popupContext(component, propsByLevel.division, {
    result: 'exists',
  })
  await component.methods.saveDTRAdmin.call(duplicate.context)
  assert.deepEqual(duplicate.events, ['resetPopupValue'])
  const failed = popupContext(component, propsByLevel.division, {
    result: 'failed',
  })
  await component.methods.saveDTRAdmin.call(failed.context)
  assert.deepEqual(failed.events, [])
  assert.equal(failed.context.dialog, true)
  assert.equal(failed.context.overlay, false)

  // At least one role is still required before any request.
  const noRole = popupContext(component, propsByLevel.division, {
    isReportsAdmin: false,
  })
  await component.methods.saveDTRAdmin.call(noRole.context)
  assert.deepEqual(noRole.dispatched, [
    [
      'appNotifications/addNotification',
      {
        type: 'error',
        message: 'errorMessages.administration.dtrSetup.invalidRoles',
      },
    ],
  ])
  assert.equal(noRole.context.dialog, true)
})

function sourceFiles(directories) {
  const found = []
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(vue|js)$/.test(entry.name)) found.push(full)
    }
  }
  for (const directory of directories) walk(path.join(root, directory))
  return found
}

const relative = (file) => path.relative(root, file).replaceAll('\\', '/')

test('no DTR setup caller sends SQL, and the popup left the business-card routes', () => {
  const setupFiles = sourceFiles([
    'pages/administration',
    'components/administration',
    'store/administration',
  ])
  assert.ok(setupFiles.length >= 10)
  for (const file of setupFiles) {
    const text = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(
      text,
      /sql-call|business-cards-api|\bquery\s*:/i,
      relative(file)
    )
    assert.doesNotMatch(
      text,
      /\bSELECT\s|\bexec\s+\[|adminAssignment|pay_code_tables|Pay_employees/,
      relative(file)
    )
  }
  const everywhere = sourceFiles([
    'pages',
    'components',
    'store',
    'layouts',
    'utils',
    'plugins',
  ])
  const callers = (pattern) =>
    everywhere
      .filter((file) => pattern.test(fs.readFileSync(file, 'utf8')))
      .map(relative)
      .sort()
  assert.deepEqual(callers(/administration-api\/(hr-)?sql-call/), [])
  // Remaining generic business-card SQL callers, for Phase 6 to migrate.
  assert.deepEqual(callers(/business-cards-api\/(hr-)?sql-call/), [
    'pages/business-cards/activity-logs/index.vue',
    'pages/business-cards/card-generator/index.vue',
    'pages/business-cards/generated-cards/index.vue',
  ])
})

test('English and Arabic contain every DTR setup error code', () => {
  for (const locale of ['en', 'ar']) {
    const messages = JSON.parse(
      fs.readFileSync(path.join(root, `locales/${locale}.json`), 'utf8')
    ).errorMessages.administration.dtrSetup
    for (const key of [
      'employeeInfoMessing',
      'invalidEmployeeCode',
      'employeeInfoInvalid',
      'forbidden',
      'authFailed',
      'serviceUnavailable',
      'invalidLevel',
      'invalidPath',
      'pathNotFound',
      'invalidRoles',
      'assignmentExists',
      'invalidRequest',
    ])
      assert.equal(typeof messages[key], 'string', `${locale}:${key}`)
  }
})
