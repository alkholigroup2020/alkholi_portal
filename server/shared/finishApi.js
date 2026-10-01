// Added after existing static routes; document exposure remains a separate task.
module.exports = function finishApi(api) {
  api.use((req, res) => res.status(404).json({ message: 'notFound' }))
  api.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    const invalid =
      error instanceof URIError ||
      error.type === 'entity.parse.failed' ||
      error.type === 'entity.too.large' ||
      error.name === 'MulterError'
    res
      .status(invalid ? 400 : 503)
      .json({ message: invalid ? 'invalidRequest' : 'serviceUnavailable' })
  })
  return api
}
