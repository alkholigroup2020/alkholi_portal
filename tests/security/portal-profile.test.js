const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const express = require('express')
const babel = require('@babel/core')
const createApi = require('../../server/portal/createApi')
const {
  createPortalIdentity,
  PROFILE_QUERY,
  AUTHORIZATIONS_QUERY,
  BUSINESS_CARD_QUERY,
  PROFILE_PHOTO_QUERY,
} = require('../../server/portal/services/portalIdentity')
const { createAuth } = require('../../server/login/services/auth')
const { createSessions } = require('../../server/login/services/session')

const root = path.resolve(__dirname, '../..')
const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])

function createTemporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-profile-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  return directory
}

function databaseFixture(t, overrides = {}) {
  const uploadDirectory = createTemporaryDirectory(t)
  const calls = []
  const pools = []
  const state = {
    failAt: null,
    profileRows: [
      {
        profilePicPath: 'profile.png',
        portalProfilePicPath: null,
        privateField: 'not returned',
      },
    ],
    authorizationRows: [
      {
        isPortalAdmin: 1,
        isBusinessCardsAdmin: 0,
        isCOCAdmin: 1,
        isElevatorsSurveysUser: 0,
        isHRSurveysUser: 1,
        isDTRUser: 1,
      },
    ],
    cardRows: [],
    oldProfilePicPath: null,
    oldProfilePicInUse: false,
    profileCount: 1,
  }

  class ConnectionPool {
    constructor() {
      this.closed = false
      pools.push(this)
    }

    async connect() {
      if (state.failAt === 'connect') throw new Error('private connection')
    }

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
        async query(statement) {
          calls.push({ statement, inputs })
          if (state.failAt === statement || state.failAt === 'query')
            throw new Error('private query')
          if (statement === PROFILE_QUERY)
            return { recordset: state.profileRows }
          if (statement === AUTHORIZATIONS_QUERY)
            return { recordset: state.authorizationRows }
          if (statement === BUSINESS_CARD_QUERY)
            return { recordset: state.cardRows }
          if (statement === PROFILE_PHOTO_QUERY)
            return {
              recordset: [
                {
                  profileCount: state.profileCount,
                  oldProfilePicPath: state.oldProfilePicPath,
                  oldProfilePicInUse: state.oldProfilePicInUse,
                },
              ],
            }
          throw new Error('unexpected query')
        },
      }
    }
  }

  const sql = {
    ConnectionPool,
    VarChar: (length) => ({ name: 'varchar', length }),
    NVarChar: (length) => ({ name: 'nvarchar', length }),
    Bit: { name: 'bit' },
  }
  const fileSystem = overrides.fileSystem || fs.promises
  return {
    calls,
    pools,
    state,
    sql,
    uploadDirectory,
    portalIdentity: createPortalIdentity({
      sql,
      portalConfig: {},
      fileSystem,
      uploadDirectory,
    }),
  }
}

function uploadedFile(directory, filename, contents = pngHeader) {
  const filePath = path.join(directory, filename)
  fs.writeFileSync(filePath, contents)
  return {
    filename,
    path: filePath,
    mimetype: 'image/png',
  }
}

