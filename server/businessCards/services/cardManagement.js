// Fixed, server-owned operations for authenticated business-card management.
// Sizes verified against businessCards.employeeData, businessCards.logs and
// the businessCards.* procedure parameters on 2026-09-30.
const path = require('path')
const { randomUUID } = require('crypto')

// businessCards.logs.BCard_ID and the logging procedure's @cardID are
// varchar(10), so a longer card ID could not be audited without truncation.
const CARD_ID_PATTERN = /^[A-Za-z0-9_-]{1,10}$/
const ACTOR_CODE_MAX_LENGTH = 20
const COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS =/[\u0000-\u001F\u007F]/
// Existing stored marker for "no value"; templates and the vCard compare to it.
const ABSENT = 'undefined'
const DEFAULT_QR_SIZE = 300
const MIN_QR_SIZE = 100
const MAX_QR_SIZE = 2000
const GENERATED_ID_ATTEMPTS = 20
const DEFAULT_QR_FOREGROUND = '#07074eFF'
const DEFAULT_QR_BACKGROUND = '#FFFFFFFF'
// Shared or placeholder names that must never be removed from disk.
const PROTECTED_FILES = new Set(['', ABSENT, 'null', 'profile.png'])

const COMPANIES = Object.freeze([
  'Alkholi Group',
  'Alkholi Holding',
  'Custom',
  'AKTEK',
  'BTECO',
  'UPMOC',
  'AMOS & SBTMC Manager',
  'AKSTRA Consulting',
  'MX Reality',
])

const LIST_FIELDS = Object.freeze([
  'employeeID',
  'fullName_e',
  'mailAddress',
  'title',
  'profilePic',
  'qrCodePath',
])

