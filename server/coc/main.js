const path = require('path')
const express = require('express')
const cron = require('node-cron') // Add cron dependency
const api = express()
const cocJS = require('./router/cocJS.js')
const dataSync = require('./router/dataSync.js') // Import sync function

api.use(express.json())
api.use(express.urlencoded({ extended: true }))
api.use(cocJS)
// api.use(dataSync.router)
api.use(
  '/coc-versions',
  express.static(path.join(__dirname, '../../uploads/coc/cocVersions'))
)
api.use(
  '/printed-copies',
  express.static(path.join(__dirname, '../../uploads/coc/printedCopies'))
)
api.use(
  '/signed-coc-documents',
  express.static(path.join(__dirname, '../../uploads/coc/combinedDocuments'))
)

// Schedule employee sync every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  // console.log('Starting employee sync at', new Date().toISOString())
  try {
    await dataSync.syncEmployees() // Call the exported sync function
    // console.log('Employee sync completed successfully.')
  } catch (error) {
    console.error('Employee sync failed:', error)
  }
})

module.exports = {
  path: '/coc-api',
  handler: api,
}
