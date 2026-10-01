const {
  connect,
  failure,
  integer,
  text,
} = require('../../shared/auditBoundary')

const VERSION = `SELECT TOP (1) id, file_path FROM coc.coc_versions WITH (UPDLOCK, HOLDLOCK)
  WHERE active_flag = 1 ORDER BY created_at DESC`
const EMPLOYEE = `SELECT name_eng, email FROM coc.employees WITH (HOLDLOCK)
  WHERE employee_id = @employee_id AND is_active = 1`
const SIGNATURE = `SELECT id, status FROM coc.employee_signatures WITH (UPDLOCK, HOLDLOCK)
  WHERE employee_id = @employee_id AND coc_version_id = @version_id`
const SUBMIT = `SET NOCOUNT ON;
  IF EXISTS (SELECT 1 FROM coc.employee_signatures WHERE employee_id = @employee_id AND coc_version_id = @version_id)
    UPDATE coc.employee_signatures SET file_path = @file_path, signed_at = GETDATE(), status = 'pending'
    WHERE employee_id = @employee_id AND coc_version_id = @version_id;
  ELSE
    INSERT INTO coc.employee_signatures (employee_id, coc_version_id, file_path, signed_at, status)
    VALUES (@employee_id, @version_id, @file_path, GETDATE(), 'pending');
  INSERT INTO coc.submission_history (employee_id, coc_version_id, status, file_path, submitted_at)
  VALUES (@employee_id, @version_id, 'pending', @file_path, GETDATE());`

const DECIDE = `SET NOCOUNT ON;
  SELECT employee_id, coc_version_id, file_path, status
  FROM coc.employee_signatures WITH (UPDLOCK, HOLDLOCK) WHERE id = @id`
const ACTOR = `SELECT employeeID FROM dbo.coc_admins WITH (HOLDLOCK)
  WHERE employeeID = @actor`
const UPDATE = `UPDATE coc.employee_signatures SET status = @status,
  approved_by = @actor, approved_at = GETDATE() WHERE id = @id AND status = 'pending';
  IF @@ROWCOUNT <> 1 THROW 50009, 'stateConflict', 1;
  INSERT INTO coc.submission_history (employee_id, coc_version_id, status, file_path, submitted_at, approved_by, approved_at)
  SELECT employee_id, coc_version_id, @status, file_path, GETDATE(), @actor, GETDATE()
  FROM coc.employee_signatures WHERE id = @id;
  SELECT e.name_eng, e.email FROM coc.employees e
  INNER JOIN coc.employee_signatures s ON e.employee_id = s.employee_id WHERE s.id = @id;`

function createSignatures({ sql, portalConfig }) {
  async function transaction(work) {
    const pool = await connect(sql, portalConfig)
    const tx = new sql.Transaction(pool)
    let begun = false
    let commitStarted = false
    try {
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE)
      begun = true
      const result = await work(() => new sql.Request(tx))
      commitStarted = true
      await tx.commit()
      begun = false
      return result
    } catch (error) {
      // A lost COMMIT response cannot prove rollback. Preserve generated
      // documents and require a reload before retrying the submission.
      if (commitStarted) error.commitUncertain = true
      if (error.number === 50009) throw failure('stateConflict', 409)
      throw error
    } finally {
      if (begun) await tx.rollback().catch(() => {})
      await pool.close().catch(() => {})
    }
  }
  return {
    async submit(employeeCode, render) {
      return await transaction(async (request) => {
        const employee = await request()
          .input('employee_id', sql.NVarChar(20), employeeCode)
          .query(EMPLOYEE)
        if (employee.recordset.length !== 1)
          throw failure('inactiveEmployee', 403)
        const versions = await request().query(VERSION)
        if (!versions.recordset.length) throw failure('notFound', 404)
        const version = versions.recordset[0]
        const current = await request()
          .input('employee_id', sql.NVarChar(20), employeeCode)
          .input('version_id', sql.Int, version.id)
          .query(SIGNATURE)
        if (current.recordset.length > 1)
          throw failure('serviceUnavailable', 503)
        if (
          current.recordset[0] &&
          !['pending', 'rejected'].includes(current.recordset[0].status)
        )
          throw failure('stateConflict', 409)
        const filename = text(await render(version.file_path), 255)
        await request()
          .input('employee_id', sql.NVarChar(20), employeeCode)
          .input('version_id', sql.Int, version.id)
          .input('file_path', sql.NVarChar(255), filename)
          .query(SUBMIT)
        return { filename, employee: employee.recordset[0] }
      })
    },
    async decide(signatureId, actor, approved, expectedFilePath) {
      const id = integer(signatureId)
      text(expectedFilePath, 255)
      return await transaction(async (request) => {
        const membership = await request()
          .input('actor', sql.VarChar(20), actor)
          .query(ACTOR)
        if (!membership.recordset.length) throw failure('forbidden', 403)
        const found = await request().input('id', sql.Int, id).query(DECIDE)
        if (found.recordset.length !== 1) throw failure('notFound', 404)
        if (
          found.recordset[0].status !== 'pending' ||
          found.recordset[0].file_path !== expectedFilePath
        )
          throw failure('stateConflict', 409)
        const result = await request()
          .input('id', sql.Int, id)
          .input('actor', sql.NVarChar(20), actor)
          .input('status', sql.VarChar(20), approved ? 'approved' : 'rejected')
          .query(UPDATE)
        return result.recordset[0]
      })
    },
  }
}

module.exports = {
  createSignatures,
  VERSION,
  EMPLOYEE,
  SIGNATURE,
  SUBMIT,
  DECIDE,
  ACTOR,
  UPDATE,
}
