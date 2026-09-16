module.exports = {
  rules: {
    // Mocks retain the asynchronous contract of SQL, LDAP, Axios and Vue Router.
    'require-await': 'off',
  },
}
