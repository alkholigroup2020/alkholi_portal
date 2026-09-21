const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const express = require('express')
const babel = require('@babel/core')
const Vue = require('vue')
const compiler = require('vue-template-compiler')
const Vuetify = require('vuetify')
const createApi = require('../../server/businessCards/createApi')
const {
  createPublicCards,
  PUBLIC_FIELDS,
} = require('../../server/businessCards/services/publicCards')
const { createAuth } = require('../../server/login/services/auth')
const { createSessions } = require('../../server/login/services/session')

Vue.use(Vuetify)
const root = path.resolve(__dirname, '../..')
const layouts = {
  'Alkholi Group': 'alkholiGroup',
  'AKSTRA Consulting': 'akstraConsulting',
  AKTEK: 'aktek',
  Custom: 'customLayout',
  'AMOS & SBTMC Manager': 'amosAndSBTMCManager',
  BTECO: 'bteco',
  'Alkholi Holding': 'alkholiHolding',
  UPMOC: 'upmoc',
  'MX Reality': 'mxReality',
}
const sample = {
  employeeID: '00123',
  company: 'Alkholi Group',
  companyLogo: 'undefined',
  profilePic: 'profile.png',
  fullName_a: 'اسم تجريبي',
  fullName_e: 'Example Person',
  arabicTitle: 'عنوان تجريبي',
  title: 'Example Title',
  mobileNumber: '+000000000',
  landLines: '11 0000000 - 12 0000000',
  faxLine: '11 0000000',
  mailAddress: 'example@example.invalid',
  webSite: 'https://example.invalid',
  mainColor: '#123456',
}

function databaseFixture() {
  const calls = []
  const pools = []
  const state = { rows: [sample], failAt: null }
  class ConnectionPool {
    constructor() {
      this.closed = false
      pools.push(this)
    }

    async connect() {
      if (state.failAt === 'connect')
        throw new Error('private connection detail')
    }

    async close() {
      this.closed = true
      if (state.failAt === 'close') throw new Error('private cleanup detail')
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
          if (state.failAt === 'query') throw new Error('private SQL detail')
          return { recordset: state.rows }
        },
      }
    }
  }
  const sql = {
    ConnectionPool,
    VarChar: (length) => ({ name: 'varchar', length }),
  }
  return {
    calls,
    pools,
    state,
    sql,
    publicCards: createPublicCards({ sql, portalConfig: {} }),
  }
}

// Load the actual remaining SQL router with injected dependencies, never runtime
// config, .env, the full app entry point, or a production auth/SQL connection.
function legacyRouter(sql, authorize) {
  const filename = path.join(root, 'server/businessCards/router/sqlCalls.js')
  const module = { exports: {} }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module,
    require(name) {
      if (name === 'express') return express
      if (name === 'mssql') return sql
      if (name === '../middleware/authorization') return authorize
      if (name === '../configs/sql' || name === '../configs/hrSQL') return {}
      throw new Error(`Unexpected dependency: ${name}`)
    },
  })
  return module.exports
}

