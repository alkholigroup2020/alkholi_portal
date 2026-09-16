const { AuthError, sendAuthError } = require('./errors')
const { validateLogin, isString } = require('./validation')

function createAuth({ repository, sessions, adAuth, cipher }) {
  return {
    async authorize(req, res, next) {
      try {
        const identity = sessions.fromRequest(req)
        if (!(await repository.isRegistered(identity)))
          throw new AuthError('authFailed')
        req.auth = identity
      } catch (error) {
        return sendAuthError(res, error)
      }
      return next()
    },
    async login(req, res) {
      try {
        const credentials = validateLogin(req.body)
        const user = await adAuth(
          credentials.userAccount,
          credentials.password,
          credentials.domain
        )
        if (!isString(user.mail, 100) || !isString(user.sAMAccountName, 256))
          throw new AuthError('hrDataMissing', 404)
        const moreInfo = await repository.getMoreInfo(user.mail)
        const managerInfo = await repository.getManagerInfo(
          moreInfo.Manager_Code
        )
        const userAccount = user.sAMAccountName.toLowerCase()
        const token = sessions.issue({
          employeeCode: moreInfo.employee_code,
          userAccount,
          domain: credentials.domain,
        })
        const encryptedPassword = cipher.encrypt(credentials.password)
        await repository.saveLogin({
          moreInfo,
          managerInfo,
          user,
          encryptedPassword,
          token,
        })
        return res
          .status(200)
          .send({
            token,
            user,
            moreInfo,
            managerInfo,
            domain: credentials.domain,
            userAccount,
          })
      } catch (error) {
        return sendAuthError(res, error)
      }
    },
    async reauthenticate(req, res) {
      try {
        const stored = await repository.getCredentials(req.auth.employeeCode)
        let password
        try {
          password = cipher.decrypt(stored.groupID)
        } catch {
          throw new AuthError('authFailed')
        }
        const user = await adAuth(
          req.auth.userAccount,
          password,
          req.auth.domain
        )
        if (
          !isString(user.mail, 100) ||
          !isString(user.sAMAccountName, 256) ||
          typeof stored.mailAddress !== 'string' ||
          user.mail.toLowerCase() !== stored.mailAddress.toLowerCase() ||
          user.sAMAccountName.toLowerCase() !== req.auth.userAccount
        )
          throw new AuthError('authFailed')
        return res
          .status(200)
          .json({
            message: user.mail,
            employeeCode: req.auth.employeeCode,
            userAccount: req.auth.userAccount,
            domain: req.auth.domain,
          })
      } catch (error) {
        return sendAuthError(res, error)
      }
    },
    async logoff(req, res) {
      try {
        // Signature validation only: an already-revoked token can log out again.
        const identity = sessions.fromRequest(req)
        await repository.revokeToken(identity.token)
        return res.status(200).send()
      } catch (error) {
        return sendAuthError(res, error)
      }
    },
  }
}

module.exports = { createAuth }
