// import colors from 'vuetify/es5/util/colors'

export default {
  // Global page headers: https://go.nuxtjs.dev/config-head
  head: {
    // titleTemplate: '%s - alkholi_portal',
    title: 'Alkholi Portal',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: '' },
      { name: 'format-detection', content: 'telephone=no' },
    ],
    link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
  },

  // Global CSS: https://go.nuxtjs.dev/config-css
  css: [
    // SCSS file in the project
    '@/assets/css/main.scss',
  ],

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: [
    { src: '@/plugins/vee-validate.js' },
    { src: '@/plugins/chart.js', mode: 'client' },
    { src: '@/plugins/vue-pdf-embed.client.js', mode: 'client' },
  ],

  // Auto import components: https://go.nuxtjs.dev/config-components
  components: {
    dirs: [
      '~/components',
      '~/components/portal',
      '~/components/businessCards',
      '~/components/coc',
      '~/components/portal/shortcuts',
      '~/components/appNotifications',
      '~/components/administration/authControlledApps',
      '~/components/administration/dtrSetup',
      '~/components/hrSurveys',
      '~/components/dtr/dtr-table',
    ],
  },

  // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules
  buildModules: [
    // https://go.nuxtjs.dev/eslint
    '@nuxtjs/eslint-module',
    // https://go.nuxtjs.dev/vuetify
    '@nuxtjs/vuetify',
    '@nuxtjs/google-fonts',
  ],

  googleFonts: {
    // download: true,
    families: {
      Cairo: [300, 400, 500, 600],
      Tajawal: [200, 300, 400, 500, 700],
    },
  },

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
    // https://go.nuxtjs.dev/axios
    '@nuxtjs/axios',
    // https://go.nuxtjs.dev/pwa
    '@nuxtjs/pwa',
    '@nuxtjs/i18n',
  ],

  i18n: {
    /* module options */
    locales: [
      {
        code: 'en',
        iso: 'en-US',
        file: 'en.json',
        dir: 'ltr',
        name: 'english',
      },
      {
        code: 'ar',
        iso: 'ar-SA',
        file: 'ar.json',
        dir: 'rtl',
        name: 'العربية',
      },
    ],
    lazy: true,
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      onlyOnRoot: true,
      alwaysRedirect: true,
      fallbackLocale: 'en',
      redirectOn: 'root',
    },
    defaultLocale: 'en',
    langDir: 'locales',
    vueI18n: {
      fallbackLocale: 'en',
    },
  },

  // Axios module configuration: https://go.nuxtjs.dev/config-axios
  axios: {},

  // PWA module configuration: https://go.nuxtjs.dev/pwa
  pwa: {
    manifest: {
      lang: 'en',
    },
  },

  // Vuetify module configuration: https://go.nuxtjs.dev/config-vuetify
  vuetify: {
    customVariables: ['~/assets/variables.scss'],
    treeShake: true,
    theme: {
      dark: false,
      themes: {
        light: {
          primary: '#000046',
          mainBG: '#E6E6ED',
          secondaryBG: '#F7F7F6',
          primaryText: '#000046',
          whiteColor: '#FFF',
        },
        dark: {
          primary: '#00001c',
          mainBG: '#00002a',
          secondaryBG: '#000034',
          primaryText: '#FFF',
          whiteColor: '#00001c',
        },
      },
    },
  },

  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {
    transpile: ['vee-validate', 'vue-pdf-embed'],
  },

  serverMiddleware: [
    '~server/login/main.js',
    '~server/portal/main.js',
    '~server/administration/main.js',
    '~server/businessCards/main.js',
    '~server/elevatorsSurveys/main.js',
    '~server/coc/main.js',
    '~server/hrSurveys/main.js',
    '~server/dtr/main.js',
  ],

  // client side expose
  publicRuntimeConfig: {
    baseURL:
      process.env.NODE_ENV === 'production'
        ? process.env.baseURL_prod
        : process.env.baseURL_dev,

    hrPictureURL: process.env.hrPictureURL,
  },

  loading: '@/components/spinners/RadarSpinner.vue',

  server: {
    port: 3000,
    host: 'localhost',
  },
}
