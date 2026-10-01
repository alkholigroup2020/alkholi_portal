const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const express = require('express')
const babel = require('@babel/core')
const { createRoleChecks, requireRole } = require('../../server/shared/roles')
const { createSessions } = require('../../server/login/services/session')
const { createAuth } = require('../../server/login/services/auth')
const cocRouter = require('../../server/coc/router/cocJS')
const hrRouter = require('../../server/hrSurveys/router/hrSurveys')
const elevatorRouter = require('../../server/elevatorsSurveys/router/elevatorsSurvey')
const vCardRouter = require('../../server/businessCards/router/vCard')
const {
  createPublicCards,
} = require('../../server/businessCards/services/publicCards')
const signatures = require('../../server/coc/services/signatures')
const finishApi = require('../../server/shared/finishApi')

const root = path.resolve(__dirname, '../..')
const flush = async () => {
  await new Promise(setImmediate)
  await new Promise(setImmediate)
}

async function fixture(t) {
  const calls = []
  const pools = []
  const mails = []
  const files = []
  const exports = []
  const state = {
    active: true,
    member: true,
    roleTables: [
      'coc_admins',
      'hr_surveys_users',
      'elevators_users',
      'admin_members',
      'business_card_admins',
      'dtr_users',
    ],
    revoked: false,
    fail: null,
    signature: null,
    history: [],
    version: {
      id: 1,
      file_path: 'version.pdf',
      version_number: "إصدار'",
      active_flag: true,
    },
    employee: {
      name_eng: "O'Neil موظف",
      title_e: 'مهندس',
      email: 'employee@example.invalid',
    },
    hr: {
      employee_code: 'EMP',
      position: "P'",
      branch_code: "B'",
      employee_name_eng: 'موظف',
      Email: 'employee@example.invalid',
      employee_picture: '',
    },
    card: {
      employeeID: 'EMP',
      company: 'Alkholi Group',
      fullName_e: "O'Neil موظف",
      title: 'مهندس',
      landLines: '(11) 111 & (12) 222 & (13) 333',
      faxLine: null,
      profilePic: null,
    },
  }
  function query(statement, inputs, config) {
    calls.push({ statement, inputs, config })
    if (state.fail === 'query') throw new Error('PRIVATE database detail')
    const v = Object.fromEntries(
      Object.entries(inputs).map(([key, param]) => [key, param.value])
    )
    let recordset = []
    if (statement === signatures.ACTOR)
      recordset = state.member ? [{ employeeID: 'ADMIN' }] : []
    else if (statement.includes('AS hasRole'))
      recordset = [
        {
          hasRole:
            state.member &&
            v.employeeCode === 'ADMIN' &&
            state.roleTables.some((table) =>
              statement.includes(`dbo.${table} WHERE`)
            ),
        },
      ]
    else if (statement === signatures.VERSION)
      recordset = state.version ? [state.version] : []
    else if (statement.includes('@versionId'))
      recordset = state.reportRows || []
    else if (
      statement === signatures.EMPLOYEE ||
      statement.includes('SELECT name_eng, title_e') ||
      statement.includes('SELECT name_eng, email')
    )
      recordset = state.active ? [state.employee] : []
    else if (statement === signatures.SIGNATURE)
      recordset = state.signature ? [state.signature] : []
    else if (statement === signatures.DECIDE)
      recordset = state.signature && v.id === 1 ? [state.signature] : []
    else if (statement === signatures.SUBMIT) {
      state.signature = {
        id: 1,
        status: 'pending',
        employee_id: v.employee_id,
        coc_version_id: v.version_id,
        file_path: v.file_path,
      }
      state.history.push('pending')
      if (state.fail === 'history') throw new Error('PRIVATE history failure')
    } else if (statement === signatures.UPDATE) {
      state.signature.status = v.status
      state.signature.approved_by = v.actor
      state.history.push(v.status)
      if (state.fail === 'history') throw new Error('PRIVATE history failure')
      recordset = [state.employee]
    } else if (statement.includes('FROM businessCards.employeeData'))
      recordset = state.card ? [state.card] : []
    else if (statement.includes('FROM dbo.Pay_employees'))
      recordset = state.hr ? [state.hr] : []
    else if (statement.includes('FROM dbo.pay_code_tables'))
      recordset = [{ system_desp_a: 'مهندس', system_desp_e: "Engineer'" }]
    else if (statement.includes('SELECT fullName FROM dbo.coc_admins'))
      recordset = [{ fullName: 'Trusted Administrator' }]
    else if (statement.includes('SELECT mailAddress FROM dbo.coc_admins'))
      recordset = [{ mailAddress: 'admin@example.invalid' }]
    else if (statement.includes('WHERE version_number')) recordset = []
    else if (
      statement.trim().startsWith('SELECT TOP 1 id FROM coc.coc_versions') ||
      statement.trim().startsWith('SELECT TOP (1) id, version_number') ||
      statement.trim().startsWith('SELECT id, version_number')
    )
      recordset = state.version ? [state.version] : []
    else if (
      statement.includes('FROM coc.employees e') &&
      statement.includes('@employee_id')
    )
      recordset = state.active
        ? [{ ...state.employee, employee_id: v.employee_id, is_active: true }]
        : []
    return { recordset, rowsAffected: [1] }
  }
  class Request {
    constructor(owner) {
      this.owner = owner
      this.inputs = {}
    }

    input(name, type, value) {
      this.inputs[name] = { type, value }
      return this
    }

    async query(statement) {
      return query(statement, this.inputs, this.owner.config)
    }

    async execute(statement) {
      return query(statement, this.inputs, this.owner.config)
    }
  }
  class ConnectionPool {
    constructor(config) {
      this.config = config
      this.closed = false
      pools.push(this)
    }

    async connect() {
      if (state.fail === this.config || state.fail === 'connect')
        throw new Error('PRIVATE connect')
    }

    async close() {
      this.closed = true
    }

    request() {
      return new Request(this)
    }
  }
  let queue = Promise.resolve()
  class Transaction {
    constructor(pool) {
      this.config = pool.config
    }

    async begin(level) {
      assert.equal(level, 'serializable')
      const previous = queue
      queue = new Promise((resolve) => {
        this.release = resolve
      })
      await previous
      this.snapshot = structuredClone({
        signature: state.signature,
        history: state.history,
      })
    }

    async commit() {
      if (state.fail === 'commit') throw new Error('PRIVATE commit')
      this.release()
    }

    async rollback() {
      Object.assign(state, this.snapshot)
      this.release()
    }
  }
  const sql = {
    ConnectionPool,
    Transaction,
    Request,
    ISOLATION_LEVEL: { SERIALIZABLE: 'serializable' },
    Int: 'int',
    DateTime: 'datetime',
    VarChar: (length) => ({ name: 'varchar', length }),
    NVarChar: (length) => ({ name: 'nvarchar', length }),
  }
  const sessions = createSessions('remaining-audit-tests-only-key')
  const tokens = Object.fromEntries(
    ['ADMIN', 'EMP'].map((employeeCode) => [
      employeeCode,
      sessions.issue({
        employeeCode,
        userAccount: employeeCode,
        domain: 'alkholi',
      }),
    ])
  )
  const authorize = createAuth({
    sessions,
    repository: { isRegistered: async () => !state.revoked },
  }).authorize
  const roleChecks = createRoleChecks({ sql, portalConfig: 'portal' })
  const roles = (role) => requireRole(roleChecks, role)
  const uploadFactory = () => ({
    single: () => (req, res, next) => {
      files.push('upload')
      req.file = { path: 'temporary.pdf', filename: 'upload.pdf' }
      next()
    },
  })
  uploadFactory.diskStorage = (storage) => storage
  const fileSystem = {
    readFileSync: () => {
      files.push('read')
      return Buffer.from('fixture')
    },
    writeFileSync: (filename) => files.push(filename),
    existsSync: () => true,
    unlinkSync: (filename) => files.push(`delete:${filename}`),
  }
  const drawn = []
  const page = { drawText: (value) => drawn.push(value), drawImage() {} }
  const document = {
    registerFontkit() {},
    embedFont: async () => ({ widthOfTextAtSize: () => 10 }),
    embedPng: async () => ({ width: 10, height: 10 }),
    addPage: () => page,
    getPageIndices: () => [0],
    copyPages: async () => [page],
    save: async () => Buffer.from('PDF'),
  }
  const pdfDocument = {
    create: async () => document,
    load: async () => document,
  }
  const transporter = {
    sendMail: async (mail) => {
      mails.push(mail)
      if (state.fail === 'email') throw new Error('PRIVATE email')
    },
  }
  let clients = 0
  let closedClients = 0
  const createClient = () => {
    clients++
    return {
      connect: async () => {
        if (state.fail === 'mongo') throw new Error('PRIVATE mongo')
      },
      close: async () => {
        closedClients++
      },
      db: () => ({
        collection: () => ({
          find: () => ({ toArray: async () => [{ clientName: 'موظف' }] }),
          findOne: async () =>
            state.fail === 'missingSurvey' ? null : { Name: 'موظف' },
          insertOne: async (data) => {
            exports.push(data)
          },
        }),
      }),
    }
  }
  const createCsvWriter = () => ({
    writeRecords: async (records) => {
      exports.push(records)
      if (state.fail === 'csv') throw new Error('PRIVATE filesystem')
    },
  })
  const app = express()
  function mount(url, router) {
    const api = express()
    api.use(express.json())
    api.use(router)
    app.use(url, finishApi(api))
  }
  mount(
    '/coc-api',
    cocRouter({
      sql,
      portalConfig: 'portal',
      authorize,
      requireCocAdmin: roles('cocAdmin'),
      fs: fileSystem,
      transporter,
      uploadFactory,
      pdfDocument,
    })
  )
  mount(
    '/hr-surveys-api',
    hrRouter({
      sql,
      portalConfig: 'portal',
      hrConfig: 'hr',
      auth: authorize,
      requireSurveyMember: roles('hrSurveysUser'),
      createClient,
      createCsvWriter,
    })
  )
  mount(
    '/elevators-surveys-api',
    elevatorRouter({
      auth: authorize,
      requireSurveyMember: roles('elevatorsUser'),
      createClient,
      transporter,
      createCsvWriter,
    })
  )
  const publicCards = createPublicCards({ sql, portalConfig: 'portal' })
  const vCard = vCardRouter({
    publicCards,
    embedPhoto: async () => {
      files.push('photo')
    },
  })
  app.use(
    '/business-cards-api',
    require('../../server/businessCards/createApi')({
      authorize,
      requireCardsAdmin: roles('businessCardsAdmin'),
      publicCards,
      cardManagement: {},
      vCard,
    })
  )
  app.use(
    '/administration-api',
    require('../../server/administration/createApi')({
      authorize,
      requirePortalAdmin: roles('portalAdmin'),
      memberships: {},
      dtrSetup: {},
    })
  )
  app.use(
    '/dtr-api',
    require('../../server/dtr/createApi')({
      authorize,
      requireDtrUser: roles('dtrUser'),
      dtrReads: {},
      dtrWrites: {},
    })
  )
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  async function request(url, { as = 'ADMIN', method = 'GET', body } = {}) {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}${url}`,
      {
        method,
        headers: {
          ...(as ? { Authorization: `Bearer ${tokens[as] || as}` } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }
    )
    const raw = await response.text()
    return {
      status: response.status,
      headers: response.headers,
      raw,
      data:
        raw && response.headers.get('content-type')?.includes('json')
          ? JSON.parse(raw)
          : raw,
    }
  }
  return {
    request,
    state,
    sql,
    calls,
    pools,
    mails,
    files,
    exports,
    drawn,
    clientCounts: () => [clients, closedClients],
  }
}

const protectedRoutes = [
  ['coc-api', 'get-coc-versions', 'GET'],
  ['coc-api', 'save-coc-document', 'POST'],
  ['coc-api', 'delete-version/1', 'DELETE'],
  ['coc-api', 'get-employee-compliance', 'GET'],
  ['coc-api', 'get-submissions-history', 'GET'],
  ['coc-api', 'export-report?type=signed', 'GET'],
  ['coc-api', 'send-single-email', 'POST'],
  ['coc-api', 'approve-signature', 'POST'],
  ['coc-api', 'reject-signature', 'POST'],
  ['hr-surveys-api', 'get-hr-survey-data', 'GET'],
  ['hr-surveys-api', 'get-single-hr-survey', 'POST'],
  ['hr-surveys-api', 'get-survey-employee-data', 'POST'],
  ['hr-surveys-api', 'export-csv-data', 'POST'],
  ['elevators-surveys-api', 'send-survey-request', 'POST'],
  ['elevators-surveys-api', 'get-clients-survey-data', 'GET'],
  ['elevators-surveys-api', 'get-anonymous-survey-data', 'GET'],
  ['elevators-surveys-api', 'export-clients-csv-data', 'POST'],
  ['elevators-surveys-api', 'export-anonymous-csv-data', 'POST'],
]

test('every CoC administrative and survey route requires its own membership before effects', async (t) => {
  const f = await fixture(t)
  for (const [module, route, method] of protectedRoutes) {
    for (const as of [null, 'tampered', 'EMP']) {
      const result = await f.request(`/${module}/${route}`, {
        as,
        method,
        ...(method === 'POST'
          ? {
              body: {
                employeeCode: 'ADMIN',
                adminId: 'ADMIN',
                sql: 'SELECT 1',
              },
            }
          : {}),
      })
      assert.equal(
        result.status,
        as === 'EMP' ? 403 : 401,
        `${module}/${route}`
      )
    }
  }
  assert.ok(f.calls.every((call) => call.statement.includes('AS hasRole')))
  assert.deepEqual(f.clientCounts(), [0, 0])
  assert.deepEqual([f.files, f.exports, f.mails], [[], [], []])
  f.state.member = false
  assert.equal((await f.request('/coc-api/get-coc-versions')).status, 403)
})

test('employee CoC reads ignore spoofed identity and current-version access requires active ownership', async (t) => {
  const f = await fixture(t)
  const result = await f.request('/coc-api/get-single-employee-data', {
    as: 'EMP',
    method: 'POST',
    body: { employeeID: 'OTHER' },
  })
  assert.equal(result.status, 200)
  assert.equal(result.data.employee_id, 'EMP')
  assert.equal(
    (await f.request('/coc-api/get-current-coc-version', { as: 'EMP' })).status,
    200
  )
  f.state.active = false
  for (const [route, method] of [
    ['get-current-coc-version', 'GET'],
    ['generate-print-form', 'POST'],
    ['upload-signed-form', 'POST'],
  ])
    assert.equal(
      (
        await f.request(`/coc-api/${route}`, {
          as: 'EMP',
          method,
          ...(method === 'POST' ? { body: {} } : {}),
        })
      ).status,
      403
    )
  assert.deepEqual(f.files, [])
})

test('CoC self-service rejects missing, tampered and revoked sessions; portal membership never grants module roles', async (t) => {
  const f = await fixture(t)
  for (const as of [null, 'tampered', 'EMP']) {
    f.state.revoked = as === 'EMP'
    for (const [route, method] of [
      ['get-current-coc-version', 'GET'],
      ['get-single-employee-data', 'POST'],
      ['generate-print-form', 'POST'],
      ['upload-signed-form', 'POST'],
    ])
      assert.equal(
        (
          await f.request(`/coc-api/${route}`, {
            as,
            method,
            ...(method === 'POST' ? { body: {} } : {}),
          })
        ).status,
        401
      )
  }
  assert.deepEqual(f.calls, [])
  assert.deepEqual(f.files, [])
  f.state.revoked = false
  f.state.roleTables = ['admin_members']
  for (const [module, route, method] of protectedRoutes)
    assert.equal(
      (
        await f.request(`/${module}/${route}`, {
          method,
          ...(method === 'POST' ? { body: {} } : {}),
        })
      ).status,
      403
    )
  assert.deepEqual([f.mails, f.files, f.exports], [[], [], []])
})

test('printed CoC forms use trusted profile and date; wrong owner cannot write a file', async (t) => {
  const f = await fixture(t)
  assert.equal(
    (
      await f.request('/coc-api/generate-print-form', {
        as: 'EMP',
        method: 'POST',
        body: { employeeID: 'OTHER' },
      })
    ).status,
    403
  )
  assert.deepEqual(f.files, [])
  const result = await f.request('/coc-api/generate-print-form', {
    as: 'EMP',
    method: 'POST',
    body: { name: 'SPOOF', date: 'SPOOF' },
  })
  assert.equal(result.status, 200)
  assert.ok(f.drawn.includes(f.state.employee.name_eng))
  assert.ok(!f.drawn.includes('SPOOF'))
  assert.match(result.data.url, /^\/coc-api\/printed-copies\/PRINTFORM_/)
})

test('version upload binds Unicode version and authenticated administrator, ignoring supplied audit fields', async (t) => {
  const f = await fixture(t)
  const versionNumber = "نسخة'"
  const result = await f.request('/coc-api/save-coc-document', {
    method: 'POST',
    body: { versionNumber, adminID: 'OTHER', adminName: 'SPOOF' },
  })
  assert.equal(result.status, 201)
  const call = f.calls.find(
    (call) => call.statement === 'coc.coc_versions_addVersion'
  )
  assert.equal(call.inputs.admin_id.value, 'ADMIN')
  assert.equal(call.inputs.admin_name.value, 'Trusted Administrator')
  assert.equal(call.inputs.version_number.value, versionNumber)
  assert.equal(call.inputs.version_number.type.name, 'nvarchar')
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('CoC submissions keep session ownership, one version, history and repeat-safe decisions', async (t) => {
  const f = await fixture(t)
  const submit = () =>
    f.request('/coc-api/upload-signed-form', {
      as: 'EMP',
      method: 'POST',
      body: { employeeID: 'OTHER' },
    })
  assert.equal((await submit()).status, 200)
  assert.equal(f.state.signature.employee_id, 'EMP')
  assert.equal(f.state.signature.coc_version_id, 1)
  await flush()
  assert.equal(f.mails[0].to, 'admin@example.invalid')
  const decision = (route) =>
    f.request(`/coc-api/${route}-signature`, {
      method: 'POST',
      body: {
        signatureId: 1,
        expectedFilePath: f.state.signature?.file_path,
        adminId: 'SPOOF',
      },
    })
  assert.equal((await decision('reject')).status, 200)
  assert.equal((await submit()).status, 200)
  assert.equal((await decision('approve')).status, 200)
  assert.equal(f.state.signature.approved_by, 'ADMIN')
  assert.equal((await decision('reject')).status, 409)
  assert.equal((await submit()).status, 409)
  assert.deepEqual(f.state.history, [
    'pending',
    'rejected',
    'pending',
    'approved',
  ])
  await flush()
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('CoC decisions serialize; failed history writes roll back and never notify', async (t) => {
  const f = await fixture(t)
  f.state.signature = { id: 1, status: 'pending', file_path: 'submitted.pdf' }
  const service = signatures.createSignatures({
    sql: f.sql,
    portalConfig: 'portal',
  })
  const results = await Promise.allSettled([
    service.decide(1, 'ADMIN', true, 'submitted.pdf'),
    service.decide(1, 'ADMIN', false, 'submitted.pdf'),
  ])
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1
  )
  assert.equal(
    results.find((result) => result.status === 'rejected').reason.statusCode,
    409
  )
  f.state.signature = { id: 1, status: 'pending', file_path: 'submitted.pdf' }
  f.state.history = []
  f.state.fail = 'history'
  const result = await f.request('/coc-api/approve-signature', {
    method: 'POST',
    body: {
      signatureId: 1,
      expectedFilePath: f.state.signature?.file_path || 'submitted.pdf',
    },
  })
  assert.equal(result.status, 503)
  assert.equal(result.data.message, 'serviceUnavailable')
  assert.equal(f.state.signature.status, 'pending')
  assert.deepEqual(f.state.history, [])
  assert.deepEqual(f.mails, [])
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('CoC decisions cannot approve a resubmission using the previously displayed document', async (t) => {
  const f = await fixture(t)
  f.state.signature = { id: 1, status: 'pending', file_path: 'replacement.pdf' }
  const result = await f.request('/coc-api/approve-signature', {
    method: 'POST',
    body: { signatureId: 1, expectedFilePath: 'previous.pdf' },
  })
  assert.equal(result.status, 409)
  assert.equal(f.state.signature.status, 'pending')
  assert.deepEqual(f.state.history, [])
  assert.deepEqual(f.mails, [])
})

test('CoC rechecks administrator membership inside decisions and cleans failed submission artifacts', async (t) => {
  const f = await fixture(t)
  const service = signatures.createSignatures({
    sql: f.sql,
    portalConfig: 'portal',
  })
  f.state.member = false
  f.state.signature = { id: 1, status: 'pending', file_path: 'submitted.pdf' }
  await assert.rejects(
    service.decide(1, 'ADMIN', true, 'submitted.pdf'),
    (error) => error.statusCode === 403
  )
  assert.equal(f.state.signature.status, 'pending')
  f.state.member = true
  f.state.signature = null
  f.state.fail = 'history'
  const failed = await f.request('/coc-api/upload-signed-form', {
    as: 'EMP',
    method: 'POST',
    body: {},
  })
  assert.equal(failed.status, 503)
  assert.equal(f.state.signature, null)
  assert.deepEqual(f.state.history, [])
  assert.ok(f.files.includes('delete:temporary.pdf'))
  assert.ok(
    f.files.some(
      (filename) =>
        filename.startsWith('delete:') && filename.includes('Signed_Form_')
    )
  )
  assert.deepEqual(f.mails, [])
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('CoC export allowlists formats and report types, binds stored version and retains all three formats', async (t) => {
  const f = await fixture(t)
  f.state.reportRows = [
    {
      employee_id: 'EMP',
      name_eng: "O'Neil موظف",
      branch_code: 'BR',
      title_e: 'مهندس',
      version_number: 'نسخة',
      signed_at: '2026-10-01',
    },
  ]
  for (const format of ['csv', 'xlsx', 'pdf']) {
    const result = await f.request(
      `/coc-api/export-report?type=signed&format=${format}`
    )
    assert.equal(result.status, 200, format)
    assert.match(
      result.headers.get('content-disposition'),
      new RegExp(`signed_employees.${format}`)
    )
    if (format === 'csv') assert.match(result.raw, /موظف/)
  }
  assert.ok(f.drawn.includes("O'Neil موظف"))
  assert.ok(
    f.calls
      .filter((call) => call.statement.includes('@versionId'))
      .every(
        (call) =>
          call.inputs.versionId.type === 'int' &&
          call.inputs.versionId.value === 1
      )
  )
  for (const url of [
    'type=unknown',
    'type=signed&format=sql',
    'type=signed&type=unsigned',
  ])
    assert.equal((await f.request(`/coc-api/export-report?${url}`)).status, 400)
  f.state.version = null
  assert.equal(
    (await f.request('/coc-api/export-report?type=signed')).status,
    404
  )
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('failed CoC version upload removes temporary files and never truncates version strings', async (t) => {
  const f = await fixture(t)
  assert.equal(
    (
      await f.request('/coc-api/save-coc-document', {
        method: 'POST',
        body: { versionNumber: 'x'.repeat(21) },
      })
    ).status,
    400
  )
  assert.ok(f.files.includes('delete:temporary.pdf'))
  assert.ok(
    !f.calls.some((call) => call.statement === 'coc.coc_versions_addVersion')
  )
  f.state.fail = 'connect'
  assert.equal(
    (await f.request('/coc-api/get-employee-compliance')).status,
    503
  )
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('uncertain CoC commits retain generated documents and return failure without notification', async (t) => {
  const f = await fixture(t)
  f.state.fail = 'commit'
  assert.equal(
    (
      await f.request('/coc-api/upload-signed-form', {
        as: 'EMP',
        method: 'POST',
        body: {},
      })
    ).status,
    503
  )
  assert.ok(f.files.some((filename) => filename.includes('Signed_Form_')))
  assert.ok(
    !f.files.some(
      (filename) =>
        filename.startsWith('delete:') && filename.includes('Signed_Form_')
    )
  )
  assert.deepEqual(f.mails, [])
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('CoC missing and malformed signature IDs do not write; reminders use stored recipients', async (t) => {
  const f = await fixture(t)
  for (const signatureId of [null, "1'--", {}, 2147483648])
    assert.equal(
      (
        await f.request('/coc-api/approve-signature', {
          method: 'POST',
          body: { signatureId },
        })
      ).status,
      400
    )
  assert.equal(
    (
      await f.request('/coc-api/approve-signature', {
        method: 'POST',
        body: {
          signatureId: 1,
          expectedFilePath: f.state.signature?.file_path || 'submitted.pdf',
        },
      })
    ).status,
    404
  )
  assert.deepEqual(f.mails, [])
  assert.equal(
    (
      await f.request('/coc-api/send-single-email', {
        method: 'POST',
        body: {
          employeeCode: 'EMP',
          email: 'other@example.invalid',
          name: 'SPOOF',
        },
      })
    ).status,
    200
  )
  assert.equal(f.mails[0].to, 'employee@example.invalid')
  assert.ok(f.mails[0].text.includes(f.state.employee.name_eng))
  f.state.active = false
  assert.equal(
    (
      await f.request('/coc-api/send-single-email', {
        method: 'POST',
        body: { employeeCode: 'EMP' },
      })
    ).status,
    404
  )
  assert.equal(f.mails.length, 1)
})

test('HR survey lookup binds request and stored title/branch values and preserves consumers', async (t) => {
  const f = await fixture(t)
  const code = "E' OR 1=1--"
  const result = await f.request('/hr-surveys-api/get-survey-employee-data', {
    method: 'POST',
    body: { code },
  })
  assert.equal(result.status, 200)
  assert.equal(result.data.titleInfo.system_desp_a, 'مهندس')
  assert.equal(result.data.memberPicturePath, 'anonymousProfilePicture.jpeg')
  const employee = f.calls.find((call) =>
    call.statement.includes('FROM dbo.Pay_employees')
  )
  assert.equal(employee.inputs.code.value, code)
  assert.equal(employee.inputs.code.type.length, 15)
  const title = f.calls.find((call) =>
    call.statement.includes('FROM dbo.pay_code_tables')
  )
  assert.equal(title.inputs.position.value, "P'")
  assert.equal(title.inputs.branch.value, "B'")
  assert.ok(
    f.calls.every(
      (call) => !call.statement.includes(code) && !call.statement.includes("B'")
    )
  )
  f.state.hr.position = '00021'
  assert.equal(
    (
      await f.request('/hr-surveys-api/get-survey-employee-data', {
        method: 'POST',
        body: { code: 'EMP' },
      })
    ).status,
    200
  )
  const normalizedTitle = f.calls
    .filter((call) => call.statement.includes('FROM dbo.pay_code_tables'))
    .at(-1)
  assert.equal(normalizedTitle.inputs.position.value, '21')
  f.state.hr = null
  assert.equal(
    (
      await f.request('/hr-surveys-api/get-survey-employee-data', {
        method: 'POST',
        body: { code: 'NONE' },
      })
    ).status,
    205
  )
  f.state.fail = 'hr'
  assert.equal(
    (
      await f.request('/hr-surveys-api/get-survey-employee-data', {
        method: 'POST',
        body: { code: 'EMP' },
      })
    ).status,
    503
  )
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('HR survey ObjectIds, empty results and export shapes are validated; clients close on failures', async (t) => {
  const f = await fixture(t)
  assert.equal(
    (
      await f.request('/hr-surveys-api/get-single-hr-survey', {
        method: 'POST',
        body: { id: { $ne: null } },
      })
    ).status,
    400
  )
  const id = '123456789012345678901234'
  assert.equal(
    (
      await f.request('/hr-surveys-api/get-single-hr-survey', {
        method: 'POST',
        body: { id },
      })
    ).status,
    200
  )
  f.state.fail = 'missingSurvey'
  assert.equal(
    (
      await f.request('/hr-surveys-api/get-single-hr-survey', {
        method: 'POST',
        body: { id },
      })
    ).status,
    404
  )
  f.state.fail = 'mongo'
  assert.equal(
    (await f.request('/hr-surveys-api/get-hr-survey-data')).status,
    503
  )
  assert.deepEqual(f.clientCounts(), [3, 3])
  const body = [{ "سؤال'": [1, 2, 3, 4, 5] }]
  f.state.fail = null
  assert.equal(
    (
      await f.request('/hr-surveys-api/export-csv-data', {
        method: 'POST',
        body,
      })
    ).status,
    200
  )
  assert.equal(f.exports[0][0].question, "سؤال'")
  assert.equal(
    (
      await f.request('/hr-surveys-api/export-csv-data', {
        method: 'POST',
        body: [{}],
      })
    ).status,
    400
  )
  f.state.fail = 'csv'
  assert.equal(
    (
      await f.request('/hr-surveys-api/export-csv-data', {
        method: 'POST',
        body,
      })
    ).status,
    503
  )
})

test('elevator members retain survey reports, exports and bounded bilingual notices with isolated clients', async (t) => {
  const f = await fixture(t)
  for (const [route, method] of [
    ['get-clients-survey-data', 'GET'],
    ['get-anonymous-survey-data', 'GET'],
    ['export-clients-csv-data', 'POST'],
    ['export-anonymous-csv-data', 'POST'],
  ])
    assert.equal(
      (
        await f.request(`/elevators-surveys-api/${route}`, {
          method,
          ...(method === 'POST' ? { body: {} } : {}),
        })
      ).status,
      200
    )
  const body = {
    contractID: "Contract'",
    clientName: "O'Neil",
    projectName: 'مشروع',
    customerEmail: 'customer@example.invalid',
    customerMobileNumber: '123',
    mailBody: 'Hello\n<name>',
    arabicMessage: 'مرحبا\n<اسم>',
    status: 'SPOOF',
  }
  assert.equal(
    (
      await f.request('/elevators-surveys-api/send-survey-request', {
        method: 'POST',
        body,
      })
    ).status,
    200
  )
  assert.equal(f.exports.at(-1).status, undefined)
  assert.match(f.mails[0].html, /&lt;اسم&gt;/)
  assert.deepEqual(f.clientCounts(), [5, 5])
  f.state.fail = 'email'
  assert.equal(
    (
      await f.request('/elevators-surveys-api/send-survey-request', {
        method: 'POST',
        body,
      })
    ).status,
    503
  )
  assert.deepEqual(f.clientCounts(), [6, 6])
})

test('public vCard has correct headers and Unicode content, safe phones and controlled missing/error responses', async (t) => {
  const f = await fixture(t)
  const request = (employeeID) =>
    f.request(
      `/business-cards-api/vcard/?employeeID=${encodeURIComponent(employeeID)}`,
      { as: null }
    )
  const result = await request('EMP')
  assert.equal(result.status, 200)
  assert.match(
    result.headers.get('content-type'),
    /^text\/vcard; charset=utf-8/
  )
  assert.equal(
    result.headers.get('content-disposition'),
    'inline; filename="EMP.vcf"'
  )
  assert.match(result.raw, /BEGIN:VCARD[\s\S]*O'Neil موظف[\s\S]*END:VCARD/)
  assert.match(result.raw, /\+96613333/)
  assert.ok(!result.raw.includes('undefined'))
  assert.equal((await request("EMP'--")).status, 400)
  f.state.card = null
  assert.equal((await request('EMP')).status, 404)
  f.state.fail = 'query'
  assert.equal((await request('EMP')).status, 503)
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('custom vCards retain address fields, prevent stored-file traversal and CRLF record injection', async (t) => {
  const f = await fixture(t)
  f.state.card.company = 'Custom'
  f.state.card.fullName_e = 'Name\r\nX-INJECTED:yes'
  const result = await f.request(
    '/business-cards-api/vcard/?employeeID=EMP&firstAddress=Paris&secondAddress=France',
    { as: null }
  )
  assert.equal(result.status, 200)
  assert.match(result.raw, /Paris/)
  assert.match(result.raw, /France/)
  assert.doesNotMatch(result.raw, /\r\nX-INJECTED:/)
  f.state.card.profilePic = '../private.png'
  assert.equal(
    (await f.request('/business-cards-api/vcard/?employeeID=EMP', { as: null }))
      .status,
    503
  )
  assert.deepEqual(f.files, [])
  assert.equal(
    (
      await f.request(
        '/business-cards-api/vcard/?employeeID=EMP&firstAddress=a&firstAddress=b',
        { as: null }
      )
    ).status,
    400
  )
})

test('all retired gateways return routed 404 for all methods and sessions without database or side effects', async (t) => {
  const f = await fixture(t)
  for (const module of [
    'administration',
    'business-cards',
    'dtr',
    'coc',
    'hr-surveys',
    'elevators-surveys',
  ])
    for (const route of [
      'sql-call',
      'hr-sql-call',
      'sql-params-call',
      'open-sql-call',
    ])
      for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
        for (const as of [null, 'EMP', 'ADMIN'])
          assert.equal(
            (
              await f.request(`/${module}-api/${route}`, {
                method,
                as,
                ...(method === 'GET' ? {} : { body: { sql: 'SELECT 1' } }),
              })
            ).status,
            404
          )
  assert.deepEqual(f.calls, [])
  assert.deepEqual([f.files, f.exports, f.mails], [[], [], []])
})

function load(relative) {
  let source = fs.readFileSync(path.join(root, relative), 'utf8')
  if (relative.endsWith('.vue'))
    source = source.match(/<script>([\s\S]*?)<\/script>/)[1]
  const module = { exports: {} }
  const code = babel.transformSync(source, {
    configFile: false,
    babelrc: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code
  require('node:vm').runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) =>
      name.startsWith('~/')
        ? require(path.join(root, name.slice(2)))
        : require(name),
    Date,
  })
  return module.exports.default || module.exports
}

test('real CoC frontend callers send no audit actor, use scoped current versions and employee-targeted reminders', async () => {
  const store = load('store/coc/index.js')
  const calls = []
  const context = {
    $config: { baseURL: '/base' },
    $axios: {
      get: async (url) => {
        calls.push(url)
        return { status: 200, data: [] }
      },
    },
  }
  await store.actions.fetchCoCVersions.call(context, { dispatch() {} }, true)
  await store.actions.fetchCoCVersions.call(context, { dispatch() {} })
  assert.deepEqual(calls, [
    '/base/coc-api/get-current-coc-version',
    '/base/coc-api/get-coc-versions',
  ])
  const reminder = load('components/coc/emailConfirmation.vue')
  let payload
  await reminder.methods.sendEmail.call({
    employeeCode: 'EMP',
    $emit() {},
    $config: { baseURL: '' },
    $axios: {
      post: async (url, body) => {
        payload = body
        return { status: 200 }
      },
    },
    $store: { dispatch() {} },
  })
  assert.equal(payload.employeeCode, 'EMP')
  assert.deepEqual(Object.keys(payload), ['employeeCode'])
  const page = fs.readFileSync(
    path.join(root, 'pages/code-of-conduct/coc-form/index.vue'),
    'utf8'
  )
  assert.match(page, /fetchCoCVersions',\s*true/)
  assert.doesNotMatch(page, /employeeID: this.formData/)
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, 'store/coc/index.js'), 'utf8'),
    /append\('admin/
  )
})

test('controlled errors and network failures are translated in English and Arabic, including state conflicts', () => {
  const { securityMessage } = require('../../utils/security-error')
  for (const language of ['en', 'ar']) {
    const locale = JSON.parse(
      fs.readFileSync(path.join(root, `locales/${language}.json`), 'utf8')
    )
    const translate = (key) =>
      key.split('.').reduce((value, field) => value[field], locale)
    for (const code of [
      'invalidRequest',
      'forbidden',
      'stateConflict',
      'serviceUnavailable',
      'notFound',
      'authFailed',
    ])
      assert.equal(
        securityMessage({ response: { data: { message: code } } }, translate),
        locale.security[code]
      )
    assert.equal(
      securityMessage(new Error('network'), translate),
      locale.security.serviceUnavailable
    )
  }
})

test('CoC approval/decline conflicts clear loading states and refresh the affected view', async () => {
  const page = load('pages/code-of-conduct/employees-list/index.vue')
  for (const [method, flag] of [
    ['approveSignature', 'approving'],
    ['rejectSignature', 'rejecting'],
  ]) {
    let refreshed = 0
    let payload
    const context = {
      pdfDialog: true,
      selectedSignaturePath: 'submitted.pdf',
      $config: { baseURL: '' },
      $t: (key) => key,
      $axios: {
        post: async (url, body) => {
          payload = body
          throw Object.assign(new Error('conflict'), {
            response: { status: 409, data: { message: 'stateConflict' } },
          })
        },
      },
      $store: { dispatch() {} },
      syncEmployees: async () => {
        refreshed++
      },
    }
    await page.methods[method].call(context, 1)
    assert.equal(context[flag], false)
    assert.equal(context.pdfDialog, false)
    assert.equal(refreshed, 1)
    assert.deepEqual(Object.keys(payload), ['signatureId', 'expectedFilePath'])
  }
  const selected = {}
  page.methods.openSignatureDialog.call(
    selected,
    { signature_id: 2, signed_document_path: 'second.pdf' },
    'approve'
  )
  assert.equal(selected.selectedSignatureId, 2)
  assert.equal(selected.selectedSignaturePath, 'second.pdf')
  assert.equal(selected.acceptDialog, true)
  assert.equal(selected.rejectDialog, false)
  const source = fs.readFileSync(
    path.join(root, 'pages/code-of-conduct/employees-list/index.vue'),
    'utf8'
  )
  assert.match(
    source,
    /acceptDialog\s*&&\s*selectedSignatureId === employee.signature_id/
  )
  assert.match(
    source,
    /rejectDialog\s*&&\s*selectedSignatureId === employee.signature_id/
  )
})

test('Windows stored-file aliases and non-scalar IDs are rejected before file or decision effects', async (t) => {
  const f = await fixture(t)
  for (const profilePic of [
    '.. ',
    'CON.png',
    'private.png.',
    'C:private.png',
  ]) {
    f.state.card.profilePic = profilePic
    assert.equal(
      (
        await f.request('/business-cards-api/vcard/?employeeID=EMP', {
          as: null,
        })
      ).status,
      503
    )
  }
  assert.deepEqual(f.files, [])
  for (const signatureId of [[1], { id: 1 }])
    assert.equal(
      (
        await f.request('/coc-api/approve-signature', {
          method: 'POST',
          body: { signatureId },
        })
      ).status,
      400
    )
  assert.deepEqual(f.state.history, [])
})

test('compiled CoC confirmation templates show only the selected employee in English and Arabic', async () => {
  const Vue = require('vue')
  const compiler = require('vue-template-compiler')
  const source = fs.readFileSync(
    path.join(root, 'pages/code-of-conduct/employees-list/index.vue'),
    'utf8'
  )
  const dialogs = source
    .match(/<v-dialog[\s\S]*?<\/v-dialog>/g)
    .filter((dialog) => dialog.includes('selectedSignatureId'))
  assert.equal(dialogs.length, 2)
  const render = compiler.compileToFunctions(
    `<div><div v-for="employee in employeesData" :key="employee.employee_id">${dialogs.join(
      ''
    )}</div></div>`
  )
  const page = load('pages/code-of-conduct/employees-list/index.vue')
  for (const locale of ['en', 'ar']) {
    const messages = JSON.parse(
      fs.readFileSync(path.join(root, `locales/${locale}.json`), 'utf8')
    )
    for (const action of ['approve', 'reject']) {
      const data = {
        ...page.data(),
        employeesData: [
          {
            employee_id: 'ONE',
            name_eng: 'First Employee',
            signature_id: 1,
            signed_document_path: 'first.pdf',
          },
          {
            employee_id: 'TWO',
            name_eng: 'الموظف الثاني',
            signature_id: 2,
            signed_document_path: 'second.pdf',
          },
        ],
      }
      page.methods.openSignatureDialog.call(data, data.employeesData[1], action)
      const instance = new Vue({
        ...render,
        components: {
          VDialog: {
            props: ['value'],
            render(h) {
              return this.value ? h('section', this.$slots.default) : h('span')
            },
          },
        },
        data: () => data,
        beforeCreate() {
          this.$vuetify = { theme: { dark: false } }
        },
        methods: {
          ...page.methods,
          $t: (key) => key.split('.').reduce((v, k) => v[k], messages),
        },
      })
      const html = await require('vue-server-renderer')
        .createRenderer()
        .renderToString(instance)
      assert.match(html, /الموظف الثاني/)
      assert.doesNotMatch(html, /First Employee/)
      assert.equal((html.match(/<section/g) || []).length, 1)
    }
  }
})
