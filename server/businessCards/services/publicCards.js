// Verified against businessCards.employeeData metadata on 2026-09-16.
const EMPLOYEE_CODE_MAX_LENGTH = 20
const PUBLIC_FIELDS = Object.freeze([
  'employeeID',
  'company',
  'companyLogo',
  'profilePic',
  'fullName_a',
  'fullName_e',
  'arabicTitle',
  'title',
  'mobileNumber',
  'landLines',
  'faxLine',
  'mailAddress',
  'webSite',
  'mainColor',
])

const PUBLIC_CARD_QUERY = `SELECT TOP (2)
  employeeID, company, companyLogo, profilePic, fullName_a, fullName_e,
  arabicTitle, title, mobileNumber, landLines, faxLine, mailAddress,
  webSite, mainColor
  FROM businessCards.employeeData WHERE employeeID = @employeeCode`

class PublicCardError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.statusCode = statusCode
  }
}

function createPublicCards({ sql, portalConfig }) {
  return {
    async getPublicCard(employeeCode) {
      if (
        typeof employeeCode !== 'string' ||
        employeeCode.length < 1 ||
        employeeCode.length > EMPLOYEE_CODE_MAX_LENGTH ||
        /[^A-Za-z0-9_-]/.test(employeeCode)
      ) {
        throw new PublicCardError('invalidEmployeeCode', 400)
      }

      const pool = new sql.ConnectionPool(portalConfig)
      try {
        await pool.connect()
        const { recordset } = await pool
          .request()
          .input(
            'employeeCode',
            sql.VarChar(EMPLOYEE_CODE_MAX_LENGTH),
            employeeCode
          )
          .query(PUBLIC_CARD_QUERY)
        if (!recordset.length) throw new PublicCardError('cardNotFound', 404)
        // Never arbitrarily publish one of several ambiguous records.
        if (recordset.length !== 1)
          throw new PublicCardError('serviceUnavailable', 503)
        return Object.fromEntries(
          PUBLIC_FIELDS.map((field) => [field, recordset[0][field]])
        )
      } finally {
        // Cleanup must also run after connect/query failure, preserving the error.
        await pool.close().catch(() => {})
      }
    },
  }
}

module.exports = { createPublicCards, PublicCardError, PUBLIC_FIELDS }
