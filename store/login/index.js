import { authErrorMessage } from '~/utils/auth-client'

export const state = () => ({
  sessionRevision: 0,
  branchCode: null,
  titleEnglish: null,
  titleArabic: null,
  userEmailAdd: null,
  userFullName: null,
  managerEmail: null,
  managerCode: null,
  branch: null,
  employeeCode: null,
  arName: null,
  employeePicture: null,
  domainName: null,
  userAccount: null,
  userIsLoggedIn: false,
})

export const mutations = {
  SAVE_USER_DATA(state, userData) {
    state.branchCode = userData.moreInfo.branch_code
    state.titleEnglish = userData.moreInfo.title
    state.titleArabic = userData.moreInfo.title_a
    state.userEmailAdd = userData.user.mail
    state.userFullName = userData.user.cn
    state.managerEmail = userData.managerInfo.Email
    state.managerCode = userData.moreInfo.Manager_Code
    state.branch = userData.moreInfo.branch_code
    state.employeeCode = userData.moreInfo.employee_code
    state.arName = userData.moreInfo.employee_name_a
    state.employeePicture = userData.moreInfo.employee_picture
    state.domainName = userData.domain
    state.userAccount = userData.userAccount
    state.userIsLoggedIn = true

    localStorage.setItem('branchCode', userData.moreInfo.branch_code)
    localStorage.setItem('titleEnglish', userData.moreInfo.title)
    localStorage.setItem('titleArabic', userData.moreInfo.title_a)
    localStorage.setItem('userToken', userData.token)
    localStorage.setItem('userAccount', userData.userAccount)
    localStorage.setItem('domainName', userData.domain)
    localStorage.setItem(
      'userMailAddress',
      userData.user.mail.toLocaleLowerCase()
    )
    localStorage.setItem('employeeCode', userData.moreInfo.employee_code)
    localStorage.setItem('firstNameAr', userData.moreInfo.first_name_a)
    localStorage.setItem('secondNameAr', userData.moreInfo.second_name_a)
    localStorage.setItem('userFullName', userData.user.cn)
    localStorage.setItem('managerEmail', userData.managerInfo.Email)
    localStorage.setItem('managerCode', userData.moreInfo.Manager_Code)
    // set the authentication header
    this.$axios.defaults.headers.common.Authorization = `Bearer ${userData.token}`
  },
  SAVE_REAUTHENTICATE_USER_DATA(state, data) {
    state.userIsLoggedIn = true
    state.employeeCode = data.employeeCode
    state.userAccount = data.userAccount
    state.domainName = data.domain
    state.userEmailAdd = data.message.toLowerCase()
    localStorage.setItem('employeeCode', data.employeeCode)
    localStorage.setItem('userAccount', data.userAccount)
    localStorage.setItem('domainName', data.domain)
    localStorage.setItem('userMailAddress', data.message.toLowerCase())
    // set the authorization header
    const userToken = localStorage.getItem('userToken')
    this.$axios.defaults.headers.common.Authorization = `Bearer ${userToken}`
  },
  DELETE_USER_DATA(currentState) {
    const sessionRevision = currentState.sessionRevision + 1
    Object.assign(currentState, state(), { sessionRevision })
    this.$axios.defaults.headers.common.Authorization = ''
    for (const key of [
      'userMailAddress',
      'userToken',
      'domainName',
      'userAccount',
      'userFullName',
      'employeeCode',
      'managerCode',
      'firstNameAr',
      'secondNameAr',
      'profilePicPath',
      'managerEmail',
      'branchCode',
      'titleEnglish',
      'titleArabic',
    ])
      localStorage.removeItem(key)
  },
}

export const actions = {
  clearSession({ commit }) {
    commit('DELETE_USER_DATA')
    commit('RESET_SESSION_DATA', undefined, { root: true })
  },

  async logInUser({ commit, dispatch, state }, payload) {
    await dispatch('clearSession')
    const revision = state.sessionRevision
    try {
      const login = await this.$axios.post(
        `${this.$config.baseURL}/login-api/login`,
        payload
      )
      if (revision !== state.sessionRevision) return false
      commit('SAVE_USER_DATA', login.data)
      if (
        !(await dispatch('portal/getUserAuthorizations', undefined, {
          root: true,
        }))
      )
        return false
      if (!(await dispatch('portal/getUserProfile', undefined, { root: true })))
        return false
      return revision === state.sessionRevision && state.userIsLoggedIn
    } catch (error) {
      if (revision !== state.sessionRevision) return false
      await dispatch('clearSession')
      await dispatch(
        'appNotifications/addNotification',
        {
          type: 'error',
          message: authErrorMessage(this, error),
        },
        { root: true }
      )
      return false
    }
  },

  async reAuthenticate({ commit, dispatch, state }) {
    const token = localStorage.getItem('userToken')
    const revision = state.sessionRevision
    if (!token) {
      await dispatch('logoff')
      return false
    }
    this.$axios.defaults.headers.common.Authorization = `Bearer ${token}`
    try {
      const authenticate = await this.$axios.post(
        `${this.$config.baseURL}/login-api/reauthenticate`,
        {}
      )
      if (
        revision !== state.sessionRevision ||
        token !== localStorage.getItem('userToken')
      )
        return false
      commit('SAVE_REAUTHENTICATE_USER_DATA', authenticate.data)
      if (
        !(await dispatch('portal/getUserAuthorizations', undefined, {
          root: true,
        }))
      )
        return false
      if (!(await dispatch('portal/getUserProfile', undefined, { root: true })))
        return false
      return revision === state.sessionRevision && state.userIsLoggedIn
    } catch (error) {
      if (
        revision !== state.sessionRevision ||
        token !== localStorage.getItem('userToken')
      )
        return false
      await dispatch(
        'appNotifications/addNotification',
        {
          type: 'error',
          message: authErrorMessage(this, error),
        },
        { root: true }
      )
      await dispatch('logoff')
      return false
    }
  },

  async logoff({ dispatch, state }) {
    const token = localStorage.getItem('userToken')
    // Clear immediately, including while the revocation request is offline.
    await dispatch('clearSession')
    const revision = state.sessionRevision
    try {
      if (token)
        await this.$axios.post(
          `${this.$config.baseURL}/login-api/logoff`,
          {},
          { timeout: 15000, headers: { Authorization: `Bearer ${token}` } }
        )
    } catch (error) {
      const status = error && error.response && error.response.status
      if (status !== 401 && revision === state.sessionRevision) {
        await dispatch(
          'appNotifications/addNotification',
          {
            type: 'error',
            message: this.app.i18n.t('errorMessages.login.logoutUnavailable'),
          },
          { root: true }
        )
      }
    } finally {
      if (revision === state.sessionRevision)
        await this.$router.push(this.localePath('/login'))
    }
  },
}

export const getters = {}