const EDITABLE_FIELDS = Object.freeze([
  'employeeID',
  'company',
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

const LOG_FIELDS = Object.freeze([
  'ID',
  'theDate',
  'theTime',
  'Admin_Name',
  'theAction',
  'BCard_ID',
  'BCard_Name',
])

const LIST_CARDS_QUERY = `SELECT employeeID, fullName_e, mailAddress, title,
  profilePic, qrCodePath
  FROM businessCards.employeeData ORDER BY employeeID`

const EDITABLE_CARD_QUERY = `SELECT TOP (2) employeeID, company, fullName_a,
  fullName_e, arabicTitle, title, mobileNumber, landLines, faxLine,
  mailAddress, webSite, mainColor
  FROM businessCards.employeeData WHERE employeeID = @employeeID`

const ACTIVITY_LOGS_QUERY = `SELECT ID, CONVERT(char(10), theDate, 23) AS theDate,
  CONVERT(char(8), theTime, 108) AS theTime, Admin_Name, theAction, BCard_ID,
  RTRIM(BCard_Name) AS BCard_Name
  FROM businessCards.logs ORDER BY ID DESC`

const CARD_EXISTS_QUERY = `SELECT CAST(CASE WHEN EXISTS (
    SELECT 1 FROM businessCards.employeeData WHERE employeeID = @employeeID
  ) THEN 1 ELSE 0 END AS bit) AS cardExists`

// The audit actor is the caller's own administrator row, read inside the same
// transaction as the change; membership revoked meanwhile yields 'forbidden'.
const ACTOR_CHECK = `DECLARE @adminName varchar(100) = (SELECT TOP (1) fullName
    FROM dbo.business_card_admins WHERE employeeID = @actorCode);
  IF @adminName IS NULL
  BEGIN
    ROLLBACK TRANSACTION;
    SELECT 'forbidden' AS outcome;
    RETURN;
  END;`

const CARD_PROCEDURE_ARGUMENTS = `@employeeID = @employeeID,
      @companyLogo = @companyLogo, @profilePic = @profilePic,
      @fullName_a = @fullName_a, @fullName_e = @fullName_e,
      @arabicTitle = @arabicTitle, @title = @title,
      @mobileNumber = @mobileNumber, @landLines = @landLines,
      @mailAddress = @mailAddress, @webSite = @webSite,
      @qrCodePath = @qrCodePath, @company = @company, @faxLine = @faxLine,
      @mainColor = @storedMainColor`

const SAVE_CARD_QUERY = `SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRY
  BEGIN TRANSACTION;
  ${ACTOR_CHECK}
  DECLARE @cardCount int = 0;
  DECLARE @oldProfilePic nvarchar(200);
  DECLARE @oldCompanyLogo nvarchar(200);
  DECLARE @oldQrCodePath varchar(25);
  DECLARE @oldMainColor varchar(10);
  SELECT @cardCount = @cardCount + 1, @oldProfilePic = profilePic,
      @oldCompanyLogo = companyLogo, @oldQrCodePath = qrCodePath,
      @oldMainColor = mainColor
    FROM businessCards.employeeData WITH (UPDLOCK, HOLDLOCK)
    WHERE employeeID = @employeeID;
  IF @cardCount > 0 AND @requireNew = 1
  BEGIN
    ROLLBACK TRANSACTION;
    SELECT 'conflict' AS outcome;
    RETURN;
  END;
  DECLARE @profilePic nvarchar(200) =
    COALESCE(@newProfilePic, @oldProfilePic, N'profile.png');
  DECLARE @companyLogo nvarchar(200) =
    COALESCE(@newCompanyLogo, @oldCompanyLogo, N'undefined');
  DECLARE @storedMainColor varchar(10) =
    COALESCE(@mainColor, @oldMainColor, 'undefined');
  DECLARE @action varchar(20);
  IF @cardCount = 0
  BEGIN
    SET @action = 'Creation';
    EXEC businessCards.employeeData_addData ${CARD_PROCEDURE_ARGUMENTS};
  END
  ELSE
  BEGIN
    SET @action = 'Update';
    EXEC businessCards.employeeData_updateData ${CARD_PROCEDURE_ARGUMENTS};
  END;
  IF NOT EXISTS (SELECT 1 FROM businessCards.employeeData
    WHERE employeeID = @employeeID AND qrCodePath = @qrCodePath)
    THROW 50001, 'cardNotSaved', 1;
  EXEC businessCards.logging @date = @logDate, @time = @logTime,
    @adminName = @adminName, @action = @action, @cardID = @employeeID,
    @cardName = @fullName_e;
  COMMIT TRANSACTION;
  SELECT 'saved' AS outcome, @action AS action,
    @oldProfilePic AS oldProfilePic, @oldCompanyLogo AS oldCompanyLogo,
    @oldQrCodePath AS oldQrCodePath;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH`

const DELETE_CARD_QUERY = `SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRY
  BEGIN TRANSACTION;
  ${ACTOR_CHECK}
  DECLARE @cardCount int = 0;
  DECLARE @cardName varchar(100);
  DECLARE @oldQrCodePath varchar(25);
  SELECT @cardCount = @cardCount + 1, @cardName = fullName_e,
      @oldQrCodePath = qrCodePath
    FROM businessCards.employeeData WITH (UPDLOCK, HOLDLOCK)
    WHERE employeeID = @employeeID;
  IF @cardCount = 0
  BEGIN
    ROLLBACK TRANSACTION;
    SELECT 'notFound' AS outcome;
    RETURN;
  END;
  EXEC businessCards.employeeData_deleteData @cardID = @employeeID;
  IF EXISTS (SELECT 1 FROM businessCards.employeeData
    WHERE employeeID = @employeeID)
    THROW 50002, 'cardNotDeleted', 1;
  SET @cardName = COALESCE(@cardName, 'undefined');
  EXEC businessCards.logging @date = @logDate, @time = @logTime,
    @adminName = @adminName, @action = 'Deletion', @cardID = @employeeID,
    @cardName = @cardName;
  COMMIT TRANSACTION;
  SELECT 'deleted' AS outcome, @oldQrCodePath AS oldQrCodePath;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH`

class CardError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.statusCode = statusCode
  }
}

function validateCardId(value) {
  if (typeof value !== 'string' || !CARD_ID_PATTERN.test(value))
    throw new CardError('invalidEmployeeCode', 400)
  return value
}

function pick(fields, row) {
  return Object.fromEntries(fields.map((field) => [field, row[field]]))
}

function twoDigits(value) {
  return String(value).padStart(2, '0')
}

