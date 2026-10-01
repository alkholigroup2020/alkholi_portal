const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const express = require('express')
const babel = require('@babel/core')
const compiler = require('vue-template-compiler')
const createApi = require('../../server/businessCards/createApi')
const {
  createPublicCards,
} = require('../../server/businessCards/services/publicCards')
const {
  createCardManagement,
  validateCard,
  validateCardId,
  COMPANIES,
  LIST_FIELDS,
  EDITABLE_FIELDS,
  LOG_FIELDS,
  LIST_CARDS_QUERY,
  EDITABLE_CARD_QUERY,
  ACTIVITY_LOGS_QUERY,
  CARD_EXISTS_QUERY,
  SAVE_CARD_QUERY,
  DELETE_CARD_QUERY,
} = require('../../server/businessCards/services/cardManagement')
const {
  createQrRenderer,
} = require('../../server/businessCards/services/qrCode')
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
const ADMIN_NAME = 'Card Administrator'
const ROLE_QUERY = ROLE_QUERIES.get('businessCardsAdmin')
const PNG = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  Buffer.from('png-body'),
])
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from('jpeg-body'),
])

function cardRow(employeeID, extra = {}) {
  return {
    employeeID,
    mailAddress: `${employeeID.toLowerCase()}@example.invalid`,
    company: 'Alkholi Group',
    fullName_a: 'اسم تجريبي',
    fullName_e: `Person ${employeeID}`,
    arabicTitle: 'مسمى تجريبي',
    title: 'Engineer',
    mobileNumber: '+966500000000',
    landLines: 'undefined',
    faxLine: 'undefined',
    webSite: 'https://example.invalid',
    profilePic: `${employeeID}_pic.jpg`,
    companyLogo: 'undefined',
    qrCodePath: `${employeeID}_QR_300px.png`,
    mainColor: '#07074eFF',
    ...extra,
  }
}

function validFields(extra = {}) {
  return {
    employeeID: '00123',
    employeeCompany: 'Alkholi Group',
    employeeMailAddress: 'person@example.invalid',
    employeeArabicName: 'اسم تجريبي',
    employeeEnglishName: 'Example Person',
    employeeArabicTitle: 'مسمى تجريبي',
    employeeEnglishTitle: 'Engineer',
    employeeMobileNumber: '+966500000000',
    employeeWebSite: 'https://example.invalid',
    ...extra,
  }
}

// Mocked mssql plus a real temporary upload directory. No .env, no app entry.
function fixture(t) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bcards-test-'))
  const uploadDirectory = path.join(temporaryRoot, 'uploads', 'businessCards')
  fs.mkdirSync(uploadDirectory, { recursive: true })
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }))

  const calls = []
  const pools = []
  const state = {
    failAt: null,
    cards: new Map(),
    logs: [],
    admins: new Map([[ADMIN, ADMIN_NAME]]),
    extraRecordset: false,
    conflicts: 0,
    fileFailure: null,
    qrFailure: false,
    randomValues: [],
  }

  function status(row) {
    return state.extraRecordset
      ? {
          recordset: [{ procedure: 1 }],
          recordsets: [[{ procedure: 1 }], [row]],
        }
      : { recordset: [row], recordsets: [[row]] }
  }

  function logChange(v, adminName, theAction, name) {
    state.logs.push({
      ID: state.logs.length + 1,
      theDate: v.logDate,
      theTime: v.logTime,
      Admin_Name: adminName,
      theAction,
      BCard_ID: v.employeeID,
      BCard_Name: name,
      privateColumn: 'private',
    })
  }

  function run(statement, v) {
    if (statement === ROLE_QUERY)
      return { recordset: [{ hasRole: state.admins.has(v.employeeCode) }] }
    if (statement === LIST_CARDS_QUERY)
      return {
        recordset: [...state.cards.values()]
          .sort((a, b) => (a.employeeID < b.employeeID ? -1 : 1))
          .map((row) => ({ ...row, privateColumn: 'private' })),
      }
    if (statement === EDITABLE_CARD_QUERY) {
      const row = state.cards.get(v.employeeID)
      return { recordset: row ? [{ ...row, privateColumn: 'private' }] : [] }
    }
    if (statement === ACTIVITY_LOGS_QUERY)
      return { recordset: [...state.logs].reverse() }
    if (statement === CARD_EXISTS_QUERY)
      return { recordset: [{ cardExists: state.cards.has(v.employeeID) }] }
    if (statement === SAVE_CARD_QUERY) {
      const adminName = state.admins.get(v.actorCode)
      if (adminName === undefined) return status({ outcome: 'forbidden' })
      const old = state.cards.get(v.employeeID)
      if (v.requireNew && (old || state.conflicts-- > 0))
        return status({ outcome: 'conflict' })
      if (state.failAt === 'procedure')
        throw new Error('private procedure detail')
      const first = (...values) => values.find((value) => value != null)
      state.cards.set(v.employeeID, {
        employeeID: v.employeeID,
        mailAddress: v.mailAddress,
        company: v.company,
        fullName_a: v.fullName_a,
        fullName_e: v.fullName_e,
        arabicTitle: v.arabicTitle,
        title: v.title,
        mobileNumber: v.mobileNumber,
        landLines: v.landLines,
        faxLine: v.faxLine,
        webSite: v.webSite,
        profilePic: first(
          v.newProfilePic,
          old && old.profilePic,
          'profile.png'
        ),
        companyLogo: first(
          v.newCompanyLogo,
          old && old.companyLogo,
          'undefined'
        ),
        qrCodePath: v.qrCodePath,
        mainColor: first(v.mainColor, old && old.mainColor, 'undefined'),
      })
      const action = old ? 'Update' : 'Creation'
      logChange(v, adminName, action, v.fullName_e)
      return status({
        outcome: 'saved',
        action,
        oldProfilePic: old ? old.profilePic : null,
        oldCompanyLogo: old ? old.companyLogo : null,
        oldQrCodePath: old ? old.qrCodePath : null,
      })
    }
    if (statement === DELETE_CARD_QUERY) {
      const adminName = state.admins.get(v.actorCode)
      if (adminName === undefined) return status({ outcome: 'forbidden' })
      const old = state.cards.get(v.employeeID)
      if (!old) return status({ outcome: 'notFound' })
      if (state.failAt === 'procedure')
        throw new Error('private procedure detail')
      state.cards.delete(v.employeeID)
      logChange(v, adminName, 'Deletion', old.fullName_e)
      return status({ outcome: 'deleted', oldQrCodePath: old.qrCodePath })
    }
    // Public cards and vCards share the bound lookup.
    const publicId = v.employeeCode
    const row = state.cards.get(publicId)
    return { recordset: row ? [row] : [] }
  }

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
      if (state.failAt === 'close') throw new Error('private cleanup')
    }

    request() {
      const inputs = {}
      return {
        input(name, type, value) {
          inputs[name] = { type, value }
          return this
        },
        // eslint-disable-next-line require-await
        async query(statement) {
          calls.push({ statement, inputs })
          if (state.failAt === 'query' || state.failAt === statement)
            throw new Error('private SQL detail: dbo.secret_table')
          return run(
            statement,
            Object.fromEntries(
              Object.entries(inputs).map(([name, input]) => [name, input.value])
            )
          )
        },
      }
    }
  }

  const sql = {
    ConnectionPool,
    connect: async () => {},
    VarChar: (length) => ({ name: 'varchar', length }),
    NVarChar: (length) => ({ name: 'nvarchar', length }),
    Bit: { name: 'bit' },
  }

  // Real files in the temporary directory, with injectable failures.
  const fileSystem = {
    async writeFile(file, data) {
      if (state.fileFailure === 'write') throw new Error('private disk detail')
      await fs.promises.writeFile(file, data)
    },
    readFile: (file) => fs.promises.readFile(file),
    async unlink(file) {
      if (state.fileFailure === 'unlink') {
        const error = new Error('private lock detail')
        error.code = 'EBUSY'
        throw error
      }
      await fs.promises.unlink(file)
    },
  }

  const qrCalls = []
  // eslint-disable-next-line require-await
  const renderQr = async (options) => {
    qrCalls.push(options)
    if (state.qrFailure) throw new Error('private canvas detail')
    return Buffer.from(
      `QR|${options.text}|${options.size}|${options.foreground}|${
        options.background
      }|${options.logo ? 'logo' : 'plain'}`
    )
  }

  const portalConfig = { name: 'portal' }
  const cardManagement = createCardManagement({
    sql,
    portalConfig,
    fileSystem,
    uploadDirectory,
    renderQr,
    publicCardUrl: (id) => `https://cards.invalid/business-card/${id}`,
    now: () => new Date(2026, 8, 30, 9, 5, 7),
    random: () =>
      state.randomValues.length ? state.randomValues.shift() : Math.random(),
  })

  const files = () => fs.readdirSync(uploadDirectory).sort()
  const putFile = (name, content = 'old') =>
    fs.writeFileSync(path.join(uploadDirectory, name), content)
  const readFile = (name) =>
    fs.readFileSync(path.join(uploadDirectory, name), 'utf8')
  const statements = (statement) =>
    calls.filter((call) => call.statement === statement)

  return {
    temporaryRoot,
    uploadDirectory,
    calls,
    pools,
    state,
    sql,
    portalConfig,
    cardManagement,
    qrCalls,
    files,
    putFile,
    readFile,
    statements,
  }
}

