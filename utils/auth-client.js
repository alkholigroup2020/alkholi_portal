export function authErrorMessage(store, error, namespace = 'login') {
  const code =
    error &&
    error.response &&
    error.response.data &&
    error.response.data.message
  const key = `errorMessages.${namespace}.${code}`
  const i18n = store.app.i18n
  return i18n.te(key)
    ? i18n.t(key)
    : i18n.t('errorMessages.login.serviceUnavailable')
}

export function loginDestination(fromPath, localePath) {
  return localePath(
    /(?:^|\/)code-of-conduct\/coc-form\/?$/.test(fromPath || '')
      ? '/code-of-conduct/coc-form'
      : '/'
  )
}
