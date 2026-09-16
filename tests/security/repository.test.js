const test = require('node:test')
const assert = require('node:assert/strict')
const { createRepository } = require('../../server/login/services/repository')

function fixture(results = [], connectFailure = false) {
  const calls = []
  const pools = []
  class ConnectionPool {
    constructor(config) {
      this.config = config
      this.closed = false
      pools.push(this)
    }

    async connect() {
      if (connectFailure) throw new Error('connection failed')
    }

    async close() {
      this.closed = true
    }

    request() {
      const params = {}
      const invoke = async (kind, statement) => {
        calls.push({ kind, statement, params, config: this.config })
        const next = results.shift()
        if (next instanceof Error) throw next
        return next || { recordset: [], rowsAffected: [0] }
      }
      return {
        input(name, type, value) {
          params[name] = { type, value }
          return this
        },
        query: (statement) => invoke('query', statement),
        execute: (statement) => invoke('execute', statement),
      }
    }
  }
  const sql = {
    ConnectionPool,
    VarChar: (length) => ({ name: 'varchar', length }),
    NVarChar: (length) => ({ name: 'nvarchar', length }),
  }
  return {
    repository: createRepository({
      sql,
      portalConfig: 'portal',
      hrConfig: 'hr',
    }),
    calls,
    pools,
  }
}

test('HR queries bind email, employee code, position and branch without interpolating data', async () => {
  const f = fixture([
    {
      recordset: [
        {
          employee_code: '123',
          branch_code: "b'",
          position: '21',
          Manager_Code: '456',
        },
      ],
    },
    { recordset: [{ system_desp_e: "O'Neil", system_desp_a: 'مهندس' }] },
    { recordset: [{ Email: 'manager@example.invalid' }] },
  ])
  const email = "x' OR 1=1--"
  const employee = await f.repository.getMoreInfo(email)
  assert.equal(employee.title, "O'Neil")
  assert.equal(employee.title_a, 'مهندس')
  assert.equal(employee.position, undefined)
  await f.repository.getManagerInfo("123'--")
  assert.equal(f.calls[0].params.email.value, email)
  assert.equal(f.calls[0].statement.includes(email), false)
  assert.equal(f.calls[1].params.branch.value, "b'")
  assert.equal(f.calls[2].params.employeeCode.value, "123'--")
  assert.equal(f.calls[2].statement.includes("123'--"), false)
  assert.ok(f.pools.every((pool) => pool.closed))
})

for (const exists of [0, 1]) {
  test(`profile ${
    exists ? 'update' : 'insert'
  } and token registration use fixed procedures and typed parameters`, async () => {
    const f = fixture([{ recordset: [{ employeeMail: exists }] }])
    await f.repository.saveLogin({
      moreInfo: {
        employee_code: '123',
        company_code: 'AK',
        branch_code: 'B',
        employee_picture: "صورة'.png",
        employee_name_a: 'اسم',
        Manager_Code: '456',
        title: "O'Neil",
        title_a: 'عنوان',
      },
      managerInfo: { Email: 'm@example.invalid' },
      user: { cn: "O'Neil", mail: "o'neil@example.invalid" },
      encryptedPassword: 'ciphertext',
      token: 'signed-test-token',
    })
    assert.deepEqual(
      f.calls.map((call) => call.statement),
      [
        'dbo.userInfo_checkIfExist',
        exists ? 'dbo.usersInfo_updateData' : 'dbo.usersInfo_addData',
        'dbo.userTokens_addToken',
      ]
    )
    assert.equal(f.calls[1].params.fullName.value, "O'Neil")
    assert.equal(f.calls[1].params.arabicName.type.name, 'nvarchar')
    assert.equal(f.calls[2].params.userToken.type.length, 300)
    assert.ok(f.pools.every((pool) => pool.closed))
  })
}

test('session lookup is bound to both token and employee; credentials use employee identity', async () => {
  const f = fixture([
    { recordset: [{ registered: 1 }] },
    { recordset: [{ groupID: 'cipher', mailAddress: 'test@example.invalid' }] },
  ])
  const identity = { employeeCode: "123'--", token: "a'--" }
  assert.equal(await f.repository.isRegistered(identity), true)
  await f.repository.getCredentials(identity.employeeCode)
  await f.repository.revokeToken(identity.token)
  assert.equal(f.calls[0].params.employeeID.value, identity.employeeCode)
  assert.equal(f.calls[0].params.userToken.value, identity.token)
  assert.match(f.calls[0].statement, /employeeID = @employeeID/)
  assert.equal(f.calls[1].params.employeeCode.value, identity.employeeCode)
  assert.equal(f.calls[2].statement, 'dbo.usersInfo_deleteToken')
  assert.equal(f.calls[2].params.token.value, identity.token)
  assert.ok(f.calls.every((call) => !call.statement.includes(identity.token)))
})

test('database failures close pools; missing HR rows and oversized inputs fail safely', async () => {
  const failedConnect = fixture([], true)
  await assert.rejects(
    failedConnect.repository.getCredentials('123'),
    /connection failed/
  )
  assert.equal(failedConnect.pools[0].closed, true)
  const failedQuery = fixture([new Error('query failed')])
  await assert.rejects(
    failedQuery.repository.getMoreInfo('test@example.invalid'),
    /query failed/
  )
  assert.equal(failedQuery.pools[0].closed, true)
  const missing = fixture()
  await assert.rejects(
    missing.repository.getMoreInfo('test@example.invalid'),
    /hrDataMissing/
  )
  await assert.rejects(
    missing.repository.getManagerInfo('123'),
    /hrManagerMessing/
  )
  await assert.rejects(missing.repository.getCredentials('123'), /authFailed/)
  await assert.rejects(
    missing.repository.revokeToken('x'.repeat(301)),
    /accountDataInvalid/
  )
  assert.ok(missing.pools.every((pool) => pool.closed))
})

test('logout cannot claim success if a procedure leaves the token registered', async () => {
  const f = fixture([
    { recordset: [], rowsAffected: [0] },
    { recordset: [{ registered: 1 }] },
  ])
  await assert.rejects(
    f.repository.revokeToken('test-token'),
    /serviceUnavailable/
  )
  assert.equal(f.calls[1].params.token.value, 'test-token')
  assert.ok(f.pools.every((pool) => pool.closed))
})
