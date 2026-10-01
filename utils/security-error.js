const CODES = new Set([
  'invalidRequest',
  'forbidden',
  'stateConflict',
  'serviceUnavailable',
  'notFound',
  'authFailed',
])

function securityMessage(error, translate) {
  const code = error?.response?.data?.message
  if (code === 'Duplicate Contract ID')
    return translate('security.duplicateContract')
  if (code === 'inactiveEmployee')
    return translate('codeOfConduct.cocForm.inactiveEmployee')
  return translate(`security.${CODES.has(code) ? code : 'serviceUnavailable'}`)
}

module.exports = { securityMessage }