// Optional text: a missing value keeps the stored 'undefined' marker.
function text(fields, name, maxLength, emptyIsAbsent = false) {
  const value = fields[name]
  if (value === undefined || value === ABSENT) return ABSENT
  if (
    typeof value !== 'string' ||
    value.length > maxLength ||
    CONTROL_CHARACTERS.test(value)
  )
    throw new CardError('invalidCardData', 400)
  return emptyIsAbsent && value === '' ? ABSENT : value
}

function color(fields, name, fallback) {
  const value = fields[name]
  if (value === undefined || value === ABSENT || value === 'null' || !value)
    return fallback
  if (typeof value !== 'string' || !COLOR_PATTERN.test(value))
    throw new CardError('invalidCardData', 400)
  return value
}

function qrSize(fields) {
  const value = fields.qrSize
  if (value === undefined || value === ABSENT || value === '')
    return DEFAULT_QR_SIZE
  if (typeof value !== 'string' || !/^[0-9]{3,4}$/.test(value))
    throw new CardError('invalidCardData', 400)
  const size = Number(value)
  if (size < MIN_QR_SIZE || size > MAX_QR_SIZE)
    throw new CardError('invalidCardData', 400)
  return size
}

function validateCard(fields) {
  if (!fields || typeof fields !== 'object')
    throw new CardError('invalidCardData', 400)
  const requestedId = fields.employeeID
  const employeeID =
    requestedId === undefined || requestedId === ABSENT || requestedId === ''
      ? null
      : validateCardId(requestedId).toUpperCase()
  if (!COMPANIES.includes(fields.employeeCompany))
    throw new CardError('invalidCardData', 400)
  return {
    employeeID,
    company: fields.employeeCompany,
    fullName_a: text(fields, 'employeeArabicName', 100),
    fullName_e: text(fields, 'employeeEnglishName', 100),
    arabicTitle: text(fields, 'employeeArabicTitle', 100),
    title: text(fields, 'employeeEnglishTitle', 100),
    mobileNumber: text(fields, 'employeeMobileNumber', 20),
    landLines: text(fields, 'employeeLandLines', 150, true),
    faxLine: text(fields, 'faxLine', 150, true),
    mailAddress: text(fields, 'employeeMailAddress', 50),
    webSite: text(fields, 'employeeWebSite', 50),
    mainColor: color(fields, 'mainColor', null),
    qrForeground: color(fields, 'frColor', DEFAULT_QR_FOREGROUND),
    qrBackground: color(fields, 'bgColor', DEFAULT_QR_BACKGROUND),
    qrSize: qrSize(fields),
  }
}