const png = (name = 'image.png') => ({
  buffer: PNG,
  mimetype: 'image/png',
  originalname: name,
})
const jpeg = (name = 'image.jpg') => ({
  buffer: JPEG,
  mimetype: 'image/jpeg',
  originalname: name,
})

test('management statements are fixed, explicit and transactional', () => {
  for (const statement of [
    LIST_CARDS_QUERY,
    EDITABLE_CARD_QUERY,
    ACTIVITY_LOGS_QUERY,
    CARD_EXISTS_QUERY,
    SAVE_CARD_QUERY,
    DELETE_CARD_QUERY,
  ]) {
    assert.doesNotMatch(statement, /SELECT\s+\*/i)
    assert.doesNotMatch(statement, /\$\{/)
  }
  assert.match(LIST_CARDS_QUERY, /ORDER BY employeeID$/)
  assert.match(ACTIVITY_LOGS_QUERY, /ORDER BY ID DESC$/)
  assert.match(EDITABLE_CARD_QUERY, /WHERE employeeID = @employeeID$/)
  for (const statement of [SAVE_CARD_QUERY, DELETE_CARD_QUERY]) {
    assert.match(statement, /SET XACT_ABORT ON/)
    assert.match(statement, /BEGIN TRANSACTION/)
    assert.match(statement, /WITH \(UPDLOCK, HOLDLOCK\)/)
    assert.match(statement, /IF XACT_STATE\(\) <> 0 ROLLBACK TRANSACTION/)
    // The audit actor is the caller's own administrator row.
    assert.match(
      statement,
      /FROM dbo\.business_card_admins WHERE employeeID = @actorCode/
    )
    assert.match(
      statement,
      /EXEC businessCards\.logging @date = @logDate, @time = @logTime,\s+@adminName = @adminName/
    )
    assert.doesNotMatch(statement, /admin_members/)
  }
  assert.match(SAVE_CARD_QUERY, /EXEC businessCards\.employeeData_addData @/)
  assert.match(SAVE_CARD_QUERY, /EXEC businessCards\.employeeData_updateData @/)
  assert.match(
    DELETE_CARD_QUERY,
    /EXEC businessCards\.employeeData_deleteData @cardID = @employeeID/
  )
  assert.equal(COMPANIES.length, 9)
  assert.ok(Object.isFrozen(COMPANIES))
})

test('list, single-card and log reads bind typed inputs and project consumed fields', async (t) => {
  const f = fixture(t)
  for (const id of ['B2', 'A1', 'X12345']) f.state.cards.set(id, cardRow(id))
  f.state.logs.push(
    {
      ID: 1,
      theDate: '2026-09-29',
      theTime: '08:00:00',
      Admin_Name: ADMIN_NAME,
      theAction: 'Creation',
      BCard_ID: 'A1',
      BCard_Name: 'Person A1',
      privateColumn: 'private',
    },
    {
      ID: 2,
      theDate: '2026-09-30',
      theTime: '09:00:00',
      Admin_Name: ADMIN_NAME,
      theAction: 'Update',
      BCard_ID: 'A1',
      BCard_Name: 'Person A1',
      privateColumn: 'private',
    }
  )

  const list = await f.cardManagement.listCards()
  assert.deepEqual(
    list.map((row) => row.employeeID),
    ['A1', 'B2', 'X12345']
  )
  for (const row of list) assert.deepEqual(Object.keys(row), [...LIST_FIELDS])
  assert.deepEqual(f.calls.at(-1).inputs, {})

  const card = await f.cardManagement.getCard('X12345')
  assert.deepEqual(Object.keys(card), [...EDITABLE_FIELDS])
  assert.equal(card.fullName_a, 'اسم تجريبي')
  assert.deepEqual(f.calls.at(-1).inputs, {
    employeeID: { type: { name: 'varchar', length: 20 }, value: 'X12345' },
  })

  const logs = await f.cardManagement.listActivityLogs()
  assert.deepEqual(
    logs.map((log) => log.ID),
    [2, 1]
  )
  for (const log of logs) assert.deepEqual(Object.keys(log), [...LOG_FIELDS])

  await assert.rejects(f.cardManagement.getCard('NONE'), {
    message: 'cardNotFound',
    statusCode: 404,
  })
  assert.ok(f.pools.every((pool) => pool.closed))

  // Every field the management pages read must be in a projection.
  const pageFields = (file, variable) =>
    [
      ...fs
        .readFileSync(path.join(root, file), 'utf8')
        .matchAll(new RegExp(`\\b${variable}\\.([A-Za-z_]+)`, 'g')),
    ].map((match) => match[1])
  for (const field of pageFields(
    'pages/business-cards/generated-cards/index.vue',
    '(?:member|singleCard)'
  ))
    assert.ok(LIST_FIELDS.includes(field), field)
  for (const field of pageFields(
    'pages/business-cards/activity-logs/index.vue',
    'log'
  ))
    assert.ok(LOG_FIELDS.includes(field), field)
  for (const field of pageFields(
    'pages/business-cards/card-generator/index.vue',
    'card'
  ))
    assert.ok(EDITABLE_FIELDS.includes(field), field)
})

test('invalid and injection-like card IDs are rejected before any database or file work', async (t) => {
  const f = fixture(t)
  for (const id of ['00123', 'X12345', 'Ab_-09', '1'.repeat(10)])
    assert.equal(validateCardId(id), id)
  for (const id of [
    undefined,
    null,
    123,
    {},
    ['00123'],
    '',
    '1'.repeat(11),
    "1' OR '1'='1",
    "';DROP TABLE x;--",
    '../00123',
    '1/2',
    ' 00123',
    '00123 ',
    '00123\n',
    '١٢٣',
  ]) {
    await assert.rejects(f.cardManagement.getCard(id), {
      message: 'invalidEmployeeCode',
      statusCode: 400,
    })
    await assert.rejects(
      f.cardManagement.deleteCard({ actorCode: ADMIN, employeeCode: id }),
      { message: 'invalidEmployeeCode', statusCode: 400 }
    )
    if (id !== undefined && id !== '')
      await assert.rejects(
        f.cardManagement.saveCard({
          actorCode: ADMIN,
          fields: validFields({ employeeID: id }),
          files: { employeePicture: png() },
        }),
        { message: 'invalidEmployeeCode', statusCode: 400 }
      )
  }
  assert.equal(f.pools.length, 0)
  assert.equal(f.calls.length, 0)
  assert.equal(f.qrCalls.length, 0)
  assert.deepEqual(f.files(), [])
})

test('card fields are validated against column sizes and never truncated', () => {
  const ok = validateCard(validFields())
  assert.equal(ok.qrSize, 300)
  assert.equal(ok.landLines, 'undefined')
  assert.equal(ok.faxLine, 'undefined')
  assert.equal(ok.mainColor, null)
  assert.equal(ok.qrForeground, '#07074eFF')
  assert.equal(ok.qrBackground, '#FFFFFFFF')
  assert.equal(
    validateCard(validFields({ employeeID: 'x12345' })).employeeID,
    'X12345'
  )
  for (const id of [undefined, '', 'undefined'])
    assert.equal(validateCard(validFields({ employeeID: id })).employeeID, null)
  // Existing sentinel behaviour for optional values.
  const custom = validateCard({
    employeeCompany: 'Custom',
    qrSize: 'undefined',
  })
  assert.equal(custom.fullName_e, 'undefined')
  assert.equal(custom.qrSize, 300)
  assert.equal(
    validateCard(validFields({ employeeLandLines: '', faxLine: '' })).landLines,
    'undefined'
  )
  for (const company of COMPANIES)
    assert.equal(
      validateCard(validFields({ employeeCompany: company })).company,
      company
    )
  for (const fields of [
    null,
    'text',
    validFields({ employeeCompany: 'Unknown Company' }),
    validFields({ employeeCompany: undefined }),
    validFields({ employeeEnglishName: 'a'.repeat(101) }),
    validFields({ employeeArabicName: 'ا'.repeat(101) }),
    validFields({ employeeArabicTitle: 'ا'.repeat(101) }),
    validFields({ employeeEnglishTitle: 'a'.repeat(101) }),
    validFields({ employeeMobileNumber: '1'.repeat(21) }),
    validFields({ employeeLandLines: '1'.repeat(151) }),
    validFields({ faxLine: '1'.repeat(151) }),
    validFields({ employeeMailAddress: 'a'.repeat(51) }),
    validFields({ employeeWebSite: 'a'.repeat(51) }),
    validFields({ employeeEnglishName: ['a', 'b'] }),
    validFields({ employeeEnglishName: 'line\nbreak' }),
    validFields({ employeeEnglishName: 'nul\0' }),
    validFields({ mainColor: 'red; background: url(x)' }),
    validFields({ frColor: '#12' }),
    validFields({ bgColor: "#FFF' --" }),
    validFields({ qrSize: '99' }),
    validFields({ qrSize: '2001' }),
    validFields({ qrSize: '300px' }),
    validFields({ qrSize: '1e3' }),
    validFields({ qrSize: '-300' }),
  ])
    assert.throws(() => validateCard(fields), {
      message: 'invalidCardData',
      statusCode: 400,
    })
  assert.equal(validateCard(validFields({ qrSize: '2000' })).qrSize, 2000)
  assert.equal(
    validateCard(validFields({ mainColor: '#abc', bgColor: '#FFF' })).mainColor,
    '#abc'
  )
})

test('creating a card binds every value as typed data and audits the session administrator', async (t) => {
  const f = fixture(t)
  const hostile = "O'Brien'); DROP TABLE businessCards.logs;--"
  const result = await f.cardManagement.saveCard({
    actorCode: ADMIN,
    fields: validFields({
      employeeEnglishName: hostile,
      employeeArabicName: "عبد الله 'اختبار'",
      employeeLandLines: '(11) 0000000',
      mainColor: '#112233FF',
      qrSize: '500',
      // Ignored audit/identity fields from a tampered client.
      creator: 'Spoofed Creator',
      adminName: 'Spoofed Admin',
      adminID: USER,
      actorCode: USER,
    }),
    files: { employeePicture: jpeg(), companyLogo: png(), qrLogo: png() },
  })
  assert.deepEqual(result, {
    employeeID: '00123',
    action: 'Creation',
    cleanupPending: false,
  })

  const save = f.statements(SAVE_CARD_QUERY)
  assert.equal(save.length, 1)
  assert.ok(!save[0].statement.includes('Brien'))
  const inputs = save[0].inputs
  const stored = f.state.cards.get('00123')
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(inputs).map(([name, input]) => [name, input.type])
    ),
    {
      employeeID: { name: 'varchar', length: 20 },
      actorCode: { name: 'varchar', length: 20 },
      logDate: { name: 'varchar', length: 10 },
      logTime: { name: 'varchar', length: 8 },
      requireNew: { name: 'bit' },
      newProfilePic: { name: 'nvarchar', length: 100 },
      newCompanyLogo: { name: 'nvarchar', length: 100 },
      fullName_a: { name: 'nvarchar', length: 100 },
      fullName_e: { name: 'varchar', length: 100 },
      arabicTitle: { name: 'nvarchar', length: 100 },
      title: { name: 'varchar', length: 100 },
      mobileNumber: { name: 'varchar', length: 20 },
      landLines: { name: 'varchar', length: 150 },
      mailAddress: { name: 'varchar', length: 50 },
      webSite: { name: 'varchar', length: 50 },
      qrCodePath: { name: 'varchar', length: 25 },
      company: { name: 'varchar', length: 100 },
      faxLine: { name: 'varchar', length: 150 },
      mainColor: { name: 'varchar', length: 10 },
    }
  )
  assert.equal(inputs.actorCode.value, ADMIN)
  assert.equal(inputs.requireNew.value, false)
  assert.equal(inputs.logDate.value, '2026-09-30')
  assert.equal(inputs.logTime.value, '09:05:07')
  assert.equal(stored.fullName_e, hostile)
  assert.equal(stored.fullName_a, "عبد الله 'اختبار'")
  assert.equal(stored.landLines, '(11) 0000000')
  assert.equal(stored.faxLine, 'undefined')
  assert.equal(stored.mainColor, '#112233FF')
  assert.equal(stored.qrCodePath, '00123_QR_500px.png')
  assert.match(stored.profilePic, /^00123_[0-9a-f-]{36}\.jpg$/)
  assert.match(stored.companyLogo, /^00123_[0-9a-f-]{36}\.png$/)

  // Artifacts: picture, logo and QR only; the inner QR logo is never stored.
  assert.deepEqual(
    f.files(),
    [stored.profilePic, stored.companyLogo, stored.qrCodePath].sort()
  )
  assert.equal(
    f.readFile('00123_QR_500px.png'),
    'QR|https://cards.invalid/business-card/00123|500|#07074eFF|#FFFFFFFF|logo'
  )
  assert.deepEqual(
    f.state.logs.map((log) => [
      log.theDate,
      log.theTime,
      log.Admin_Name,
      log.theAction,
      log.BCard_ID,
      log.BCard_Name,
    ]),
    [['2026-09-30', '09:05:07', ADMIN_NAME, 'Creation', '00123', hostile]]
  )
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('editing keeps or replaces artifacts and only removes unshared card files', async (t) => {
  const f = fixture(t)
  f.state.cards.set(
    '00123',
    cardRow('00123', { companyLogo: '00123_logo.png', mainColor: '#ABCDEF' })
  )
  for (const name of ['00123_pic.jpg', '00123_logo.png', '00123_QR_300px.png'])
    f.putFile(name)
  f.putFile('profile.png', 'shared')

  // No uploads: stored picture, logo and color are kept; same-size QR rewritten.
  f.state.extraRecordset = true
  let result = await f.cardManagement.saveCard({
    actorCode: ADMIN,
    fields: validFields({ employeeEnglishName: 'Renamed Person' }),
    files: {},
  })
  assert.deepEqual(result, {
    employeeID: '00123',
    action: 'Update',
    cleanupPending: false,
  })
  let stored = f.state.cards.get('00123')
  assert.equal(stored.profilePic, '00123_pic.jpg')
  assert.equal(stored.companyLogo, '00123_logo.png')
  assert.equal(stored.mainColor, '#ABCDEF')
  assert.equal(stored.fullName_e, 'Renamed Person')
  assert.deepEqual(f.files(), [
    '00123_QR_300px.png',
    '00123_logo.png',
    '00123_pic.jpg',
    'profile.png',
  ])
  assert.match(f.readFile('00123_QR_300px.png'), /^QR\|/)
  assert.equal(
    f.statements(SAVE_CARD_QUERY)[0].inputs.newProfilePic.value,
    null
  )

  // New picture, logo and QR size: the replaced files are removed afterwards.
  result = await f.cardManagement.saveCard({
    actorCode: ADMIN,
    fields: validFields({ qrSize: '800' }),
    files: { employeePicture: png(), companyLogo: jpeg() },
  })
  assert.equal(result.cleanupPending, false)
  stored = f.state.cards.get('00123')
  assert.deepEqual(
    f.files(),
    [
      stored.profilePic,
      stored.companyLogo,
      '00123_QR_800px.png',
      'profile.png',
    ].sort()
  )
  assert.deepEqual(
    f.state.logs.map((log) => log.theAction),
    ['Update', 'Update']
  )

  // Placeholders, shared defaults, traversal-like names and missing files.
  f.putFile('victim.png')
  for (const [profilePic, companyLogo, qrCodePath] of [
    ['profile.png', 'undefined', 'missing_QR_300px.png'],
    ['../victim.png', '..\\victim.png', '/etc/passwd'],
    [null, 'null', ''],
    ['sub/victim.png', 'C:\\victim.png', '.'],
  ]) {
    f.state.cards.set('00999', {
      ...cardRow('00999'),
      profilePic,
      companyLogo,
      qrCodePath,
    })
    const saved = await f.cardManagement.saveCard({
      actorCode: ADMIN,
      fields: validFields({ employeeID: '00999' }),
      files: { employeePicture: png(), companyLogo: png() },
    })
    assert.equal(saved.cleanupPending, false)
  }
  assert.ok(f.files().includes('profile.png'))
  assert.ok(f.files().includes('victim.png'))
  assert.ok(fs.existsSync(f.temporaryRoot))

  // A locked old file is reported, never treated as a failed save.
  f.state.fileFailure = 'unlink'
  const locked = await f.cardManagement.saveCard({
    actorCode: ADMIN,
    fields: validFields({ qrSize: '400' }),
    files: {},
  })
  assert.deepEqual(locked, {
    employeeID: '00123',
    action: 'Update',
    cleanupPending: true,
  })
})

test('generated IDs are checked with a bound parameter and retried on conflict', async (t) => {
  const f = fixture(t)
  f.state.cards.set('X10001', cardRow('X10001'))
  // First candidate is taken, second is free but loses the race once.
  f.state.randomValues = [0, 0.5, 0.75]
  f.state.conflicts = 1
  const result = await f.cardManagement.saveCard({
    actorCode: ADMIN,
    fields: validFields({ employeeID: 'undefined', employeeCompany: 'Custom' }),
    files: { employeePicture: png() },
  })
  assert.match(result.employeeID, /^X[0-9]{5}$/)
  assert.equal(result.action, 'Creation')
  const checks = f.statements(CARD_EXISTS_QUERY)
  assert.deepEqual(
    checks.map((call) => call.inputs.employeeID.value),
    ['X10001', 'X55000', 'X77499']
  )
  const saves = f.statements(SAVE_CARD_QUERY)
  assert.deepEqual(
    saves.map((call) => [
      call.inputs.employeeID.value,
      call.inputs.requireNew.value,
    ]),
    [
      ['X55000', true],
      ['X77499', true],
    ]
  )
  // The abandoned attempt left no files behind and the old card is untouched.
  assert.ok(f.files().every((name) => name.startsWith('X77499_')))
  assert.equal(f.files().length, 2)
  assert.equal(f.state.cards.get('X10001').fullName_e, 'Person X10001')
  assert.equal(f.state.cards.size, 2)

  // Exhaustion is a controlled failure, not an endless loop.
  const exhausted = fixture(t)
  exhausted.state.conflicts = Infinity
  await assert.rejects(
    exhausted.cardManagement.saveCard({
      actorCode: ADMIN,
      fields: validFields({ employeeID: '' }),
      files: {},
    }),
    { message: 'serviceUnavailable', statusCode: 503 }
  )
  assert.deepEqual(exhausted.files(), [])
  assert.equal(exhausted.state.cards.size, 0)
})

test('failed saves leave no new files, restore the QR and never report success', async (t) => {
  const f = fixture(t)
  f.state.cards.set('00123', cardRow('00123'))
  f.putFile('00123_pic.jpg', 'old picture')
  f.putFile('00123_QR_300px.png', 'old qr')
  const before = () =>
    assert.deepEqual(
      [
        f.files(),
        f.readFile('00123_QR_300px.png'),
        f.readFile('00123_pic.jpg'),
      ],
      [['00123_QR_300px.png', '00123_pic.jpg'], 'old qr', 'old picture']
    )
  const save = (files = { employeePicture: png(), companyLogo: png() }) =>
    f.cardManagement.saveCard({
      actorCode: ADMIN,
      fields: validFields(),
      files,
    })

  for (const failAt of ['connect', 'query', 'procedure']) {
    f.state.failAt = failAt
    await assert.rejects(save(), (error) => {
      assert.notEqual(error.statusCode, 200)
      return true
    })
    before()
  }
  f.state.failAt = null
  assert.equal(f.state.logs.length, 0)
  assert.equal(f.state.cards.get('00123').fullName_e, 'Person 00123')

  // Disk failure: nothing reaches the database.
  f.state.fileFailure = 'write'
  const callsBefore = f.calls.length
  await assert.rejects(save())
  assert.equal(f.calls.length, callsBefore)
  f.state.fileFailure = null
  before()

  // QR failure: a broken inner logo is the caller's input, otherwise ours.
  f.state.qrFailure = true
  await assert.rejects(save({ qrLogo: png() }), {
    message: 'invalidUpload',
    statusCode: 400,
  })
  await assert.rejects(save({}), {
    message: 'serviceUnavailable',
    statusCode: 503,
  })
  f.state.qrFailure = false
  assert.equal(f.calls.length, callsBefore)
  before()

  // Content that does not match its declared image type.
  for (const file of [
    { buffer: Buffer.from('<script>'), mimetype: 'image/png' },
    { buffer: JPEG, mimetype: 'image/png' },
    { buffer: PNG, mimetype: 'image/jpeg' },
    { buffer: PNG, mimetype: 'image/svg+xml' },
    { buffer: Buffer.alloc(0), mimetype: 'image/jpeg' },
    { mimetype: 'image/png' },
  ])
    for (const field of ['employeePicture', 'companyLogo', 'qrLogo'])
      await assert.rejects(save({ [field]: file }), {
        message: 'invalidUpload',
        statusCode: 400,
      })
  assert.equal(f.calls.length, callsBefore)
  before()

  // Membership revoked between the route guard and the write.
  f.state.admins.delete(ADMIN)
  await assert.rejects(save(), { message: 'forbidden', statusCode: 403 })
  before()
  assert.equal(f.state.logs.length, 0)
  await assert.rejects(
    f.cardManagement.saveCard({
      actorCode: undefined,
      fields: validFields(),
      files: {},
    }),
    { message: 'authFailed', statusCode: 401 }
  )
  before()
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('deleting uses the stored record, tolerates missing files and reports failures', async (t) => {
  const f = fixture(t)
  f.state.cards.set('00123', cardRow('00123', { fullName_e: "Stored O'Name" }))
  for (const name of [
    '00123_pic.jpg',
    '00123_QR_300px.png',
    'other_QR_300px.png',
  ])
    f.putFile(name)

  assert.deepEqual(
    await f.cardManagement.deleteCard({
      actorCode: ADMIN,
      employeeCode: '00123',
    }),
    { message: 'successfullyDeleted', cleanupPending: false }
  )
  const call = f.statements(DELETE_CARD_QUERY)[0]
  assert.deepEqual(Object.keys(call.inputs).sort(), [
    'actorCode',
    'employeeID',
    'logDate',
    'logTime',
  ])
  assert.equal(call.inputs.actorCode.value, ADMIN)
  assert.deepEqual(call.inputs.employeeID, {
    type: { name: 'varchar', length: 20 },
    value: '00123',
  })
  // Only this card's QR artifact is removed (the existing behaviour).
  assert.deepEqual(f.files(), ['00123_pic.jpg', 'other_QR_300px.png'])
  assert.deepEqual(
    f.state.logs.map((log) => [log.Admin_Name, log.theAction, log.BCard_Name]),
    [[ADMIN_NAME, 'Deletion', "Stored O'Name"]]
  )

  // Already deleted: controlled 404, no second audit row.
  await assert.rejects(
    f.cardManagement.deleteCard({ actorCode: ADMIN, employeeCode: '00123' }),
    { message: 'cardNotFound', statusCode: 404 }
  )
  assert.equal(f.state.logs.length, 1)

  // Missing QR file is harmless; a traversal-like stored name is never removed.
  f.state.cards.set('00124', cardRow('00124'))
  f.state.cards.set(
    '00125',
    cardRow('00125', { qrCodePath: '../other_QR_300px.png' })
  )
  for (const id of ['00124', '00125'])
    assert.equal(
      (
        await f.cardManagement.deleteCard({
          actorCode: ADMIN,
          employeeCode: id,
        })
      ).cleanupPending,
      false
    )
  assert.deepEqual(f.files(), ['00123_pic.jpg', 'other_QR_300px.png'])

  // A locked file is reported as pending cleanup after the committed delete.
  f.state.cards.set('00126', cardRow('00126'))
  f.putFile('00126_QR_300px.png')
  f.state.fileFailure = 'unlink'
  assert.deepEqual(
    await f.cardManagement.deleteCard({
      actorCode: ADMIN,
      employeeCode: '00126',
    }),
    { message: 'successfullyDeleted', cleanupPending: true }
  )
  f.state.fileFailure = null

  // Database failures keep the card and its file.
  f.state.cards.set('00127', cardRow('00127'))
  f.putFile('00127_QR_300px.png')
  for (const failAt of ['connect', 'query', 'procedure']) {
    f.state.failAt = failAt
    await assert.rejects(
      f.cardManagement.deleteCard({ actorCode: ADMIN, employeeCode: '00127' })
    )
    assert.ok(f.state.cards.has('00127'))
    assert.ok(f.files().includes('00127_QR_300px.png'))
  }
  f.state.failAt = null
  f.state.admins.delete(ADMIN)
  await assert.rejects(
    f.cardManagement.deleteCard({ actorCode: ADMIN, employeeCode: '00127' }),
    { message: 'forbidden', statusCode: 403 }
  )
  assert.ok(f.state.cards.has('00127'))
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('the QR renderer returns a PNG with and without an inner logo', async () => {
  const QRCode = require('qrcode')
  const { createCanvas, loadImage } = require('canvas')
  const renderQr = createQrRenderer({ QRCode, createCanvas, loadImage })
  const plain = await renderQr({
    text: 'https://cards.invalid/business-card/00123',
    size: 120,
    foreground: '#07074eFF',
    background: '#FFF',
    logo: null,
  })
  assert.ok(plain.subarray(0, 8).equals(PNG.subarray(0, 8)))
  const withLogo = await renderQr({
    text: 'https://cards.invalid/business-card/00123',
    size: 120,
    foreground: '#07074eFF',
    background: '#FFFFFFFF',
    logo: createCanvas(8, 8).toBuffer('image/png'),
  })
  assert.ok(withLogo.subarray(0, 8).equals(PNG.subarray(0, 8)))
  await assert.rejects(
    renderQr({
      text: 'x',
      size: 120,
      foreground: '#000',
      background: '#FFF',
      logo: PNG,
    })
  )
})

// Exercise the production public router with the same injected lookup.
function realVCardRouter(f) {
  return require('../../server/businessCards/router/vCard')({
    publicCards:
      require('../../server/businessCards/services/publicCards').createPublicCards(
        { sql: f.sql, portalConfig: {} }
      ),
    embedPhoto: (card) =>
      card.photo.embedFromString(PNG.toString('base64'), 'image/png'),
  })
}

async function httpFixture(t) {
  const f = fixture(t)
  const sessions = createSessions('business-card-tests-only-key')
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
      // eslint-disable-next-line require-await
      isRegistered: async (identity) => !revoked.has(identity.token),
    },
    adAuth: async () => {},
    cipher: {},
  })
  const app = express()
  app.use(
    '/business-cards-api',
    createApi({
      authorize: auth.authorize,
      requireCardsAdmin: requireRole(
        createRoleChecks({ sql: f.sql, portalConfig: f.portalConfig }),
        'businessCardsAdmin'
      ),
      publicCards: createPublicCards({
        sql: f.sql,
        portalConfig: f.portalConfig,
      }),
      cardManagement: f.cardManagement,
      vCard: realVCardRouter(f),
      uploadDirectory: f.uploadDirectory,
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
  const base = `http://127.0.0.1:${server.address().port}/business-cards-api`
  async function request(
    suffix,
    { as = 'admin', method, body, form, raw, headers } = {}
  ) {
    const allHeaders = { ...(headers || {}) }
    if (as) allHeaders.Authorization = `Bearer ${tokens[as] || as}`
    let payload
    if (form) {
      payload = new FormData()
      for (const [name, value] of Object.entries(form)) {
        if (value && value.buffer)
          payload.append(
            name,
            new Blob([value.buffer], { type: value.mimetype }),
            value.originalname
          )
        else payload.append(name, value)
      }
    } else if (raw !== undefined) {
      allHeaders['Content-Type'] = 'application/json'
      payload = raw
    } else if (body !== undefined) {
      allHeaders['Content-Type'] = 'application/json'
      payload = JSON.stringify(body)
    }
    const response = await fetch(base + suffix, {
      method: method || (payload === undefined ? 'GET' : 'POST'),
      headers: allHeaders,
      body: payload,
    })
    const text = await response.text()
    let parsed = text
    try {
      parsed = JSON.parse(text)
    } catch {}
    return {
      status: response.status,
      body: parsed,
      type: response.headers.get('content-type'),
      cacheControl: response.headers.get('cache-control'),
    }
  }
  return { ...f, request, tokens, revoke: (token) => revoked.add(token) }
}

function managementRequests() {
  return [
    ['/cards', {}],
    ['/cards/00123', {}],
    ['/activity-logs', {}],
    [
      '/save-employee-data',
      { form: { ...validFields(), employeePicture: png() } },
    ],
    ['/delete-business-card', { body: { bCardID: '00123' } }],
  ]
}

test('an administrator can generate, list, inspect, edit and delete a card and read its log', async (t) => {
  const f = await httpFixture(t)
  const name = "Fixture O'Person"
  const created = await f.request('/save-employee-data', {
    form: {
      ...validFields({
        employeeID: 'fix01',
        employeeEnglishName: name,
        employeeArabicName: 'بطاقة تجريبية',
      }),
      employeePicture: jpeg('photo.jpg'),
      companyLogo: png('logo.png'),
      // The old client sent these literal placeholders for absent values.
      qrLogo: 'undefined',
      qrSize: 'undefined',
      employeeLandLines: 'undefined',
      creator: 'Spoofed Creator',
    },
  })
  assert.deepEqual(created, {
    status: 200,
    body: { employeeID: 'FIX01', action: 'Creation', cleanupPending: false },
    type: 'application/json; charset=utf-8',
    cacheControl: null,
  })

  const list = await f.request('/cards')
  assert.equal(list.status, 200)
  assert.equal(list.cacheControl, 'no-store')
  assert.deepEqual(
    list.body.map((row) => Object.keys(row)),
    [[...LIST_FIELDS]]
  )
  assert.equal(list.body[0].fullName_e, name)
  assert.equal(list.body[0].qrCodePath, 'FIX01_QR_300px.png')

  // The listed artifacts are downloadable from the unchanged public mount.
  for (const artifact of [list.body[0].qrCodePath, list.body[0].profilePic])
    assert.equal(
      (await f.request(`/business-cards/${artifact}`, { as: null })).status,
      200
    )

  const card = await f.request('/cards/FIX01')
  assert.equal(card.status, 200)
  assert.equal(card.cacheControl, 'no-store')
  assert.deepEqual(Object.keys(card.body), [...EDITABLE_FIELDS])
  assert.equal(card.body.fullName_a, 'بطاقة تجريبية')
  assert.equal(card.body.landLines, 'undefined')

  const edited = await f.request('/save-employee-data', {
    form: validFields({ employeeID: 'FIX01', employeeEnglishTitle: 'Manager' }),
  })
  assert.deepEqual(edited.body, {
    employeeID: 'FIX01',
    action: 'Update',
    cleanupPending: false,
  })
  assert.equal((await f.request('/cards/FIX01')).body.title, 'Manager')
  assert.equal(f.files().length, 3)

  const removed = await f.request('/delete-business-card', {
    body: {
      bCardID: 'FIX01',
      // Ignored: the old client chose the audit actor and the file to delete.
      adminName: 'Spoofed Admin',
      adminID: USER,
      qrFileName: '../../../package.json',
      employeeCardName: 'Spoofed Name',
    },
  })
  assert.deepEqual(removed.body, {
    message: 'successfullyDeleted',
    cleanupPending: false,
  })
  assert.deepEqual((await f.request('/cards')).body, [])
  assert.deepEqual((await f.request('/cards/FIX01')).body, {
    message: 'cardNotFound',
  })
  assert.deepEqual(
    (await f.request('/delete-business-card', { body: { bCardID: 'FIX01' } }))
      .status,
    404
  )

  const logs = await f.request('/activity-logs')
  assert.equal(logs.cacheControl, 'no-store')
  assert.deepEqual(
    logs.body.map((log) => [
      log.Admin_Name,
      log.theAction,
      log.BCard_ID,
      log.BCard_Name,
    ]),
    [
      [ADMIN_NAME, 'Deletion', 'FIX01', 'Example Person'],
      [ADMIN_NAME, 'Update', 'FIX01', 'Example Person'],
      [ADMIN_NAME, 'Creation', 'FIX01', name],
    ]
  )
  for (const log of logs.body)
    assert.deepEqual(Object.keys(log), [...LOG_FIELDS])
  assert.ok(fs.existsSync(path.join(root, 'package.json')))
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('ordinary employees are refused on every management route before any side effect', async (t) => {
  const f = await httpFixture(t)
  f.state.cards.set('00123', cardRow('00123'))
  f.putFile('00123_QR_300px.png')
  for (const [suffix, options] of managementRequests()) {
    const before = f.calls.length
    const spoofed = {
      ...options,
      as: 'user',
      headers: {
        'X-Employee-Code': ADMIN,
        'X-Is-Business-Cards-Admin': 'true',
      },
    }
    if (options.body)
      spoofed.body = {
        ...options.body,
        employeeCode: ADMIN,
        adminID: ADMIN,
        adminName: ADMIN_NAME,
        isBusinessCardsAdmin: true,
      }
    if (options.form)
      spoofed.form = {
        ...options.form,
        creator: ADMIN_NAME,
        adminID: ADMIN,
        isBusinessCardsAdmin: 'true',
      }
    const query = '?employeeCode=ADM001&isBusinessCardsAdmin=true'
    assert.deepEqual(
      [suffix, await f.request(suffix + query, spoofed)].map((value) =>
        typeof value === 'string' ? value : [value.status, value.body]
      ),
      [suffix, [403, { message: 'forbidden' }]]
    )
    // Only the caller's own role check reached the database.
    const made = f.calls.slice(before)
    assert.equal(made.length, 1)
    assert.equal(made[0].statement, ROLE_QUERY)
    assert.equal(made[0].inputs.employeeCode.value, USER)
  }
  assert.deepEqual(f.files(), ['00123_QR_300px.png'])
  assert.ok(f.state.cards.has('00123'))
  assert.equal(f.state.logs.length, 0)
  assert.equal(f.qrCalls.length, 0)
})

test('missing, tampered and revoked sessions get 401 before any SQL; revoked membership applies at once', async (t) => {
  const f = await httpFixture(t)
  f.state.cards.set('00123', cardRow('00123'))
  f.revoke(f.tokens.user)
  for (const [suffix, options] of managementRequests()) {
    for (const as of [null, 'not-a-token', `${f.tokens.admin}x`, 'user'])
      assert.deepEqual(
        [suffix, as, (await f.request(suffix, { ...options, as })).status],
        [suffix, as, 401]
      )
  }
  assert.equal(f.calls.length, 0)
  assert.deepEqual(f.files(), [])

  // Portal administrators hold no implicit business-card role.
  assert.doesNotMatch(ROLE_QUERY, /admin_members/)
  assert.match(ROLE_QUERY, /FROM dbo\.business_card_admins WHERE/)

  assert.equal((await f.request('/cards')).status, 200)
  f.state.admins.delete(ADMIN)
  for (const [suffix, options] of managementRequests())
    assert.equal((await f.request(suffix, options)).status, 403)
  assert.ok(f.state.cards.has('00123'))
})

test('retired SQL gateways and the unused lookup return 404 for every caller and method', async (t) => {
  const f = await httpFixture(t)
  f.state.cards.set('00123', cardRow('00123'))
  for (const suffix of [
    '/sql-call',
    '/sql-call/',
    '/hr-sql-call',
    '/hr-sql-call/',
    '/open-sql-call',
    '/get-employee-data',
    '/cards/sql-call/extra',
  ]) {
    for (const as of ['admin', 'user', null]) {
      for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
        const options = { as, method }
        if (method !== 'GET')
          options.body = {
            query: 'SELECT * FROM dbo.usersInfo',
            code: '00123',
          }
        assert.deepEqual(
          [suffix, as, method, await f.request(suffix, options)].slice(3),
          [
            {
              status: 404,
              body: { message: 'notFound' },
              type: 'application/json; charset=utf-8',
              cacheControl: null,
            },
          ]
        )
      }
    }
  }
  assert.equal(f.calls.length, 0)
  // No other method reaches a management handler either.
  for (const [suffix, method] of [
    ['/cards', 'POST'],
    ['/cards/00123', 'DELETE'],
    ['/cards/00123', 'PUT'],
    ['/activity-logs', 'POST'],
    ['/save-employee-data', 'GET'],
    ['/delete-business-card', 'GET'],
  ])
    assert.equal(
      (
        await f.request(suffix, {
          method,
          body: method === 'GET' ? undefined : {},
        })
      ).status,
      404
    )
  assert.ok(f.state.cards.has('00123'))
  assert.ok(
    !fs.existsSync(path.join(root, 'server/businessCards/router/sqlCalls.js'))
  )
})

test('public cards, vCards and card artifacts stay available without administrator access', async (t) => {
  const f = await httpFixture(t)
  f.state.cards.set('00123', cardRow('00123', { fullName_e: 'Public Person' }))
  f.putFile('00123_pic.jpg', JPEG)
  f.putFile('00123_QR_300px.png', PNG)
  for (const as of [null, 'user', 'stale-or-invalid-token', 'admin']) {
    const card = await f.request('/public-cards/00123', { as })
    assert.equal(card.status, 200)
    assert.equal(card.body.fullName_e, 'Public Person')
    assert.ok(!('qrCodePath' in card.body))

    const vCard = await f.request('/vcard/?employeeID=00123', { as })
    assert.equal(vCard.status, 200)
    assert.match(vCard.type, /^text\/vcard/)
    assert.match(vCard.body, /BEGIN:VCARD[\s\S]*Public Person[\s\S]*END:VCARD/)

    for (const artifact of ['00123_pic.jpg', '00123_QR_300px.png'])
      assert.equal(
        (await f.request(`/business-cards/${artifact}`, { as })).status,
        200
      )
  }
  // None of those public requests ran a role check.
  assert.equal(f.statements(ROLE_QUERY).length, 0)
  assert.deepEqual((await f.request('/public-cards/NOPE', { as: null })).body, {
    message: 'cardNotFound',
  })
})

test('invalid targets, uploads, bodies and database failures return controlled JSON', async (t) => {
  const f = await httpFixture(t)
  f.state.cards.set('00123', cardRow('00123'))
  for (const id of ["1' OR 1=1--", 'a'.repeat(11), 'a b', '١٢٣'])
    assert.deepEqual(
      (await f.request(`/cards/${encodeURIComponent(id)}`)).body,
      { message: 'invalidEmployeeCode' }
    )
  assert.deepEqual(
    await f.request('/cards/%E0%A4%A').then((r) => [r.status, r.body]),
    [400, { message: 'invalidRequest' }]
  )
  for (const body of [
    {},
    { bCardID: ['00123'] },
    { bCardID: { $ne: 1 } },
    { bCardID: "x';--" },
  ])
    assert.deepEqual(
      await f
        .request('/delete-business-card', { body })
        .then((r) => [r.status, r.body]),
      [400, { message: 'invalidEmployeeCode' }]
    )
  assert.deepEqual(
    await f
      .request('/delete-business-card', { raw: '{"bCardID":' })
      .then((r) => [r.status, r.body]),
    [400, { message: 'invalidRequest' }]
  )
  assert.ok(f.state.cards.has('00123'))

  const upload = (form) =>
    f.request('/save-employee-data', { form }).then((r) => [r.status, r.body])
  assert.deepEqual(
    await upload({
      ...validFields(),
      employeePicture: {
        buffer: Buffer.from('<svg/>'),
        mimetype: 'image/svg+xml',
        originalname: 'x.svg',
      },
    }),
    [400, { message: 'fileTypeError' }]
  )
  assert.deepEqual(
    await upload({
      ...validFields(),
      companyLogo: {
        buffer: Buffer.concat([PNG, Buffer.alloc(5120001)]),
        mimetype: 'image/png',
        originalname: 'big.png',
      },
    }),
    [400, { message: 'fileTooLarge' }]
  )
  assert.deepEqual(
    await upload({ ...validFields(), attachment: png('../../evil.png') }),
    [400, { message: 'invalidUpload' }]
  )
  assert.deepEqual(
    await upload({
      ...validFields(),
      employeePicture: { ...png(), buffer: Buffer.from('not an image') },
    }),
    [400, { message: 'invalidUpload' }]
  )
  assert.deepEqual(
    await upload(validFields({ employeeEnglishName: 'a'.repeat(101) })),
    [400, { message: 'invalidCardData' }]
  )
  assert.deepEqual(await upload(validFields({ employeeID: '../../x' })), [
    400,
    { message: 'invalidEmployeeCode' },
  ])
  assert.deepEqual(
    await upload(validFields({ employeeEnglishName: 'a'.repeat(4096) })),
    [400, { message: 'invalidCardData' }]
  )
  // A hostile original file name never becomes a stored file name.
  assert.equal(
    (
      await f.request('/save-employee-data', {
        form: { ...validFields(), employeePicture: png('..\\..\\evil.png') },
      })
    ).status,
    200
  )
  assert.ok(
    f
      .files()
      .every((name) =>
        /^00123_[0-9a-f-]{36}\.png$|^00123_QR_300px\.png$/.test(name)
      )
  )
  assert.equal(f.state.logs.length, 1)

  for (const failAt of ['connect', 'query']) {
    f.state.failAt = failAt
    for (const [suffix, options] of managementRequests()) {
      const result = await f.request(suffix, options)
      assert.deepEqual(
        [suffix, result.status, result.body],
        [suffix, 503, { message: 'serviceUnavailable' }]
      )
    }
  }
  const reads = ['/cards', '/cards/00123', '/activity-logs']
  for (const [index, statement] of [
    LIST_CARDS_QUERY,
    EDITABLE_CARD_QUERY,
    ACTIVITY_LOGS_QUERY,
  ].entries()) {
    f.state.failAt = statement
    const result = await f.request(reads[index])
    assert.deepEqual(
      [result.status, result.body],
      [503, { message: 'serviceUnavailable' }]
    )
  }
  f.state.failAt = SAVE_CARD_QUERY
  assert.equal((await upload(validFields()))[0], 503)
  f.state.failAt = DELETE_CARD_QUERY
  assert.equal(
    (await f.request('/delete-business-card', { body: { bCardID: '00123' } }))
      .status,
    503
  )
  assert.ok(f.state.cards.has('00123'))
  assert.equal(f.state.logs.length, 1)
})

// Frontend: execute the real store, pages and dialog with mocked dependencies.
function loadScript(relative, source) {
  const compiled = babel.transformSync(source, {
    configFile: false,
    babelrc: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code
  const module = { exports: {} }
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    FormData,
    require(specifier) {
      if (specifier.startsWith('~/'))
        return loadScript(
          specifier,
          fs.readFileSync(path.join(root, `${specifier.slice(2)}.js`), 'utf8')
        )
      if (specifier === 'vee-validate') return { extend() {}, localize() {} }
      if (specifier === 'vee-validate/dist/rules') return {}
      if (specifier === 'libphonenumber-js')
        return { isValidNumber: () => true }
      return require(specifier)
    },
  })
  return module.exports
}

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const loadStore = () =>
  loadScript(
    'store/businessCards/index.js',
    read('store/businessCards/index.js')
  )
const loadComponent = (relative) =>
  loadScript(relative, compiler.parseComponent(read(relative)).script.content)
    .default

function storeRuntime(axios) {
  const messages = JSON.parse(read('locales/en.json'))
  const lookup = (key) =>
    key.split('.').reduce((value, part) => value && value[part], messages)
  const runtime = (config) => axios.request(config)
  runtime.get = (url, config) => axios.request({ method: 'get', url, config })
  runtime.post = (url, data) => axios.request({ method: 'post', url, data })
  return {
    $config: { baseURL: 'https://portal.invalid' },
    $axios: runtime,
    app: {
      i18n: {
        te: (key) => typeof lookup(key) === 'string',
        t: (key) => lookup(key) || key,
      },
    },
  }
}

function storeContext() {
  const commits = []
  const notifications = []
  return {
    commits,
    notifications,
    context: {
      commit: (name, value) => commits.push([name, value]),
      // eslint-disable-next-line require-await
      dispatch: async (name, value) => notifications.push([name, value]),
    },
  }
}

// Values built inside the vm realm have foreign prototypes; compare as data.
const plain = (value) => JSON.parse(JSON.stringify(value))

function httpError(status, message) {
  const error = new Error('private SQL detail')
  error.response = { status, data: { message } }
  return error
}

test('the store calls only the dedicated endpoints and never sends SQL or an audit actor', async () => {
  const { actions } = loadStore()
  const en = JSON.parse(read('locales/en.json')).errorMessages.businessCards
  const requests = []
  let respond = () => ({ status: 200, data: [] })
  const runtime = storeRuntime({
    // eslint-disable-next-line require-await
    request: async (config) => {
      requests.push(config)
      return respond(config)
    },
  })
  const base = 'https://portal.invalid/business-cards-api'

  // Lists
  let s = storeContext()
  respond = () => ({ status: 200, data: [cardRow('00123')] })
  await actions.getGeneratedCards.call(runtime, s.context)
  assert.deepEqual(
    [requests.at(-1).method, requests.at(-1).url],
    ['get', `${base}/cards`]
  )
  assert.equal(s.commits[0][0], 'SET_CARDS')
  assert.equal(s.commits[0][1].length, 1)
  await actions.getActivityLogs.call(runtime, s.context)
  assert.equal(requests.at(-1).url, `${base}/activity-logs`)
  assert.equal(s.commits[1][0], 'SET_ACTIVITY_LOGS')

  // A non-array success body and a refusal both clear the list.
  s = storeContext()
  respond = () => ({ status: 200, data: { message: 'unexpected' } })
  await actions.getGeneratedCards.call(runtime, s.context)
  assert.deepEqual(plain(s.commits), [['SET_CARDS', []]])
  respond = () => {
    throw httpError(403, 'forbidden')
  }
  await actions.getGeneratedCards.call(runtime, s.context)
  await actions.getActivityLogs.call(runtime, s.context)
  assert.deepEqual(plain(s.commits.slice(1)), [
    ['SET_CARDS', []],
    ['SET_ACTIVITY_LOGS', []],
  ])
  assert.deepEqual(
    s.notifications.map(([, notification]) => notification.message),
    [en.forbidden, en.forbidden]
  )

  // Single card: encoded ID; missing cards and network errors resolve to null.
  s = storeContext()
  respond = () => ({ status: 200, data: cardRow('A/1') })
  assert.equal(
    (await actions.getCard.call(runtime, s.context, 'A/1')).employeeID,
    'A/1'
  )
  assert.equal(requests.at(-1).url, `${base}/cards/A%2F1`)
  respond = () => {
    throw httpError(404, 'cardNotFound')
  }
  assert.equal(await actions.getCard.call(runtime, s.context, '00123'), null)
  respond = () => {
    throw new Error('Network Error')
  }
  assert.equal(await actions.getCard.call(runtime, s.context, '00123'), null)
  respond = () => ({ status: 200, data: [] })
  assert.equal(await actions.getCard.call(runtime, s.context, '00123'), null)
  assert.deepEqual(
    s.notifications.map(([, notification]) => notification.message),
    [
      en.cardNotFound,
      JSON.parse(read('locales/en.json')).errorMessages.login
        .serviceUnavailable,
    ]
  )

  // Save: multipart without creator or absent values; ID upper-cased.
  s = storeContext()
  respond = () => ({
    status: 200,
    data: { employeeID: 'AB123', action: 'Creation', cleanupPending: false },
  })
  const picture = new Blob([PNG], { type: 'image/png' })
  const saved = await actions.saveEmployeeData.call(runtime, s.context, {
    employeeID: 'ab123',
    company: 'Custom',
    employeeEnglishName: "O'Brien",
    employeeArabicName: undefined,
    employeeLandLines: null,
    employeePicture: picture,
    companyLogo: undefined,
    qrLogo: null,
    bgColor: '#FFFFFFFF',
    creator: 'Spoofed Creator',
  })
  assert.equal(saved, 'AB123')
  assert.deepEqual(s.commits, [['SET_USER_CARD_ID', 'AB123']])
  const sent = requests.at(-1)
  assert.equal(sent.url, `${base}/save-employee-data`)
  assert.deepEqual(
    [...sent.data.keys()].sort(),
    [
      'bgColor',
      'employeeCompany',
      'employeeEnglishName',
      'employeeID',
      'employeePicture',
    ].sort()
  )
  assert.equal(sent.data.get('employeeID'), 'AB123')
  assert.equal(sent.data.get('employeeEnglishName'), "O'Brien")

  for (const failure of [
    () => {
      throw httpError(400, 'invalidCardData')
    },
    () => ({ status: 200, data: 'AB123' }),
    () => ({ status: 200, data: {} }),
  ]) {
    s = storeContext()
    respond = failure
    assert.equal(
      await actions.saveEmployeeData.call(runtime, s.context, {
        company: 'Custom',
      }),
      null
    )
    assert.equal(s.commits.length, 0)
    assert.equal(s.notifications.length, 1)
    assert.ok(!requests.at(-1).data.has('employeeID'))
  }

  // Delete: only the target card ID is sent; no local-storage identity.
  s = storeContext()
  respond = () => ({ status: 200, data: { message: 'successfullyDeleted' } })
  assert.equal(
    await actions.deleteBusinessCard.call(runtime, s.context, {
      code: '00123',
      file: 'x.png',
      name: 'Name',
    }),
    true
  )
  assert.deepEqual(
    [requests.at(-1).url, plain(requests.at(-1).data)],
    [`${base}/delete-business-card`, { bCardID: '00123' }]
  )
  assert.equal(s.notifications[0][1].type, 'success')
  respond = () => {
    throw httpError(404, 'cardNotFound')
  }
  assert.equal(
    await actions.deleteBusinessCard.call(runtime, s.context, {
      code: '00123',
    }),
    false
  )
  assert.equal(s.notifications[1][1].message, en.cardNotFound)

  for (const request of requests) {
    assert.doesNotMatch(request.url, /sql-call/)
    assert.doesNotMatch(JSON.stringify(request.data || {}), /SELECT|query/i)
  }
})

function pageContext(component, overrides = {}) {
  const loading = []
  const pushes = []
  const dispatched = []
  const emitted = []
  const context = {
    ...component.data(),
    $nuxt: {
      $loading: {
        start: () => loading.push('start'),
        finish: () => loading.push('finish'),
      },
    },
    $router: { push: (to) => pushes.push(to) },
    $refs: { theForm: { reset() {} } },
    localePath: (to) => `/ar${to}`,
    $emit: (name) => emitted.push(name),
    $store: {
      // eslint-disable-next-line require-await
      dispatch: async (name, payload) => {
        dispatched.push([name, payload])
        return overrides.result
      },
    },
  }
  for (const [name, method] of Object.entries(component.methods))
    context[name] = method.bind(context)
  return { context, loading, pushes, dispatched, emitted }
}

test('the generator page survives missing cards and failed saves and sends no audit actor', async () => {
  const page = loadComponent('pages/business-cards/card-generator/index.vue')

  // Stale edit link: the card is gone, the form stays empty and usable.
  let p = pageContext(page, { result: null })
  await p.context.getEmployeeData('GONE1')
  assert.deepEqual(p.dispatched, [['businessCards/getCard', 'GONE1']])
  assert.equal(p.context.employeeID, undefined)
  assert.equal(p.context.mainColor, '#07074eFF')

  p = pageContext(page, {
    result: {
      ...cardRow('00123'),
      landLines: 'undefined',
      faxLine: null,
      mainColor: null,
    },
  })
  await p.context.getEmployeeData('00123')
  assert.equal(p.context.employeeID, '00123')
  assert.equal(p.context.employeeLandLines, '')
  assert.equal(p.context.employeeFaxLine, '')
  assert.equal(p.context.employeeArabicName, 'اسم تجريبي')
  assert.equal(p.context.mainColor, '#07074eFF')

  // Only a plain string ID from the URL triggers a lookup.
  for (const [id, expected] of [
    ['00123', 1],
    [['a', 'b'], 0],
    [undefined, 0],
    ['', 0],
  ]) {
    const mounted = pageContext(page, { result: null })
    mounted.context.$route = { query: { id } }
    page.mounted.call(mounted.context)
    assert.equal(mounted.dispatched.length, expected)
  }

  // Failed save: no reset, no navigation, loading indicator finished.
  p = pageContext(page, { result: null })
  p.context.employeeEnglishName = 'Keep Me'
  p.context.company = 'Custom'
  await p.context.generateCard()
  assert.equal(p.context.employeeEnglishName, 'Keep Me')
  assert.deepEqual(p.pushes, [])
  assert.deepEqual(p.loading, ['start', 'finish'])
  const [action, payload] = p.dispatched[0]
  assert.equal(action, 'businessCards/saveEmployeeData')
  assert.ok(!('creator' in payload))

  // Successful save: localized navigation to the returned card.
  p = pageContext(page, { result: 'X12345' })
  p.context.employeeEnglishName = 'Saved'
  await p.context.generateCard()
  assert.deepEqual(p.pushes, ['/ar/business-card/X12345'])
  assert.equal(p.context.employeeEnglishName, undefined)
  assert.deepEqual(p.loading, ['start', 'finish'])
})

test('list, log and delete-dialog components tolerate incomplete rows and failures', async () => {
  const cards = loadComponent('pages/business-cards/generated-cards/index.vue')
  const rows = [
    cardRow('00123', { fullName_e: 'Alpha (One)' }),
    { employeeID: 'X10001', fullName_e: null },
    { employeeID: null, fullName_e: undefined },
  ]
  const filter = (searchTerm) =>
    cards.computed.bCardsArray
      .call({ bCards: rows, searchTerm })
      .map((row) => row.employeeID)
  assert.deepEqual(filter(''), ['00123', 'X10001', null])
  assert.deepEqual(filter('x1'), ['X10001'])
  // Regular-expression characters in the search box are plain text.
  assert.deepEqual(filter('(one'), ['00123'])
  assert.deepEqual(filter('[*'), [])

  const logs = loadComponent('pages/business-cards/activity-logs/index.vue')
  const logRows = [
    { ID: 2, BCard_ID: '00123', BCard_Name: 'Alpha', theAction: 'Update' },
    { ID: 1, BCard_ID: null, BCard_Name: null, theAction: null },
  ]
  const filterLogs = (searchTerm) =>
    logs.computed.logsArray
      .call({ activityLogs: logRows, searchTerm })
      .map((row) => row.ID)
  assert.deepEqual(filterLogs(''), [2, 1])
  assert.deepEqual(filterLogs('UPD'), [2])
  assert.deepEqual(filterLogs('(('), [])

  // Overlays close even when the list request fails.
  for (const [component, method] of [
    [cards, 'getGeneratedCards'],
    [logs, 'getActivityLogs'],
  ]) {
    const context = {
      overlay: false,
      $store: {
        // eslint-disable-next-line require-await
        dispatch: async () => {
          throw new Error('unexpected')
        },
      },
    }
    await assert.rejects(component.methods[method].call(context))
    assert.equal(context.overlay, false)
  }

  const dialog = loadComponent('components/businessCards/bCardDeletion.vue')
  assert.deepEqual(Object.keys(dialog.props), ['employee'])
  for (const result of [true, false]) {
    const p = pageContext(dialog, { result })
    p.context.employee = '00123'
    p.context.dialog = true
    await p.context.deleteBusinessCard()
    assert.deepEqual(plain(p.dispatched), [
      ['businessCards/deleteBusinessCard', { code: '00123' }],
    ])
    assert.equal(p.context.dialog, false)
    // The list is refreshed either way, so an already-deleted card disappears.
    assert.deepEqual(p.emitted, ['updateCards'])
    assert.deepEqual(p.loading, ['start', 'finish'])
  }
})

function sourceFiles(directories) {
  const found = []
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(js|vue)$/.test(entry.name)) found.push(full)
    }
  }
  for (const directory of directories) walk(path.join(root, directory))
  return found
}

const relative = (file) => path.relative(root, file).replaceAll('\\', '/')

test('no caller or server route still depends on the retired business-card gateways', () => {
  const frontend = sourceFiles([
    'pages',
    'components',
    'store',
    'layouts',
    'utils',
    'plugins',
  ])
  const callers = (pattern) =>
    frontend.filter((file) => pattern.test(read(relative(file)))).map(relative)
  assert.deepEqual(
    callers(/business-cards-api\/(?:hr-|open-)?sql-call|get-employee-data/),
    []
  )
  assert.deepEqual(callers(/administration-api\/(?:hr-)?sql-call/), [])

  const management = [
    'store/businessCards/index.js',
    'pages/business-cards/generated-cards/index.vue',
    'pages/business-cards/card-generator/index.vue',
    'pages/business-cards/activity-logs/index.vue',
    'components/businessCards/bCardDeletion.vue',
    'components/portal/userProfile.vue',
    'components/administration/dtrSetup/drtAdminPopup.vue',
  ]
  for (const file of management) {
    const text = read(file)
    assert.doesNotMatch(text, /sql-call|\bquery\s*:/i, file)
    assert.doesNotMatch(text, /\bSELECT\s|\bexec\s+\[|employeeData\]/, file)
    // Identity and audit actors come from the session, not local storage.
    if (management.indexOf(file) < 5)
      assert.doesNotMatch(
        file.endsWith('.vue')
          ? compiler.parseComponent(text).script.content
          : text,
        /localStorage|adminName|adminID|creator|userFullName/,
        file
      )
  }

  const server = sourceFiles(['server/businessCards']).map(relative)
  assert.ok(server.includes('server/businessCards/router/cardManagement.js'))
  assert.ok(!server.includes('server/businessCards/router/sqlCalls.js'))
  assert.ok(!server.includes('server/businessCards/router/business-cards.js'))
  for (const file of server) {
    const text = read(file)
    assert.doesNotMatch(text, /sql-call|body\.query|query\.query/, file)
    // Every statement handed to mssql is a named module constant.
    for (const [, argument] of text.matchAll(/\.query\(\s*([^)\s]+)/g))
      assert.match(argument, /^[A-Z_]+$/, `${file}: ${argument}`)
    assert.doesNotMatch(text, /\.execute\(/, file)
  }
  // The business-card API composition no longer mounts a SQL router.
  assert.doesNotMatch(read('server/businessCards/main.js'), /sqlCalls/)
  assert.doesNotMatch(read('server/businessCards/createApi.js'), /sqlCalls/)
})

test('English and Arabic contain every business-card error code; edited buttons are clickable', () => {
  const codes = [
    'forbidden',
    'authFailed',
    'invalidEmployeeCode',
    'invalidCardData',
    'invalidRequest',
    'cardNotFound',
    'fileTypeError',
    'fileTooLarge',
    'invalidUpload',
    'serviceUnavailable',
  ]
  for (const locale of ['en', 'ar']) {
    const messages = JSON.parse(read(`locales/${locale}.json`))
    for (const code of codes) {
      const message = messages.errorMessages.businessCards[code]
      assert.equal(typeof message, 'string', `${locale}: ${code}`)
      assert.ok(message.length > 0)
    }
    assert.equal(typeof messages.successMessages.successDelete, 'string')
  }
  // Every code the router or service can emit is translated.
  const emitted = new Set()
  for (const file of [
    'server/businessCards/router/cardManagement.js',
    'server/businessCards/services/cardManagement.js',
    'server/businessCards/createApi.js',
  ])
    for (const pattern of [
      /CardError\(\s*'(\w+)'/g,
      /message:\s*'(\w+)'/g,
      /[?:]\s*'(\w+)'/g,
    ])
      for (const [, code] of read(file).matchAll(pattern)) emitted.add(code)
  for (const code of [
    'forbidden',
    'cardNotFound',
    'invalidUpload',
    'fileTooLarge',
  ])
    assert.ok(emitted.has(code), code)
  for (const code of emitted)
    if (code !== 'notFound' && code !== 'successfullyDeleted')
      assert.ok(codes.includes(code), code)

  for (const file of [
    'pages/business-cards/generated-cards/index.vue',
    'pages/business-cards/card-generator/index.vue',
    'components/businessCards/bCardDeletion.vue',
  ]) {
    const template = compiler.parseComponent(read(file)).template.content
    const buttons = template.match(/<v-btn\b[^>]*>/g) || []
    assert.ok(buttons.length > 0, file)
    for (const button of buttons)
      assert.match(button, /cursor-pointer/, `${file}: ${button}`)
  }
})
