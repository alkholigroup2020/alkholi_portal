const { createHash } = require('crypto')

// A content version avoids a schema migration. All reads and locked writes
// select these same fields, including the unused short-month day columns.
const DAY_COLUMNS = Object.freeze([
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
  12, 13, 14, 15, 16, 17, 18, 19, 20,
])
const VERSION_FIELDS = [
  'id',
  'EmployeeCode',
  'employeeName',
  'employeePicture',
  'ManagerCode',
  'StartDate',
  'EndDate',
  'ModifiedDate',
  'ModifiedBy',
  'ApprovalStatus',
  'DeclineMessage',
  'DeclineFlag',
  ...DAY_COLUMNS,
]
const ENTRY_FIELDS = VERSION_FIELDS.map((field) => `[${field}]`).join(', ')

function entryVersion(row) {
  return row
    ? createHash('sha256')
        .update(
          JSON.stringify(VERSION_FIELDS.map((field) => row[field] ?? null))
        )
        .digest('hex')
    : null
}

module.exports = { DAY_COLUMNS, ENTRY_FIELDS, entryVersion }