function imageExtension(file) {
  const buffer = file && file.buffer
  if (!Buffer.isBuffer(buffer)) return null
  const png =
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const jpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  if (file.mimetype === 'image/png' && png) return '.png'
  if ((file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') && jpeg)
    return '.jpg'
  return null
}

function validateImages(files) {
  const images = {}
  for (const name of ['employeePicture', 'companyLogo', 'qrLogo']) {
    const file = files && files[name]
    if (!file) continue
    const extension = imageExtension(file)
    if (!extension) throw new CardError('invalidUpload', 400)
    images[name] = { buffer: file.buffer, extension }
  }
  return images
}

function createCardManagement({
  sql,
  portalConfig,
  fileSystem,
  uploadDirectory,
  renderQr,
  publicCardUrl,
  now = () => new Date(),
  random = Math.random,
}) {
  const uploadsRoot = path.resolve(uploadDirectory)

  async function withPool(operation) {
    const pool = new sql.ConnectionPool(portalConfig)
    try {
      await pool.connect()
      return await operation(pool)
    } finally {
      await pool.close().catch(() => {})
    }
  }

  function cardIdInput(request, employeeID) {
    return request.input('employeeID', sql.VarChar(20), employeeID)
  }

  // Caller identity comes from the verified session, never from the request.
  function auditInputs(request, actorCode) {
    if (
      typeof actorCode !== 'string' ||
      actorCode.length < 1 ||
      actorCode.length > ACTOR_CODE_MAX_LENGTH
    )
      throw new CardError('authFailed', 401)
    const time = now()
    return request
      .input('actorCode', sql.VarChar(ACTOR_CODE_MAX_LENGTH), actorCode)
      .input(
        'logDate',
        sql.VarChar(10),
        `${time.getFullYear()}-${twoDigits(time.getMonth() + 1)}-${twoDigits(
          time.getDate()
        )}`
      )
      .input(
        'logTime',
        sql.VarChar(8),
        `${twoDigits(time.getHours())}:${twoDigits(
          time.getMinutes()
        )}:${twoDigits(time.getSeconds())}`
      )
  }

  // The last recordset is the batch's own status row; procedures may emit more.
  function outcomeRow(result) {
    const sets = result.recordsets
    const rows = sets && sets.length ? sets[sets.length - 1] : result.recordset
    if (!rows || rows.length !== 1 || typeof rows[0].outcome !== 'string')
      throw new CardError('serviceUnavailable', 503)
    if (rows[0].outcome === 'forbidden') throw new CardError('forbidden', 403)
    return rows[0]
  }

  function storedFilePath(filename) {
    if (
      typeof filename !== 'string' ||
      PROTECTED_FILES.has(filename) ||
      path.basename(filename) !== filename
    )
      return null
    const resolved = path.resolve(uploadsRoot, filename)
    return path.dirname(resolved) === uploadsRoot ? resolved : null
  }

  // True when nothing is left to clean up (removed, already gone or protected).
  async function removeStoredFile(filename) {
    const filePath = storedFilePath(filename)
    if (!filePath) return true
    try {
      await fileSystem.unlink(filePath)
      return true
    } catch (error) {
      return Boolean(error && error.code === 'ENOENT')
    }
  }

  async function unusedGeneratedId() {
    return await withPool(async (pool) => {
      for (let attempt = 0; attempt < GENERATED_ID_ATTEMPTS; attempt++) {
        const employeeID = `X${Math.floor(random() * 89998) + 10001}`
        const { recordset } = await cardIdInput(
          pool.request(),
          employeeID
        ).query(CARD_EXISTS_QUERY)
        if (!recordset || recordset.length !== 1)
          throw new CardError('serviceUnavailable', 503)
        if (!recordset[0].cardExists) return employeeID
      }
      throw new CardError('serviceUnavailable', 503)
    })
  }

  // Returns null when a generated ID was taken meanwhile, so the caller retries.
  async function writeCard(card, images, actorCode, requireNew) {
    const qrCodePath = `${card.employeeID}_QR_${card.qrSize}px.png`
    let qrImage
    try {
      qrImage = await renderQr({
        text: publicCardUrl(card.employeeID),
        size: card.qrSize,
        foreground: card.qrForeground,
        background: card.qrBackground,
        logo: images.qrLogo ? images.qrLogo.buffer : null,
      })
    } catch {
      // An undecodable inner logo is the caller's input; anything else is ours.
      throw images.qrLogo
        ? new CardError('invalidUpload', 400)
        : new CardError('serviceUnavailable', 503)
    }

    const undo = []
    async function storeUpload(image) {
      if (!image) return null
      const filename = `${card.employeeID}_${randomUUID()}${image.extension}`
      await fileSystem.writeFile(path.join(uploadsRoot, filename), image.buffer)
      undo.push(() => removeStoredFile(filename))
      return filename
    }

    let saved
    try {
      const newProfilePic = await storeUpload(images.employeePicture)
      const newCompanyLogo = await storeUpload(images.companyLogo)

      // Same-size regeneration reuses the file name: keep the old bytes so a
      // failed database write can put them back.
      const qrFilePath = path.join(uploadsRoot, qrCodePath)
      const previousQr = await fileSystem
        .readFile(qrFilePath)
        .catch((error) => {
          if (error && error.code === 'ENOENT') return null
          throw error
        })
      await fileSystem.writeFile(qrFilePath, qrImage)
      undo.push(() =>
        previousQr
          ? fileSystem.writeFile(qrFilePath, previousQr)
          : removeStoredFile(qrCodePath)
      )

      saved = await withPool(async (pool) => {
        const request = auditInputs(
          cardIdInput(pool.request(), card.employeeID),
          actorCode
        )
          .input('requireNew', sql.Bit, requireNew)
          .input('newProfilePic', sql.NVarChar(100), newProfilePic)
          .input('newCompanyLogo', sql.NVarChar(100), newCompanyLogo)
          .input('fullName_a', sql.NVarChar(100), card.fullName_a)
          .input('fullName_e', sql.VarChar(100), card.fullName_e)
          .input('arabicTitle', sql.NVarChar(100), card.arabicTitle)
          .input('title', sql.VarChar(100), card.title)
          .input('mobileNumber', sql.VarChar(20), card.mobileNumber)
          .input('landLines', sql.VarChar(150), card.landLines)
          .input('mailAddress', sql.VarChar(50), card.mailAddress)
          .input('webSite', sql.VarChar(50), card.webSite)
          .input('qrCodePath', sql.VarChar(25), qrCodePath)
          .input('company', sql.VarChar(100), card.company)
          .input('faxLine', sql.VarChar(150), card.faxLine)
          .input('mainColor', sql.VarChar(10), card.mainColor)
        return outcomeRow(await request.query(SAVE_CARD_QUERY))
      })
      if (saved.outcome !== 'saved' && saved.outcome !== 'conflict')
        throw new CardError('serviceUnavailable', 503)
    } catch (error) {
      for (const step of undo.reverse()) await step().catch(() => {})
      throw error
    }

    if (saved.outcome === 'conflict') {
      for (const step of undo.reverse()) await step().catch(() => {})
      return null
    }

    // Replaced artifacts are removed only after the commit.
    const replaced = []
    if (images.employeePicture) replaced.push(saved.oldProfilePic)
    if (images.companyLogo) replaced.push(saved.oldCompanyLogo)
    if (saved.oldQrCodePath !== qrCodePath) replaced.push(saved.oldQrCodePath)
    let cleanupPending = false
    for (const filename of replaced)
      if (!(await removeStoredFile(filename))) cleanupPending = true

    return {
      employeeID: card.employeeID,
      action: saved.action,
      cleanupPending,
    }
  }

  return {
    listCards() {
      return withPool(async (pool) => {
        const { recordset } = await pool.request().query(LIST_CARDS_QUERY)
        return recordset.map((row) => pick(LIST_FIELDS, row))
      })
    },

    // Async so invalid input rejects instead of throwing synchronously.
    async getCard(employeeCode) {
      validateCardId(employeeCode)
      return await withPool(async (pool) => {
        const { recordset } = await cardIdInput(
          pool.request(),
          employeeCode
        ).query(EDITABLE_CARD_QUERY)
        if (!recordset.length) throw new CardError('cardNotFound', 404)
        if (recordset.length !== 1)
          throw new CardError('serviceUnavailable', 503)
        return pick(EDITABLE_FIELDS, recordset[0])
      })
    },

    listActivityLogs() {
      return withPool(async (pool) => {
        const { recordset } = await pool.request().query(ACTIVITY_LOGS_QUERY)
        return recordset.map((row) => pick(LOG_FIELDS, row))
      })
    },

    async saveCard({ actorCode, fields, files }) {
      const card = validateCard(fields)
      const images = validateImages(files)
      if (card.employeeID)
        return await writeCard(card, images, actorCode, false)
      for (let attempt = 0; attempt < GENERATED_ID_ATTEMPTS; attempt++) {
        const employeeID = await unusedGeneratedId()
        const result = await writeCard(
          { ...card, employeeID },
          images,
          actorCode,
          true
        )
        if (result) return result
      }
      throw new CardError('serviceUnavailable', 503)
    },

    async deleteCard({ actorCode, employeeCode }) {
      validateCardId(employeeCode)
      const deleted = await withPool(async (pool) =>
        outcomeRow(
          await auditInputs(
            cardIdInput(pool.request(), employeeCode),
            actorCode
          ).query(DELETE_CARD_QUERY)
        )
      )
      if (deleted.outcome === 'notFound')
        throw new CardError('cardNotFound', 404)
      if (deleted.outcome !== 'deleted')
        throw new CardError('serviceUnavailable', 503)
      return {
        message: 'successfullyDeleted',
        cleanupPending: !(await removeStoredFile(deleted.oldQrCodePath)),
      }
    },
  }
}

module.exports = {
  createCardManagement,
  CardError,
  validateCardId,
  validateCard,
  COMPANIES,
  LIST_FIELDS,
  EDITABLE_FIELDS,
  LOG_FIELDS,
  LIST_CARDS_QUERY,
  EDITABLE_CARD_QUERY,
  ACTIVITY_LOGS_QUERY,
  CARD_EXISTS_QUERY,
  SAVE_CARD_QUERY,
  DELETE_CARD_QUERY,
}
