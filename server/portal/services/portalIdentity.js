const path = require('path')

const EMPLOYEE_CODE_MAX_LENGTH = 20
const PROFILE_FILE_NAME_MAX_LENGTH = 300

const PROFILE_QUERY = `SELECT TOP (2) profilePicPath, portalProfilePicPath
  FROM dbo.usersInfo WHERE employeeID = @employeeCode`

const AUTHORIZATIONS_QUERY = `SELECT
  CAST(CASE WHEN EXISTS (
    SELECT 1 FROM dbo.admin_members WHERE employeeID = @employeeCode
  ) THEN 1 ELSE 0 END AS bit) AS isPortalAdmin,
  CAST(CASE WHEN EXISTS (
    SELECT 1 FROM dbo.business_card_admins WHERE employeeID = @employeeCode
  ) THEN 1 ELSE 0 END AS bit) AS isBusinessCardsAdmin,
  CAST(CASE WHEN EXISTS (
    SELECT 1 FROM dbo.coc_admins WHERE employeeID = @employeeCode
  ) THEN 1 ELSE 0 END AS bit) AS isCOCAdmin,
  CAST(CASE WHEN EXISTS (
    SELECT 1 FROM dbo.elevators_users WHERE employeeID = @employeeCode
  ) THEN 1 ELSE 0 END AS bit) AS isElevatorsSurveysUser,
  CAST(CASE WHEN EXISTS (
    SELECT 1 FROM dbo.hr_surveys_users WHERE employeeID = @employeeCode
  ) THEN 1 ELSE 0 END AS bit) AS isHRSurveysUser,
  CAST(CASE WHEN EXISTS (
    SELECT 1 FROM dbo.dtr_users WHERE employeeID = @employeeCode
  ) THEN 1 ELSE 0 END AS bit) AS isDTRUser`

const BUSINESS_CARD_QUERY = `SELECT TOP (2) qrCodePath
  FROM businessCards.employeeData WHERE employeeID = @employeeCode`

