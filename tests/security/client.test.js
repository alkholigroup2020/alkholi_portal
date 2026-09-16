const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const babel = require('@babel/core')
const Vue = require('vue')
const Vuex = require('vuex')

Vue.use(Vuex)
const root = path.resolve(__dirname, '../..')
const loginResponse = {
  token: 'test-only-token',
  domain: 'alkholi',
  userAccount: 'test',
  user: { mail: 'test@example.invalid', cn: 'Test' },
  managerInfo: { Email: 'manager@example.invalid' },
  moreInfo: {
    employee_code: '123',
    branch_code: 'B',
    title: 'Title',
    title_a: 'عنوان',
    employee_name_a: 'اسم',
    employee_picture: 'profile.png',
    Manager_Code: '456',
    first_name_a: 'اسم',
    second_name_a: 'ثان',
  },
}

function fixture() {
  const values = new Map()
  const localStorage = {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
  const cache = new Map()
  function load(relative) {
    let filename = path.resolve(root, relative)
    if (!fs.existsSync(filename)) filename += '.js'
    if (fs.statSync(filename).isDirectory())
      filename = path.join(filename, 'index.js')
    if (cache.has(filename)) return cache.get(filename)
    let source = fs.readFileSync(filename, 'utf8')
    if (filename.endsWith('.vue'))
      source = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    const compiled = babel.transformSync(source, {
      configFile: false,
      babelrc: false,
      plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
    }).code
    const module = { exports: {} }
    cache.set(filename, module.exports)
    const localRequire = (specifier) => {
      if (specifier === 'vee-validate') return { extend() {}, localize() {} }
      if (specifier === 'vee-validate/dist/rules') return { required: {} }
      if (specifier.startsWith('~/')) return load(specifier.slice(2))
      if (specifier.startsWith('.'))
        return load(path.resolve(path.dirname(filename), specifier))
      return require(specifier)
    }
    vm.runInNewContext(
      compiled,
      {
        module,
        exports: module.exports,
        require: localRequire,
        localStorage,
        process: { client: true },
        setTimeout,
      },
      { filename }
    )
    return module.exports
  }
  const modules = {}
  for (const feature of [
    'login',
    'portal',
    'businessCards',
    'coc',
    'dtr',
    'appNotifications',
  ]) {
    modules[feature] = { namespaced: true, ...load(`store/${feature}`) }
  }
  const adminModules = {}
  for (const feature of [
    'portalAdmins',
    'businessCardsAdmins',
    'cocAdmins',
    'elevatorsAdmins',
    'hrSurveys',
    'dtrUsers',
    'dtrSetup',
  ]) {
    adminModules[feature] = {
      namespaced: true,
      ...load(`store/administration/${feature}.js`),
    }
  }
  modules.administration = { namespaced: true, modules: adminModules }
  const store = new Vuex.Store({ ...load('store/index.js'), modules })
  const calls = []
  const routes = []
  let post = async (url) => {
    if (url.endsWith('/login')) return { status: 200, data: loginResponse }
    if (url.endsWith('/reauthenticate'))
      return {
        status: 200,
        data: {
          message: loginResponse.user.mail,
          employeeCode: '123',
          domain: 'alkholi',
          userAccount: 'test',
        },
      }
    if (url.endsWith('/get-user-profile'))
      return {
        status: 200,
        data: { profilePicPath: 'profile.png', portalProfilePicPath: null },
      }
    return {
      status: 200,
      data: { isPortalAdmin: true, isBusinessCardsAdmin: true },
    }
  }
  store.$config = { baseURL: '' }
  store.$axios = {
    defaults: { headers: { common: {} } },
    post: (url, body, options) => {
      calls.push({
        url,
        body,
        options,
        authorization: store.$axios.defaults.headers.common.Authorization,
      })
      return post(url, body, options)
    },
  }
  store.app = { i18n: { te: () => false, t: (key) => key } }
  store.$router = {
    push: async (route) => {
      routes.push(route)
    },
  }
  store.localePath = (route) => '/ar' + (route === '/' ? '' : route)
  return {
    store,
    localStorage,
    calls,
    routes,
    load,
    setPost: (implementation) => {
      post = implementation
    },
  }
}

test('successful login hydrates profile and permissions, while network failure cannot appear successful', async () => {
  const f = fixture()
  assert.equal(await f.store.dispatch('login/logInUser', {}), true)
  assert.equal(f.store.state.login.userIsLoggedIn, true)
  assert.equal(f.store.state.portal.isPortalAdmin, true)
  assert.match(f.store.state.portal.profilePicPath, /profile.png$/)
  assert.equal(f.routes.length, 0)
  f.setPost(async () => {
    throw new Error('offline')
  })
  assert.equal(await f.store.dispatch('login/logInUser', {}), false)
  assert.equal(f.store.state.login.userIsLoggedIn, false)
  assert.equal(f.localStorage.getItem('userToken'), null)
  assert.equal(
    f.store.state.appNotifications.notifications.at(-1).message,
    'errorMessages.login.serviceUnavailable'
  )
})

test('refresh attaches bearer before reauthentication and replaces untrusted cached identity', async () => {
  const f = fixture()
  f.localStorage.setItem('userToken', 'existing-test-token')
  f.localStorage.setItem('employeeCode', 'someone-else')
  assert.equal(
    await f.store.dispatch('login/reAuthenticate', {
      mail: 'spoof@example.invalid',
    }),
    true
  )
  assert.equal(f.calls[0].authorization, 'Bearer existing-test-token')
  assert.deepEqual(Object.keys(f.calls[0].body), [])
  assert.equal(f.localStorage.getItem('employeeCode'), '123')
  assert.equal(f.calls[1].body.employeeID, '123')
})

test('logout immediately clears identity, profile, permissions and module caches even offline', async () => {
  const f = fixture()
  await f.store.dispatch('login/logInUser', {})
  f.store.state.administration.portalAdmins.portalAdmins = [
    { employee: 'private' },
  ]
  f.store.state.administration.dtrSetup.employeeInfo = { private: true }
  f.store.state.businessCards.userCardID = 'private'
  f.store.state.dtr.dtrAppStartDate = 'private'
  f.localStorage.setItem('colorMode', 'dark')
  let fail
  f.setPost(
    () =>
      new Promise((resolve, reject) => {
        fail = reject
      })
  )
  const pending = f.store.dispatch('login/logoff', { token: 'someone-else' })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(f.store.state.login.userIsLoggedIn, false)
  assert.equal(f.store.state.portal.isPortalAdmin, undefined)
  assert.equal(f.store.state.portal.profilePicPath, '')
  assert.equal(f.store.state.administration.portalAdmins.portalAdmins.length, 0)
  assert.deepEqual(
    Object.keys(f.store.state.administration.dtrSetup.employeeInfo),
    []
  )
  assert.equal(f.store.state.businessCards.userCardID, undefined)
  assert.equal(f.store.state.dtr.dtrAppStartDate, undefined)
  for (const name of [
    'userToken',
    'userAccount',
    'employeeCode',
    'branchCode',
    'titleEnglish',
    'titleArabic',
    'profilePicPath',
  ]) {
    assert.equal(f.localStorage.getItem(name), null)
  }
  assert.equal(f.store.$axios.defaults.headers.common.Authorization, '')
  assert.equal(f.localStorage.getItem('colorMode'), 'dark')
  const request = f.calls.at(-1)
  assert.equal(request.options.headers.Authorization, 'Bearer test-only-token')
  assert.deepEqual(Object.keys(request.body), [])
  fail(new Error('offline'))
  await pending
  assert.equal(f.routes.at(-1), '/ar/login')
  assert.equal(
    f.store.state.appNotifications.notifications.at(-1).message,
    'errorMessages.login.logoutUnavailable'
  )
})

test('missing and rejected sessions clear cached state and return to localized login', async () => {
  const f = fixture()
  assert.equal(await f.store.dispatch('login/reAuthenticate'), false)
  assert.equal(f.calls.length, 0)
  assert.equal(f.routes.at(-1), '/ar/login')
  f.localStorage.setItem('userToken', 'legacy-token')
  f.setPost(async () => {
    throw Object.assign(new Error('unauthorized'), {
      response: { status: 401, data: { message: 'authFailed' } },
    })
  })
  assert.equal(await f.store.dispatch('login/reAuthenticate'), false)
  assert.equal(f.localStorage.getItem('userToken'), null)
  assert.equal(f.store.state.login.userIsLoggedIn, false)
})

test('late login and reauthentication responses cannot restore a logged-out session', async () => {
  for (const action of ['logInUser', 'reAuthenticate']) {
    const f = fixture()
    if (action === 'reAuthenticate')
      f.localStorage.setItem('userToken', 'existing')
    let complete
    f.setPost((url) =>
      url.endsWith('/logoff')
        ? Promise.resolve({ status: 200 })
        : new Promise((resolve) => {
            complete = resolve
          })
    )
    const pending = f.store.dispatch(`login/${action}`, {})
    await new Promise((resolve) => setImmediate(resolve))
    await f.store.dispatch('login/logoff')
    complete({ status: 200, data: loginResponse })
    assert.equal(await pending, false)
    assert.equal(f.store.state.login.userIsLoggedIn, false)
    assert.equal(f.localStorage.getItem('userToken'), null)
  }
})

test('login form navigates once on success, preserves localized CoC return, and never redirects on failure', async () => {
  const f = fixture()
  const loginUser = f.load('components/login/LoginForm.vue').default.methods
    .loginUser
  for (const locale of ['en', 'ar']) {
    for (const success of [true, false]) {
      let finished = 0
      const destinations = []
      const context = {
        submitting: false,
        userAccount: 'TEST',
        userPassword: ' Keep Case ',
        domain: 'Alkholi',
        localePath: (route) => (locale === 'en' ? route : '/ar' + route),
        $nuxt: {
          context: { from: { path: '/ar/code-of-conduct/coc-form' } },
          $loading: {
            start() {},
            finish() {
              finished++
            },
          },
        },
        $store: {
          dispatch: async (action, body) => {
            assert.equal(body.dc_ip, undefined)
            assert.equal(body.password, ' Keep Case ')
            return success
          },
        },
        $router: {
          push: async (route) => {
            destinations.push(route)
          },
        },
      }
      await loginUser.call(context)
      assert.deepEqual(
        destinations,
        success ? [context.localePath('/code-of-conduct/coc-form')] : []
      )
      assert.equal(finished, 1)
      assert.equal(context.submitting, false)
    }
  }
})

test('a failed profile request stops login completion without dereferencing a missing response', async () => {
  const f = fixture()
  f.setPost(async (url) => {
    if (url.endsWith('/login')) return { status: 200, data: loginResponse }
    if (url.endsWith('/get-user-profile')) throw new Error('offline')
    return { status: 200, data: {} }
  })
  assert.equal(await f.store.dispatch('login/logInUser', {}), false)
  assert.equal(f.store.state.login.userIsLoggedIn, false)
  assert.equal(f.routes.at(-1), '/ar/login')
})
