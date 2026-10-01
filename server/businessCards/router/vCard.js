const path = require('path')
const { randomUUID } = require('crypto')
const vCardsJS = require('vcards-js')
const { safeRouter, text, artifact } = require('../../shared/auditBoundary')

// eslint-disable-next-line no-control-regex
const CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g

function value(input) {
  if (input == null || input === 'undefined') return ''
  return String(input)
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL, '')
}

function phones(input) {
  const source = value(input)
  if (!source) return []
  return source.split(/\s+&\s+/).map((phone) => {
    const match = phone.match(/^\(([^)]+)\)\s*(.+)$/)
    return `+966${match ? match[1] + match[2] : phone}`
  })
}

module.exports = function createVCardRouter({
  publicCards,
  embedPhoto = (card, filename) => card.photo.embedFromFile(filename),
}) {
  const router = safeRouter()
  router.get('/vcard', async (req, res) => {
    // Reuse the same validated, bound, explicitly projected public lookup.
    const employee = await publicCards.getPublicCard(req.query.employeeID)
    const firstAddress =
      req.query.firstAddress === undefined
        ? ''
        : text(req.query.firstAddress, 1000, false, true)
    const secondAddress =
      req.query.secondAddress === undefined
        ? ''
        : text(req.query.secondAddress, 1000, false, true)
    const card = vCardsJS()
    card.firstName = value(employee.fullName_e)
    card.uid = randomUUID()
    card.cellPhone = value(employee.mobileNumber)
    card.title = value(employee.title)
    card.workEmail = value(employee.mailAddress)
    card.source = `https://portal.alkholi.com/business-cards-api/vcard/?employeeID=${encodeURIComponent(
      employee.employeeID
    )}`
    card.isOrganization = false
    if (employee.company === 'Custom') {
      card.workPhone = value(employee.landLines)
      card.email = 'hbkholi@gmail.com'
      card.homeAddress.label = 'Address'
      card.homeAddress.street = firstAddress
      card.workAddress.label = 'Address'
      card.workAddress.street = secondAddress
    } else {
      card.organization = value(employee.company)
      card.url = value(employee.webSite)
      card.workPhone = phones(employee.landLines)
      card.workFax = phones(employee.faxLine)
    }
    if (value(employee.profilePic)) {
      const photoPath = artifact(
        path.join(__dirname, '../../../uploads/businessCards'),
        employee.profilePic
      )
      try {
        await embedPhoto(card, photoPath)
      } catch (error) {
        // Older cards without their photo can still be saved as contacts.
        if (error.code !== 'ENOENT') throw error
      }
    }
    // Header identity comes from the validated lookup key, never stored text.
    res.set('Content-Type', 'text/vcard; charset=utf-8')
    res.set(
      'Content-Disposition',
      `inline; filename="${req.query.employeeID}.vcf"`
    )
    res.set('Cache-Control', 'no-store')
    res.set('X-Content-Type-Options', 'nosniff')
    res.send(card.getFormattedString())
  })
  return router
}