const PROFILE_PHOTO_QUERY = `SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @oldProfilePicPath nvarchar(300);
  DECLARE @profileCount int = 0;
  SELECT @oldProfilePicPath = portalProfilePicPath,
      @profileCount = @profileCount + 1
    FROM dbo.usersInfo WITH (UPDLOCK, HOLDLOCK)
    WHERE employeeID = @employeeCode;
  IF @profileCount <> 1
  BEGIN
    ROLLBACK TRANSACTION;
    SELECT @profileCount AS profileCount, @oldProfilePicPath AS oldProfilePicPath,
      CAST(0 AS bit) AS oldProfilePicInUse;
    RETURN;
  END;

  UPDATE dbo.usersInfo SET portalProfilePicPath = @profilePicPath
    WHERE employeeID = @employeeCode;
  UPDATE dbo.admin_members
    SET profilePicPath = @profilePicPath, hrPicture = @hrPicture,
      portalPicture = @portalPicture
    WHERE employeeID = @employeeCode;
  UPDATE dbo.business_card_admins
    SET profilePicPath = @profilePicPath, hrPicture = @hrPicture,
      portalPicture = @portalPicture
    WHERE employeeID = @employeeCode;
  UPDATE dbo.coc_admins
    SET profilePicPath = @profilePicPath, hrPicture = @hrPicture,
      portalPicture = @portalPicture
    WHERE employeeID = @employeeCode;
  UPDATE dbo.elevators_users
    SET profilePicPath = @profilePicPath, hrPicture = @hrPicture,
      portalPicture = @portalPicture
    WHERE employeeID = @employeeCode;
  UPDATE dbo.hr_surveys_users
    SET profilePicPath = @profilePicPath, hrPicture = @hrPicture,
      portalPicture = @portalPicture
    WHERE employeeID = @employeeCode;
  UPDATE dbo.dtr_users
    SET profilePicPath = @profilePicPath, hrPicture = @hrPicture,
      portalPicture = @portalPicture
    WHERE employeeID = @employeeCode;

  DECLARE @oldProfilePicInUse bit = 0;
  IF @oldProfilePicPath IS NOT NULL AND (
    EXISTS (SELECT 1 FROM dbo.usersInfo WITH (HOLDLOCK)
      WHERE employeeID <> @employeeCode
        AND portalProfilePicPath = @oldProfilePicPath) OR
    EXISTS (SELECT 1 FROM dbo.admin_members WITH (HOLDLOCK)
      WHERE employeeID <> @employeeCode
        AND profilePicPath = @oldProfilePicPath) OR
    EXISTS (SELECT 1 FROM dbo.business_card_admins WITH (HOLDLOCK)
      WHERE employeeID <> @employeeCode
        AND profilePicPath = @oldProfilePicPath) OR
    EXISTS (SELECT 1 FROM dbo.coc_admins WITH (HOLDLOCK)
      WHERE employeeID <> @employeeCode
        AND profilePicPath = @oldProfilePicPath) OR
    EXISTS (SELECT 1 FROM dbo.elevators_users WITH (HOLDLOCK)
      WHERE employeeID <> @employeeCode
        AND profilePicPath = @oldProfilePicPath) OR
    EXISTS (SELECT 1 FROM dbo.hr_surveys_users WITH (HOLDLOCK)
      WHERE employeeID <> @employeeCode
        AND profilePicPath = @oldProfilePicPath) OR
    EXISTS (SELECT 1 FROM dbo.dtr_users WITH (HOLDLOCK)
      WHERE employeeID <> @employeeCode
        AND profilePicPath = @oldProfilePicPath)
  ) SET @oldProfilePicInUse = 1;

  COMMIT TRANSACTION;
  SELECT @profileCount AS profileCount,
    @oldProfilePicPath AS oldProfilePicPath,
    @oldProfilePicInUse AS oldProfilePicInUse;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH`

class PortalError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.statusCode = statusCode
  }
}