test('portal reads bind the authenticated employee to fixed, minimal queries', async (t) => {
  const f = databaseFixture(t)
  assert.deepEqual(await f.portalIdentity.getProfile('SELF001'), {
    profilePicPath: 'profile.png',
    portalProfilePicPath: null,
  })
  assert.deepEqual(await f.portalIdentity.getAuthorizations('SELF001'), {
    isPortalAdmin: true,
    isBusinessCardsAdmin: false,
    isCOCAdmin: true,
    isElevatorsSurveysUser: false,
    isHRSurveysUser: true,
    isDTRUser: true,
  })
  assert.deepEqual(await f.portalIdentity.getMyBusinessCard('SELF001'), {
    hasCard: false,
    qrCodePath: null,
  })
  f.state.cardRows = [{ qrCodePath: 'self-qr.png', unrelated: 'private' }]
  assert.deepEqual(await f.portalIdentity.getMyBusinessCard('SELF001'), {
    hasCard: true,
    qrCodePath: 'self-qr.png',
  })

  assert.deepEqual(
    new Set(f.calls.map(({ statement }) => statement)),
    new Set([PROFILE_QUERY, AUTHORIZATIONS_QUERY, BUSINESS_CARD_QUERY])
  )
  for (const call of f.calls) {
    assert.deepEqual(call.inputs.employeeCode, {
      type: { name: 'varchar', length: 20 },
      value: 'SELF001',
    })
    assert.doesNotMatch(call.statement, /SELF001/)
  }
  assert.doesNotMatch(PROFILE_QUERY, /SELECT\s+\*/i)
  assert.equal(
    BUSINESS_CARD_QUERY.match(/SELECT TOP \(2\)([\s\S]*?)FROM/i)[1].trim(),
    'qrCodePath'
  )
  for (const table of [
    'admin_members',
    'business_card_admins',
    'coc_admins',
    'elevators_users',
    'hr_surveys_users',
    'dtr_users',
  ]) {
    assert.match(AUTHORIZATIONS_QUERY, new RegExp(`dbo\\.${table}`))
  }
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('ambiguous or failed portal reads close pools and return controlled errors', async (t) => {
  const f = databaseFixture(t)
  f.state.profileRows = []
  await assert.rejects(f.portalIdentity.getProfile('SELF001'), {
    message: 'profileNotFound',
    statusCode: 404,
  })
  f.state.profileRows = [{}, {}]
  await assert.rejects(f.portalIdentity.getProfile('SELF001'), {
    message: 'serviceUnavailable',
    statusCode: 503,
  })
  f.state.cardRows = [{}, {}]
  await assert.rejects(f.portalIdentity.getMyBusinessCard('SELF001'), {
    message: 'serviceUnavailable',
    statusCode: 503,
  })
  f.state.failAt = 'query'
  await assert.rejects(f.portalIdentity.getAuthorizations('SELF001'), {
    message: 'private query',
  })
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('photo replacement updates only one bound identity and all membership images', async (t) => {
  const f = databaseFixture(t)
  fs.writeFileSync(path.join(f.uploadDirectory, 'old.jpg'), 'old')
  f.state.oldProfilePicPath = 'old.jpg'
  const file = uploadedFile(f.uploadDirectory, 'new.png')

  assert.deepEqual(await f.portalIdentity.saveProfilePhoto('SELF001', file), {
    cleanupPending: false,
  })
  assert.equal(fs.existsSync(file.path), true)
  assert.equal(fs.existsSync(path.join(f.uploadDirectory, 'old.jpg')), false)
  const call = f.calls.at(-1)
  assert.equal(call.statement, PROFILE_PHOTO_QUERY)
  assert.deepEqual(call.inputs, {
    employeeCode: {
      type: { name: 'varchar', length: 20 },
      value: 'SELF001',
    },
    profilePicPath: {
      type: { name: 'nvarchar', length: 300 },
      value: 'new.png',
    },
    hrPicture: { type: { name: 'bit' }, value: false },
    portalPicture: { type: { name: 'bit' }, value: true },
  })
  assert.doesNotMatch(call.statement, /SELF001|new\.png/)
  assert.match(call.statement, /BEGIN TRANSACTION/)
  assert.match(call.statement, /UPDLOCK, HOLDLOCK/)
  for (const table of [
    'usersInfo',
    'admin_members',
    'business_card_admins',
    'coc_admins',
    'elevators_users',
    'hr_surveys_users',
    'dtr_users',
  ]) {
    assert.match(call.statement, new RegExp(`UPDATE dbo\\.${table}`))
  }
})

test('shared old photos remain in place for every employee still referencing them', async (t) => {
  const f = databaseFixture(t)
  const shared = path.join(f.uploadDirectory, 'shared.jpg')
  fs.writeFileSync(shared, 'shared')
  f.state.oldProfilePicPath = 'shared.jpg'
  f.state.oldProfilePicInUse = true

  assert.deepEqual(
    await f.portalIdentity.saveProfilePhoto(
      'SELF001',
      uploadedFile(f.uploadDirectory, 'replacement.png')
    ),
    { cleanupPending: false }
  )
  assert.equal(fs.existsSync(shared), true)
  for (const table of [
    'usersInfo',
    'admin_members',
    'business_card_admins',
    'coc_admins',
    'elevators_users',
    'hr_surveys_users',
    'dtr_users',
  ]) {
    assert.match(
      f.calls.at(-1).statement,
      new RegExp(`FROM dbo\\.${table} WITH \\(HOLDLOCK\\)`)
    )
  }
})

test('photo failures remove only the new safe file and preserve the old photo', async (t) => {
  const f = databaseFixture(t)
  fs.writeFileSync(path.join(f.uploadDirectory, 'old.jpg'), 'old')
  f.state.oldProfilePicPath = 'old.jpg'

  const invalid = uploadedFile(
    f.uploadDirectory,
    'invalid.png',
    Buffer.from('not an image')
  )
  await assert.rejects(
    f.portalIdentity.saveProfilePhoto('SELF001', invalid),
    { message: 'invalidUpload', statusCode: 400 }
  )
  assert.equal(fs.existsSync(invalid.path), false)
  assert.equal(f.pools.length, 0)

  const valid = uploadedFile(f.uploadDirectory, 'failed.png')
  f.state.failAt = PROFILE_PHOTO_QUERY
  await assert.rejects(
    f.portalIdentity.saveProfilePhoto('SELF001', valid),
    { message: 'private query' }
  )
  assert.equal(fs.existsSync(valid.path), false)
  assert.equal(fs.existsSync(path.join(f.uploadDirectory, 'old.jpg')), true)
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('missing, unsafe, and failed old-file cleanup cannot affect another file', async (t) => {
  const deleted = []
  const fileSystem = {
    open: (...args) => fs.promises.open(...args),
    async unlink(filePath) {
      deleted.push(filePath)
      if (path.basename(filePath) === 'locked.jpg') {
        const error = new Error('locked')
        error.code = 'EACCES'
        throw error
      }
      return fs.promises.unlink(filePath)
    },
  }
  const f = databaseFixture(t, { fileSystem })
  const outside = path.join(path.dirname(f.uploadDirectory), 'other-user.jpg')
  fs.writeFileSync(outside, 'other')
  t.after(() => fs.rmSync(outside, { force: true }))

  f.state.oldProfilePicPath = 'missing.jpg'
  assert.deepEqual(
    await f.portalIdentity.saveProfilePhoto(
      'SELF001',
      uploadedFile(f.uploadDirectory, 'one.png')
    ),
    { cleanupPending: false }
  )

  f.state.oldProfilePicPath = '../other-user.jpg'
  assert.deepEqual(
    await f.portalIdentity.saveProfilePhoto(
      'SELF001',
      uploadedFile(f.uploadDirectory, 'two.png')
    ),
    { cleanupPending: true }
  )
  assert.equal(fs.existsSync(outside), true)
  assert.equal(deleted.includes(outside), false)

  fs.writeFileSync(path.join(f.uploadDirectory, 'locked.jpg'), 'old')
  f.state.oldProfilePicPath = 'locked.jpg'
  assert.deepEqual(
    await f.portalIdentity.saveProfilePhoto(
      'SELF001',
      uploadedFile(f.uploadDirectory, 'three.png')
    ),
    { cleanupPending: true }
  )
  assert.equal(fs.existsSync(path.join(f.uploadDirectory, 'three.png')), true)
})

async function httpFixture(t) {
  const f = databaseFixture(t)
  const sessions = createSessions('portal-profile-tests-only-key')
  const token = sessions.issue({
    employeeCode: 'SELF001',
    userAccount: 'self',
    domain: 'alkholi',
  })
  let registered = true
  const auth = createAuth({
    sessions,
    repository: { isRegistered: async () => registered },
    adAuth: async () => {},
    cipher: {},
  })
  fs.writeFileSync(path.join(f.uploadDirectory, 'profile.png'), pngHeader)
  const app = express()
  app.use(
    '/portal-api',
    createApi({
      authorize: auth.authorize,
      portalIdentity: f.portalIdentity,
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
  const base = `http://127.0.0.1:${server.address().port}/portal-api`
  async function request(suffix, options = {}) {
    const headers = { ...(options.headers || {}) }
    if (options.auth !== false) headers.Authorization = `Bearer ${token}`
    const response = await fetch(base + suffix, { ...options, headers })
    const contentType = response.headers.get('content-type') || ''
    return {
      status: response.status,
      body: contentType.includes('application/json')
        ? await response.json()
        : Buffer.from(await response.arrayBuffer()),
    }
  }
  return {
    ...f,
    request,
    setRegistered(value) {
      registered = value
    },
  }
}

test('HTTP handlers ignore spoofed IDs and reject missing or revoked sessions', async (t) => {
  const f = await httpFixture(t)
  const json = { 'Content-Type': 'application/json' }
  assert.equal(
    (
      await f.request('/get-user-profile?employeeID=OTHER', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ employeeID: 'OTHER', employeeCode: 'OTHER' }),
      })
    ).status,
    200
  )
  assert.equal(
    (
      await f.request('/get-user-authorizations?employeeID=OTHER', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ employeeID: 'OTHER' }),
      })
    ).status,
    200
  )
  assert.deepEqual(
    await f.request('/my-business-card?employeeID=OTHER&query=SELECT+*'),
    { status: 200, body: { hasCard: false, qrCodePath: null } }
  )
  f.state.cardRows = [{ qrCodePath: 'self-qr.png' }]
  assert.deepEqual(await f.request('/my-business-card'), {
    status: 200,
    body: { hasCard: true, qrCodePath: 'self-qr.png' },
  })
  assert.ok(
    f.calls.every(
      (call) => call.inputs.employeeCode.value === 'SELF001'
    )
  )

  for (const endpoint of [
    ['/get-user-profile', 'POST'],
    ['/get-user-authorizations', 'POST'],
    ['/my-business-card', 'GET'],
  ]) {
    const response = await f.request(endpoint[0], {
      method: endpoint[1],
      auth: false,
    })
    assert.deepEqual(response, {
      status: 401,
      body: { message: 'authFailed' },
    })
  }
  f.setRegistered(false)
  assert.deepEqual(await f.request('/my-business-card'), {
    status: 401,
    body: { message: 'authFailed' },
  })
  f.setRegistered(true)
  f.state.failAt = PROFILE_QUERY
  assert.deepEqual(
    await f.request('/get-user-profile', { method: 'POST' }),
    { status: 503, body: { message: 'serviceUnavailable' } }
  )
})

test('upload authenticates first, ignores multipart identity, and rejects bad files', async (t) => {
  const f = await httpFixture(t)
  const initialFiles = fs.readdirSync(f.uploadDirectory).sort()

  const unauthorizedForm = new FormData()
  unauthorizedForm.append(
    'attachment',
    new Blob([pngHeader], { type: 'image/png' }),
    'other.png'
  )
  unauthorizedForm.append('employeeCode', 'OTHER')
  assert.equal(
    (
      await f.request('/save-user-profile', {
        method: 'POST',
        body: unauthorizedForm,
        auth: false,
      })
    ).status,
    401
  )
  assert.deepEqual(fs.readdirSync(f.uploadDirectory).sort(), initialFiles)

  const validForm = new FormData()
  validForm.append(
    'attachment',
    new Blob([pngHeader], { type: 'image/png' }),
    'other-employee.png'
  )
  validForm.append('employeeCode', 'OTHER')
  assert.deepEqual(
    await f.request('/save-user-profile?employeeID=OTHER', {
      method: 'POST',
      body: validForm,
    }),
    { status: 201, body: { message: 'imgSuccess', cleanupPending: false } }
  )
  const photoCall = f.calls.at(-1)
  assert.equal(photoCall.inputs.employeeCode.value, 'SELF001')
  assert.match(
    photoCall.inputs.profilePicPath.value,
    /^\d+-[0-9a-f-]{36}\.png$/
  )
  assert.doesNotMatch(photoCall.inputs.profilePicPath.value, /other/i)

  const countAfterSuccess = fs.readdirSync(f.uploadDirectory).length
  const invalidSignature = new FormData()
  invalidSignature.append(
    'attachment',
    new Blob(['not an image'], { type: 'image/png' }),
    'fake.png'
  )
  assert.deepEqual(
    await f.request('/save-user-profile', {
      method: 'POST',
      body: invalidSignature,
    }),
    { status: 400, body: { message: 'invalidUpload' } }
  )
  assert.equal(fs.readdirSync(f.uploadDirectory).length, countAfterSuccess)

  const invalidType = new FormData()
  invalidType.append(
    'attachment',
    new Blob(['text'], { type: 'text/plain' }),
    'fake.txt'
  )
  assert.deepEqual(
    await f.request('/save-user-profile', {
      method: 'POST',
      body: invalidType,
    }),
    { status: 400, body: { message: 'fileTypeError' } }
  )
  assert.deepEqual(
    await f.request('/save-user-profile', { method: 'POST' }),
    { status: 400, body: { message: 'invalidUpload' } }
  )

  const oversized = new FormData()
  oversized.append(
    'attachment',
    new Blob([Buffer.alloc(5242881)], { type: 'image/png' }),
    'large.png'
  )
  assert.deepEqual(
    await f.request('/save-user-profile', {
      method: 'POST',
      body: oversized,
    }),
    { status: 400, body: { message: 'fileTooLarge' } }
  )
  assert.equal(fs.readdirSync(f.uploadDirectory).length, countAfterSuccess)

  f.state.failAt = PROFILE_PHOTO_QUERY
  const databaseFailure = new FormData()
  databaseFailure.append(
    'attachment',
    new Blob([pngHeader], { type: 'image/png' }),
    'database-failure.png'
  )
  assert.deepEqual(
    await f.request('/save-user-profile', {
      method: 'POST',
      body: databaseFailure,
    }),
    { status: 503, body: { message: 'serviceUnavailable' } }
  )
  assert.equal(fs.readdirSync(f.uploadDirectory).length, countAfterSuccess)
})

test('profile fallback file and unknown-route behavior remain available', async (t) => {
  const f = await httpFixture(t)
  const fallback = await f.request('/profile-data/profile.png', {
    auth: false,
  })
  assert.equal(fallback.status, 200)
  assert.deepEqual(fallback.body, pngHeader)
  assert.deepEqual(await f.request('/unknown', { auth: false }), {
    status: 404,
    body: { message: 'notFound' },
  })
})

function frontendFixture() {
  const values = new Map([['userToken', 'session-token']])
  const localStorage = {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
  const cache = new Map()
  function load(relative) {
    let filename = path.resolve(root, relative)
    if (!fs.existsSync(filename)) filename += '.js'
    let source = fs.readFileSync(filename, 'utf8')
    if (filename.endsWith('.vue'))
      source = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    const compiled = babel.transformSync(source, {
      configFile: false,
      babelrc: false,
      plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
    }).code
    const module = { exports: {} }
    const localRequire = (specifier) => {
      if (specifier === 'vuex') return { mapState: () => ({}) }
      if (specifier === 'vee-validate')
        return { extend() {}, localize() {} }
      if (specifier === 'vee-validate/dist/rules')
        return { image: {}, size: {}, required: {} }
      if (specifier.startsWith('~/')) return load(specifier.slice(2))
      return require(specifier)
    }
    vm.runInNewContext(compiled, {
      module,
      exports: module.exports,
      require: localRequire,
      localStorage,
      FormData,
      Buffer,
    })
    cache.set(filename, module.exports)
    return module.exports
  }
  return { load, localStorage, values }
}

test('portal store sends no identity and retains photo fallback and late-response guards', async () => {
  const f = frontendFixture()
  const portal = f.load('store/portal/index.js')
  const state = portal.state()
  const runtime = {
    $config: { baseURL: 'https://portal.invalid' },
    app: {
      i18n: {
        te: () => true,
        t: (key) => key,
      },
    },
  }

  portal.mutations.SET_USER_PROFILE_DATA.call(runtime, state, {
    profilePicPath: 'profile.png',
    portalProfilePicPath: null,
  })
  assert.equal(
    state.profilePicPath,
    'https://portal.invalid/portal-api/profile-data/profile.png'
  )
  portal.mutations.SET_USER_PROFILE_DATA.call(runtime, state, {
    profilePicPath: 'hr.png',
    portalProfilePicPath: null,
  })
  assert.match(state.profilePicPath, /MenaImages\/Employees_Pictures\/hr\.png$/)
  portal.mutations.SET_USER_PROFILE_DATA.call(runtime, state, {
    profilePicPath: 'hr.png',
    portalProfilePicPath: 'portal.png',
  })
  assert.equal(
    state.profilePicPath,
    'https://portal.invalid/portal-api/profile-data/portal.png'
  )

  const posts = []
  let resolveProfile
  runtime.$axios = {
    post(url, body) {
      posts.push({ url, body })
      return new Promise((resolve) => {
        resolveProfile = resolve
      })
    },
  }
  const commits = []
  const pending = portal.actions.getUserProfile.call(runtime, {
    commit: (...args) => commits.push(args),
    dispatch: async () => {},
  })
  f.localStorage.removeItem('userToken')
  resolveProfile({
    data: { profilePicPath: 'other.png', portalProfilePicPath: null },
  })
  assert.equal(await pending, false)
  assert.deepEqual(Object.keys(posts[0].body), [])
  assert.equal(commits.length, 0)

  f.localStorage.setItem('userToken', 'session-token')
  runtime.$axios.post = async (url, body) => {
    posts.push({ url, body })
    return { data: { isPortalAdmin: true } }
  }
  assert.equal(
    await portal.actions.getUserAuthorizations.call(runtime, {
      commit: (...args) => commits.push(args),
      dispatch: async () => {},
    }),
    true
  )
  assert.deepEqual(Object.keys(posts.at(-1).body), [])

  let resolveAuthorizations
  runtime.$axios.post = (url, body) => {
    posts.push({ url, body })
    return new Promise((resolve) => {
      resolveAuthorizations = resolve
    })
  }
  const commitCount = commits.length
  const lateAuthorizations = portal.actions.getUserAuthorizations.call(
    runtime,
    {
      commit: (...args) => commits.push(args),
      dispatch: async () => {},
    }
  )
  f.localStorage.removeItem('userToken')
  resolveAuthorizations({ data: { isPortalAdmin: false } })
  assert.equal(await lateAuthorizations, false)
  assert.equal(commits.length, commitCount)

  f.localStorage.setItem('userToken', 'session-token')
  const uploads = []
  const axios = async (options) => {
    uploads.push(options)
    return { status: 201, data: { message: 'imgSuccess' } }
  }
  runtime.$axios = axios
  const dispatched = []
  const image = new Blob([pngHeader], { type: 'image/png' })
  assert.equal(
    await portal.actions.saveUserProfile.call(
      runtime,
      {
        dispatch: async (...args) => dispatched.push(args),
      },
      image
    ),
    true
  )
  assert.equal(uploads[0].data.get('attachment').size, image.size)
  assert.equal(uploads[0].data.get('attachment').type, image.type)
  assert.equal(uploads[0].data.get('employeeCode'), null)
  assert.equal(uploads[0].data.get('employeeID'), null)
  assert.equal(uploads[0].headers, undefined)
  assert.equal(dispatched[0][0], 'appNotifications/addNotification')
})

test('profile component uses only the self-card endpoint and ignores stale card responses', async () => {
  const f = frontendFixture()
  const component = f.load('components/portal/userProfile.vue').default
  const notifications = []
  const context = {
    cardRequestId: 0,
    qrFileName: null,
    $config: { baseURL: 'https://portal.invalid' },
    $store: {
      app: {
        i18n: {
          te: () => true,
          t: (key) => key,
        },
      },
      dispatch: async (...args) => notifications.push(args),
    },
  }
  const getCalls = []
  context.$axios = {
    get: async (url) => {
      getCalls.push(url)
      return { data: { hasCard: true, qrCodePath: 'self-qr.png' } }
    },
  }
  await component.methods.checkQR.call(context)
  assert.deepEqual(getCalls, [
    'https://portal.invalid/portal-api/my-business-card',
  ])
  assert.equal(context.qrFileName, 'self-qr.png')

  context.$axios.get = async () => ({
    data: { hasCard: false, qrCodePath: null },
  })
  await component.methods.checkQR.call(context)
  assert.equal(context.qrFileName, null)

  let resolveCard
  context.$axios.get = () =>
    new Promise((resolve) => {
      resolveCard = resolve
    })
  const pending = component.methods.checkQR.call(context)
  f.localStorage.removeItem('userToken')
  resolveCard({ data: { hasCard: true, qrCodePath: 'late.png' } })
  await pending
  assert.equal(context.qrFileName, null)
  assert.equal(notifications.length, 0)

  const source = fs.readFileSync(
    path.join(root, 'components/portal/userProfile.vue'),
    'utf8'
  )
  assert.doesNotMatch(source, /business-cards-api\/sql-call|\bquery\s*:/)
})
