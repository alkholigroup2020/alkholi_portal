const test = require('node:test')
const assert = require('node:assert/strict')
const {
  fetchEmployeesFromHR,
  syncToPortalDB,
} = require('../../server/coc/router/dataSync')

function portalFixture({ failOnEmployee } = {}) {
  const calls = []
  const database = {
    request() {
      const inputs = {}
      return {
        input(name, type, value) {
          inputs[name] = value
          return this
        },
        async query(statement) {
          calls.push({ statement, inputs })
          if (failOnEmployee && inputs.employee_id === failOnEmployee)
            throw new Error('simulated upsert failure')
          return { recordset: [] }
        },
      }
    },
  }
  return { database, calls }
}

function employee(employeeCode) {
  return {
    employee_code: employeeCode,
    employee_name_eng: 'Employee',
    employee_name_a: 'موظف',
    branch_code: 'BR1',
    Email: 'employee@example.invalid',
    employee_picture: null,
    position: '1',
    title_e: 'Engineer',
    title_a: 'مهندس',
  }
}

test('CoC sync reconciles current employees after all upserts and preserves old rows', async () => {
  const { database, calls } = portalFixture()
  await syncToPortalDB(database, [employee('ACTIVE1'), employee('ACTIVE2')])

  const reconcile = calls.at(-1)
  assert.match(reconcile.statement, /UPDATE e\s+SET is_active/)
  assert.match(reconcile.statement, /FROM coc\.employees e/)
  assert.doesNotMatch(reconcile.statement, /DELETE/)
  assert.deepEqual(JSON.parse(reconcile.inputs.activeEmployeeIds), [
    'ACTIVE1',
    'ACTIVE2',
  ])
  assert.equal(calls.filter((call) => /UPDATE e\s+SET is_active/.test(call.statement)).length, 1)
})

test('CoC sync does not deactivate employees after an incomplete upsert', async () => {
  const { database, calls } = portalFixture({ failOnEmployee: 'ACTIVE2' })
  await assert.rejects(
    syncToPortalDB(database, [employee('ACTIVE1'), employee('ACTIVE2')]),
    /simulated upsert failure/
  )
  assert.equal(
    calls.some((call) => /UPDATE e\s+SET is_active/.test(call.statement)),
    false
  )
})

test('CoC sync rejects an empty HR snapshot before changing portal rows', async () => {
  const { database, calls } = portalFixture()
  await assert.rejects(
    syncToPortalDB(database, []),
    /HR returned no active employees/
  )
  assert.equal(calls.length, 0)
})

test('CoC HR fetch retains the finance stop flag in its active filter', async () => {
  const statements = []
  const hr = {
    request() {
      return {
        input() {
          return this
        },
        async query(statement) {
          statements.push(statement)
          if (statement.includes('FROM [dbo].[adm_company]'))
            return { recordset: [{ company_code: 'C1' }] }
          if (statement.includes('FROM [dbo].[adm_branch]'))
            return { recordset: [{ branch_code: 'BR1' }] }
          return { recordset: [] }
        },
      }
    },
  }

  await fetchEmployeesFromHR(hr)
  const employeeQuery = statements.find((statement) =>
    statement.includes('[MenaITech].[dbo].[Pay_employees]')
  )
  assert.match(employeeQuery, /A\.FDimension = '1'/)
  assert.match(employeeQuery, /B\.stop_val_flag = 0/)
})