function createPortalIdentity({ sql, portalConfig, fileSystem, uploadDirectory }) {
  const uploadsRoot = path.resolve(uploadDirectory)

  function employeeInput(request, employeeCode) {
    if (
      typeof employeeCode !== 'string' ||
      employeeCode.length < 1 ||
      employeeCode.length > EMPLOYEE_CODE_MAX_LENGTH
    ) {
      throw new PortalError('serviceUnavailable', 503)
    }
    return request.input(
      'employeeCode',
      sql.VarChar(EMPLOYEE_CODE_MAX_LENGTH),
      employeeCode
    )
  }

  async function withPool(operation) {
    const pool = new sql.ConnectionPool(portalConfig)
    try {
      await pool.connect()
      return await operation(pool)
    } finally {
      await pool.close().catch(() => {})
    }
  }

  function storedFilePath(filename) {
    if (
      typeof filename !== 'string' ||
      !filename ||
      filename === 'profile.png' ||
      path.basename(filename) !== filename
    ) {
      return null
    }
    const resolved = path.resolve(uploadsRoot, filename)
    return path.dirname(resolved) === uploadsRoot ? resolved : null
  }

  async function removeStoredFile(filename) {
    const filePath = storedFilePath(filename)
    if (!filePath) return filename == null || filename === 'profile.png'
    try {
      await fileSystem.unlink(filePath)
      return true
    } catch (error) {
      return error && error.code === 'ENOENT'
    }
  }

  async function hasValidImageSignature(file) {
    let handle
    try {
      handle = await fileSystem.open(file.path, 'r')
      const header = Buffer.alloc(8)
      const { bytesRead } = await handle.read(header, 0, header.length, 0)
      const png =
        bytesRead === 8 &&
        header.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      const jpeg =
        bytesRead >= 3 &&
        header[0] === 0xff &&
        header[1] === 0xd8 &&
        header[2] === 0xff
      return (
        (file.mimetype === 'image/png' && png) ||
        ((file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') &&
          jpeg)
      )
    } catch {
      return false
    } finally {
      if (handle) await handle.close().catch(() => {})
    }
  }

  return {
    getProfile(employeeCode) {
      return withPool(async (pool) => {
        const { recordset } = await employeeInput(
          pool.request(),
          employeeCode
        ).query(PROFILE_QUERY)
        if (recordset.length !== 1)
          throw new PortalError(
            recordset.length ? 'serviceUnavailable' : 'profileNotFound',
            recordset.length ? 503 : 404
          )
        return {
          profilePicPath: recordset[0].profilePicPath,
          portalProfilePicPath: recordset[0].portalProfilePicPath,
        }
      })
    },

    getAuthorizations(employeeCode) {
      return withPool(async (pool) => {
        const { recordset } = await employeeInput(
          pool.request(),
          employeeCode
        ).query(AUTHORIZATIONS_QUERY)
        if (recordset.length !== 1)
          throw new PortalError('serviceUnavailable', 503)
        const result = recordset[0]
        return {
          isPortalAdmin: Boolean(result.isPortalAdmin),
          isBusinessCardsAdmin: Boolean(result.isBusinessCardsAdmin),
          isCOCAdmin: Boolean(result.isCOCAdmin),
          isElevatorsSurveysUser: Boolean(result.isElevatorsSurveysUser),
          isHRSurveysUser: Boolean(result.isHRSurveysUser),
          isDTRUser: Boolean(result.isDTRUser),
        }
      })
    },

    getMyBusinessCard(employeeCode) {
      return withPool(async (pool) => {
        const { recordset } = await employeeInput(
          pool.request(),
          employeeCode
        ).query(BUSINESS_CARD_QUERY)
        if (recordset.length > 1)
          throw new PortalError('serviceUnavailable', 503)
        if (!recordset.length) return { hasCard: false, qrCodePath: null }
        return {
          hasCard: true,
          qrCodePath: recordset[0].qrCodePath || null,
        }
      })
    },

    async saveProfilePhoto(employeeCode, file) {
      const newFilePath = file && storedFilePath(file.filename)
      if (!file || !newFilePath || path.resolve(file.path) !== newFilePath) {
        throw new PortalError('invalidUpload', 400)
      }

      if (!(await hasValidImageSignature(file))) {
        await removeStoredFile(file.filename)
        throw new PortalError('invalidUpload', 400)
      }

      let previousPhoto
      try {
        previousPhoto = await withPool(async (pool) => {
          const request = employeeInput(pool.request(), employeeCode)
            .input(
              'profilePicPath',
              sql.NVarChar(PROFILE_FILE_NAME_MAX_LENGTH),
              file.filename
            )
            .input('hrPicture', sql.Bit, false)
            .input('portalPicture', sql.Bit, true)
          const { recordset } = await request.query(PROFILE_PHOTO_QUERY)
          if (!recordset || recordset.length !== 1)
            throw new PortalError('serviceUnavailable', 503)
          if (recordset[0].profileCount !== 1)
            throw new PortalError(
              recordset[0].profileCount
                ? 'serviceUnavailable'
                : 'profileNotFound',
              recordset[0].profileCount ? 503 : 404
            )
          return recordset[0]
        })
      } catch (error) {
        await removeStoredFile(file.filename)
        throw error
      }

      const cleanupComplete =
        previousPhoto.oldProfilePicInUse ||
        previousPhoto.oldProfilePicPath === file.filename ||
        (await removeStoredFile(previousPhoto.oldProfilePicPath))
      return { cleanupPending: !cleanupComplete }
    },
  }
}

module.exports = {
  createPortalIdentity,
  PortalError,
  PROFILE_QUERY,
  AUTHORIZATIONS_QUERY,
  BUSINESS_CARD_QUERY,
  PROFILE_PHOTO_QUERY,
}