async function httpFixture(t) {
  const f = databaseFixture()
  const sessions = createSessions('public-card-tests-only-key')
  let authorizationChecks = 0
  const auth = createAuth({
    sessions,
    repository: {
      isRegistered: async () => {
        authorizationChecks++
        return true
      },
    },
    adAuth: async () => {},
    cipher: {},
  })
  const app = express()
  app.use(
    '/business-cards-api',
    createApi({
      publicCards: f.publicCards,
      businessCards: express.Router(),
      vCard: express.Router(),
      sqlCalls: legacyRouter(f.sql, auth.authorize),
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
  async function request(suffix, options = {}) {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/business-cards-api${suffix}`,
      options
    )
    return { status: response.status, body: await response.json() }
  }
  return {
    ...f,
    request,
    sessions,
    authorizationChecks: () => authorizationChecks,
  }
}

test('public lookup binds string IDs and explicitly projects only template fields', async () => {
  const f = databaseFixture()
  f.state.rows = [
    { ...sample, qrCodePath: 'private.png', managerCode: 'private' },
  ]
  for (const id of ['00123', 'X12345', 'Ab_-09', '0'.repeat(20)]) {
    assert.deepEqual(await f.publicCards.getPublicCard(id), sample)
    assert.deepEqual(f.calls.at(-1).inputs, {
      employeeCode: { type: { name: 'varchar', length: 20 }, value: id },
    })
  }
  assert.equal(new Set(f.calls.map((call) => call.statement)).size, 1)
  assert.doesNotMatch(
    f.calls[0].statement,
    /SELECT\s+\*|qrCodePath|managerCode/i
  )
  assert.match(f.calls[0].statement, /WHERE employeeID = @employeeCode/)
  const selectedFields = f.calls[0].statement
    .match(/SELECT TOP \(2\)([\s\S]*?)FROM/)[1]
    .split(',')
    .map((field) => field.trim())
  assert.deepEqual(selectedFields.sort(), [...PUBLIC_FIELDS].sort())
  assert.ok(f.pools.every((pool) => pool.closed))

  // Each field used by every real template/page must be in the projection.
  const consumers = [
    'pages/business-card/_bcard.vue',
    ...Object.values(layouts).map(
      (name) => `components/businessCards/${name}.vue`
    ),
  ]
  for (const file of consumers) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    for (const [, field] of source.matchAll(/result\.([A-Za-z0-9_]+)/g)) {
      assert.ok(PUBLIC_FIELDS.includes(field), `${file}: missing ${field}`)
    }
  }
})

test('invalid and injection-like IDs fail before allocating a database connection', async () => {
  const f = databaseFixture()
  for (const id of [
    undefined,
    null,
    123,
    {},
    [],
    '',
    '1'.repeat(21),
    "1' OR 1=1--",
    "';DROP TABLE x;--",
    '1/2',
    '1\\2',
    ' 123',
    '123 ',
    '123\n',
    '123\0',
    '١٢٣',
  ]) {
    await assert.rejects(f.publicCards.getPublicCard(id), {
      message: 'invalidEmployeeCode',
      statusCode: 400,
    })
  }
  assert.equal(f.pools.length, 0)
  assert.equal(f.calls.length, 0)
})

test('public HTTP lookup supports every company without a token or administrator role', async (t) => {
  const f = await httpFixture(t)
  for (const company of Object.keys(layouts)) {
    f.state.rows = [{ ...sample, company, qrCodePath: 'not-public' }]
    const result = await f.request('/public-cards/00123')
    assert.deepEqual(result, { status: 200, body: { ...sample, company } })
  }
  // A stale bearer from another browser session must not block public viewing.
  assert.equal(
    (
      await f.request('/public-cards/00123', {
        headers: { Authorization: 'Bearer invalid' },
      })
    ).status,
    200
  )
  assert.equal(f.authorizationChecks(), 0)
})

test('mounted HTTP rejects invalid IDs and never accepts query text or identifiers', async (t) => {
  const f = await httpFixture(t)
  for (const id of [
    "1' OR 1=1--",
    'a'.repeat(21),
    'abc/def',
    'abc\n',
    ' abc',
  ]) {
    assert.deepEqual(
      await f.request(`/public-cards/${encodeURIComponent(id)}`),
      {
        status: 400,
        body: { message: 'invalidEmployeeCode' },
      }
    )
  }
  assert.deepEqual(await f.request('/public-cards/%E0%A4%A'), {
    status: 400,
    body: { message: 'invalidEmployeeCode' },
  })
  assert.equal(f.calls.length, 0)
  const response = await f.request(
    '/public-cards/00123?query=SELECT%20*&table=usersInfo'
  )
  assert.equal(response.status, 200)
  assert.equal(f.calls.length, 1)
  assert.doesNotMatch(f.calls[0].statement, /usersInfo|SELECT \*/)
})

test('missing, ambiguous and unavailable cards have safe HTTP responses and close pools', async (t) => {
  const f = await httpFixture(t)
  f.state.rows = []
  assert.deepEqual(await f.request('/public-cards/00123'), {
    status: 404,
    body: { message: 'cardNotFound' },
  })
  f.state.rows = [sample, sample]
  assert.deepEqual(await f.request('/public-cards/00123'), {
    status: 503,
    body: { message: 'serviceUnavailable' },
  })
  f.state.rows = [sample]
  for (const failAt of ['connect', 'query']) {
    f.state.failAt = failAt
    assert.deepEqual(await f.request('/public-cards/00123'), {
      status: 503,
      body: { message: 'serviceUnavailable' },
    })
  }
  f.state.failAt = 'close'
  assert.equal((await f.request('/public-cards/00123')).status, 200)
  assert.ok(f.pools.every((pool) => pool.closed))
})

test('retired SQL route is 404 in mounted API; remaining generic routes still require auth', async (t) => {
  const f = await httpFixture(t)
  const token = f.sessions.issue({
    employeeCode: '00123',
    userAccount: 'test',
    domain: 'alkholi',
  })
  for (const suffix of ['/open-sql-call', '/open-sql-call/']) {
    for (const bearer of ['', token]) {
      assert.deepEqual(
        await f.request(suffix, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bearer}`,
          },
          body: JSON.stringify({ query: 'SELECT private FROM private' }),
        }),
        { status: 404, body: { message: 'notFound' } }
      )
    }
  }
  assert.equal((await f.request('/sql-call', { method: 'POST' })).status, 401)
  assert.equal((await f.request('/hr-sql-call')).status, 401)
  assert.equal(f.calls.length, 0)
  assert.equal(f.authorizationChecks(), 0)
})

