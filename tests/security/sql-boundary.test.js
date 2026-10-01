/* eslint-disable no-template-curly-in-string -- Deliberate source-code regression fixtures. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default

const root = path.resolve(__dirname, '../..')
function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(filename)
    return /\.(js|vue)$/.test(filename) ? [filename] : []
  })
}

// These are the reviewed server-owned statement selectors. New execution
// sites require review, even if a developer renames a browser-SQL helper.
const SELECTORS = {
  'server/shared/roles.js': ['statement'],
  'server/administration/services/memberships.js': [
    'entry.list',
    'entry.exists',
    'entry.add',
    'entry.remove',
    'HR_EMPLOYEE_QUERY',
    'HR_TITLE_QUERY',
    'PORTAL_PICTURE_QUERY',
  ],
  'server/administration/services/dtrSetup.js': [
    'entry.query',
    'EMPLOYEE_QUERIES.get(level)',
    'PATH_QUERIES.get(level)',
    'ASSIGNMENT_LIST_QUERY',
    'ASSIGNMENT_ADD_STATEMENT',
  ],
  'server/businessCards/services/cardManagement.js': [
    'CARD_EXISTS_QUERY',
    'SAVE_CARD_QUERY',
    'LIST_CARDS_QUERY',
    'EDITABLE_CARD_QUERY',
    'ACTIVITY_LOGS_QUERY',
    'DELETE_CARD_QUERY',
  ],
  'server/businessCards/services/publicCards.js': ['PUBLIC_CARD_QUERY'],
  'server/portal/services/portalIdentity.js': [
    'PROFILE_QUERY',
    'AUTHORIZATIONS_QUERY',
    'BUSINESS_CARD_QUERY',
    'PROFILE_PHOTO_QUERY',
  ],
  'server/dtr/services/dtrReads.js': [
    'ASSIGNMENTS_QUERY',
    'SCOPE_EMPLOYEE_QUERIES.get(scope.level)',
    'SCOPE_LIST_QUERIES.get(scope.level)',
    'EMPLOYEE_DETAIL_QUERY',
    'EMPLOYEE_QUERIES.get(scope.level)',
    'ENTRY_QUERY',
    'PERIOD_ENTRIES_QUERY',
    'PENDING_APPROVALS_QUERY',
  ],
  'server/dtr/services/dtrWrites.js': [
    'LOCK_ENTRY',
    'MEMBER_QUERY',
    'row?SAVE_UPDATE:SAVE_INSERT',
    'statement',
  ],
  'server/coc/router/cocJS.js': ['query'],
  'server/coc/services/signatures.js': [
    'EMPLOYEE',
    'VERSION',
    'SIGNATURE',
    'SUBMIT',
    'DECIDE',
    'ACTOR',
    'UPDATE',
  ],
}
const BUILDERS = new Set([
  'existsQuery',
  'membership',
  'existsStatement',
  'listStatement',
  'addStatement',
  'deleteStatement',
])

function auditSource(source, filename) {
  const violations = []
  const ast = parser.parse(source, { sourceType: 'unambiguous' })
  const slice = (node) => source.slice(node.start, node.end).replace(/\s+/g, '')
  function requestTainted(node, scope, seen = new Set()) {
    if (!node) return false
    if (node.type === 'Identifier') {
      if (['req', 'requestBody', 'body', 'sqlQuery'].includes(node.name))
        return true
      const binding = scope.getBinding(node.name)
      if (!binding || seen.has(binding)) return false
      seen.add(binding)
      if (requestTainted(binding.path.node.init, binding.path.scope, seen))
        return true
      return binding.constantViolations.some((p) =>
        requestTainted(p.node.right, p.scope, seen)
      )
    }
    if (node.type === 'MemberExpression')
      return requestTainted(node.object, scope, seen)
    if (node.type === 'ConditionalExpression')
      return (
        requestTainted(node.consequent, scope, seen) ||
        requestTainted(node.alternate, scope, seen)
      )
    if (node.type === 'TemplateLiteral')
      return node.expressions.some((e) => requestTainted(e, scope, seen))
    if (node.type === 'BinaryExpression')
      return (
        requestTainted(node.left, scope, seen) ||
        requestTainted(node.right, scope, seen)
      )
    if (node.type === 'CallExpression')
      return (
        requestTainted(node.callee, scope, seen) ||
        node.arguments.some((arg) => requestTainted(arg, scope, seen))
      )
    return false
  }
  traverse(ast, {
    CallExpression(p) {
      const { callee, arguments: args } = p.node
      if (callee.type === 'Identifier' && BUILDERS.has(callee.name)) {
        const inBuilder = p.findParent(
          (ancestor) =>
            ancestor.isFunctionDeclaration() &&
            ancestor.node.id?.name === 'membership'
        )
        if (!inBuilder && args.some((arg) => arg.type !== 'StringLiteral'))
          violations.push('nonliteral identifier builder')
      }
      if (
        callee.type !== 'MemberExpression' ||
        !['query', 'execute', 'batch'].includes(
          callee.property.name || callee.property.value
        )
      )
        return
      if (callee.computed || args.length !== 1) {
        violations.push('unreviewed execution shape')
        return
      }
      const argument = args[0]
      if (requestTainted(argument, p.scope))
        violations.push('request-derived SQL')
      if (argument.type === 'StringLiteral') return
      if (argument.type === 'TemplateLiteral') {
        if (argument.expressions.length)
          violations.push('interpolated execution text')
        return
      }
      if (!(SELECTORS[filename] || []).includes(slice(argument)))
        violations.push(`unreviewed SQL selector: ${slice(argument)}`)
    },
    TemplateLiteral(p) {
      if (
        !/\b(?:SELECT|UPDATE|INSERT|DELETE|EXEC)\b/i.test(
          p.node.quasis.map((q) => q.value.raw).join(' ')
        )
      )
        return
      for (const expression of p.node.expressions) {
        const name = slice(expression)
        if (requestTainted(expression, p.scope))
          violations.push('request-derived SQL template')
        // Literal-only builders and constants compose fixed SQL. Request
        // data cannot be part of a template, including in renamed helpers.
        if (
          !/^[A-Z][A-Z_]*$/.test(name) &&
          !['table', 'procedurePrefix'].includes(name) &&
          !(
            filename === 'server/dtr/services/dtrReads.js' && name === 'scope'
          ) &&
          !(
            filename === 'server/dtr/services/dtrWrites.js' &&
            [
              "DAY_COLUMNS.map((day)=>`[${day}]`).join(',')",
              "DAY_COLUMNS.map((day)=>`@day${day}`).join(',')",
            ].includes(name)
          )
        )
          violations.push(`SQL interpolation: ${name}`)
      }
    },
  })
  return violations
}

test('all server SQL execution sites use reviewed statements and closed identifier builders', () => {
  const findings = []
  for (const filename of sourceFiles(path.join(root, 'server'))) {
    const relative = path.relative(root, filename).replace(/\\/g, '/')
    findings.push(
      ...auditSource(fs.readFileSync(filename, 'utf8'), relative).map(
        (v) => `${relative}: ${v}`
      )
    )
  }
  assert.deepEqual(findings, [])
})

test('SQL boundary checker rejects renamed gateways, tainted aliases, computed execution and dynamic identifiers', () => {
  for (const source of [
    'function renamed(req, pool) { pool.request().query(req.body.statement) }',
    'function renamed(req, pool) { const input = req.body; const statement = input.payload; pool.query(statement) }',
    'function renamed(req, pool) { let statement = "SELECT 1"; statement = req.query.value; pool.query(statement) }',
    'function renamed(req, pool) { pool["query"](req.body.sql) }',
    'function renamed(req, pool) { pool.execute(req.body.procedure) }',
    'function renamed(req, pool) { const sql = `SELECT * FROM ${req.body.table}`; pool.query(sql) }',
    'const entries = new Map([["portal", membership(req.body.table, req.body.procedure)]])',
  ])
    assert.ok(auditSource(source, 'server/shared/roles.js').length, source)
})

test('complete executable application contains no retired gateway names or SQL-bearing frontend payloads', () => {
  const directories = [
    'server',
    'pages',
    'layouts',
    'components',
    'store',
    'utils',
    'plugins',
    'middleware',
  ]
  for (const directory of directories) {
    if (!fs.existsSync(path.join(root, directory))) continue
    for (const filename of sourceFiles(path.join(root, directory))) {
      // User-facing technical documentation intentionally describes old APIs.
      if (filename.includes(`${path.sep}technical-documentation${path.sep}`))
        continue
      const source = fs.readFileSync(filename, 'utf8')
      assert.doesNotMatch(
        source,
        /(?:open-sql-call|hr-sql-call|sql-params-call|sql-call|sqlParamsCall|hrSqlCall|openSqlCall)/i,
        filename
      )
      if (directory === 'server') continue
      const script = filename.endsWith('.vue')
        ? source.match(/<script>([\s\S]*?)<\/script>/)?.[1]
        : source
      if (!script) continue
      const ast = parser.parse(script, { sourceType: 'unambiguous' })
      traverse(ast, {
        StringLiteral(p) {
          assert.doesNotMatch(
            p.node.value,
            /^\s*(SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+.+\s+SET|DELETE\s+FROM|EXEC(?:UTE)?\s)/i,
            filename
          )
        },
        TemplateLiteral(p) {
          assert.doesNotMatch(
            p.node.quasis.map((q) => q.value.raw).join(' '),
            /^\s*(SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+.+\s+SET|DELETE\s+FROM|EXEC(?:UTE)?\s)/i,
            filename
          )
        },
      })
    }
  }
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, 'nuxt.config.js'), 'utf8'),
    /sqlCalls|sql-call/i
  )
})

module.exports = { auditSource }