function loadVue(relative) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
  const parsed = compiler.parseComponent(source)
  const compiled = babel.transformSync(parsed.script.content, {
    configFile: false,
    babelrc: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code
  const module = { exports: {} }
  vm.runInNewContext(compiled, { module, exports: module.exports })
  const render = compiler.compileToFunctions(parsed.template.content)
  return { ...module.exports.default, ...render }
}
const page = loadVue('pages/business-card/_bcard.vue')

function renderHtml(instance) {
  // Import after the client tests: this module sets VUE_ENV=server, which would
  // otherwise disable Vue reactivity in the navigation/race regression test.
  return require('vue-server-renderer')
    .createRenderer()
    .renderToString(instance)
}

function pageFixture(get = async () => ({ data: sample })) {
  return new Vue({
    ...page,
    data: () => ({ ...page.data(), employeeCode: '00123' }),
    beforeCreate() {
      this.$axios = { get }
      this.$config = { baseURL: 'https://example.invalid' }
    },
  })
}

test('public page requests the new GET shape, preserves IDs, and never needs auth state', async () => {
  const calls = []
  const instance = pageFixture(async (...args) => {
    calls.push(args)
    return { data: sample }
  })
  assert.equal(
    page.asyncData({ params: { bcard: '00123' } }).employeeCode,
    '00123'
  )
  await instance.loadPublicCard()
  assert.equal(
    calls[0][0],
    'https://example.invalid/business-cards-api/public-cards/00123'
  )
  assert.equal(calls[0][1].timeout, 15000)
  assert.equal(instance.result.employeeID, '00123')
  assert.equal(instance.loading, false)
  assert.equal(instance.errorKey, null)
})

test('public page translates safe errors, rejects empty/unrenderable data and clears stale cards', async () => {
  for (const [status, key] of [
    [400, 'invalidEmployeeCode'],
    [404, 'cardNotFound'],
    [503, 'serviceUnavailable'],
    [undefined, 'serviceUnavailable'],
  ]) {
    const instance = pageFixture(async () => {
      const error = new Error('private SQL detail')
      if (status)
        error.response = { status, data: { message: 'private SQL detail' } }
      throw error
    })
    instance.result = sample
    await instance.loadPublicCard()
    assert.equal(instance.result, null)
    assert.equal(instance.errorKey, key)
    assert.equal(instance.loading, false)
  }
  for (const data of [null, [], {}, { company: 'unsupported' }]) {
    const instance = pageFixture(async () => ({ data }))
    await instance.loadPublicCard()
    assert.equal(instance.result, null)
    assert.equal(instance.errorKey, 'serviceUnavailable')
  }
})

test('the public URL without an employee ID shows an invalid-link state without querying undefined', async () => {
  let calls = 0
  const instance = pageFixture(async () => {
    calls++
    return { data: sample }
  })
  instance.employeeCode = page.asyncData({ params: {} }).employeeCode
  await Vue.nextTick()
  assert.equal(calls, 0)
  assert.equal(instance.errorKey, 'invalidEmployeeCode')
  assert.equal(instance.loading, false)
  assert.equal(instance.result, null)
})

test('route changes reload cards and late responses cannot overwrite a newer card or destroyed page', async () => {
  const pending = []
  const instance = pageFixture(
    () => new Promise((resolve) => pending.push(resolve))
  )
  const first = instance.loadPublicCard()
  instance.employeeCode = 'X12345'
  await Vue.nextTick()
  assert.equal(pending.length, 2)
  pending[1]({ data: { ...sample, employeeID: 'X12345', company: 'Custom' } })
  await Vue.nextTick()
  pending[0]({ data: sample })
  await first
  assert.equal(instance.result.employeeID, 'X12345')
  const last = instance.loadPublicCard()
  instance.$destroy()
  pending[2]({ data: sample })
  await last
  assert.equal(instance.result, null)
})

test('all real card templates render bilingual fields and original vCard links at both widths', async () => {
  for (const locale of ['en', 'ar']) {
    for (const width of [375, 1280]) {
      for (const [company, name] of Object.entries(layouts)) {
        const components = {}
        for (const [otherCompany, otherName] of Object.entries(layouts)) {
          components[otherName[0].toUpperCase() + otherName.slice(1)] =
            otherCompany === company
              ? loadVue(`components/businessCards/${name}.vue`)
              : { render: (h) => h('div', 'WRONG TEMPLATE') }
        }
        const instance = new Vue({
          ...page,
          components,
          vuetify: new Vuetify({ rtl: locale === 'ar' }),
          data: () => ({
            ...page.data(),
            loading: false,
            result: { ...sample, company },
          }),
          beforeCreate() {
            // Vue prototypes are inherited by the actual child templates.
            Vue.prototype.$config = { baseURL: 'https://example.invalid' }
          },
        })
        instance.$vuetify.breakpoint.width = width
        const html = await renderHtml(instance)
        assert.ok(
          html.includes(sample.fullName_a),
          `${company} ${locale} ${width}`
        )
        assert.ok(html.includes(sample.fullName_e))
        assert.ok(html.includes(sample.arabicTitle))
        assert.ok(html.includes('/business-cards-api/vcard/?employeeID=00123'))
        if (company === 'Custom') assert.ok(html.includes('firstAddress='))
        assert.ok(!html.includes('WRONG TEMPLATE'))
        instance.$destroy()
      }
    }
  }
})

test('loading and error states render in English and Arabic without mounting a card', async () => {
  for (const locale of ['en', 'ar']) {
    const messages = require(`../../locales/${locale}.json`).businessCards
      .publicCard
    for (const key of [
      'loading',
      'invalidEmployeeCode',
      'cardNotFound',
      'serviceUnavailable',
    ]) {
      const instance = new Vue({
        ...page,
        data: () => ({
          ...page.data(),
          loading: key === 'loading',
          errorKey: key,
        }),
        beforeCreate() {
          this.$i18n = { locale }
          this.$t = (key) => messages[key.split('.').pop()]
        },
      })
      const html = await renderHtml(instance)
      assert.ok(html.includes(messages[key]))
      assert.ok(html.includes(`dir="${locale === 'ar' ? 'rtl' : 'ltr'}"`))
      assert.ok(!html.includes('/vcard'))
    }
  }
})
