export const state = () => ({
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
    localStorage.setItem('userMailAddress', data.message.toLocaleLowerCase())
    // set the authorization header
    const userToken = localStorage.getItem('userToken')
    this.$axios.defaults.headers.common.Authorization = `Bearer ${userToken}`
  },
  DELETE_USER_DATA(state) {
    state.userEmailAdd = null
    state.userFullName = null
    state.managerEmail = null
    state.branch = null
    state.employeeCode = null
    state.managerCode = null
    state.arName = null
    state.employeePicture = null
    state.domainName = null
    state.userAccount = null
    state.userIsLoggedIn = false
    localStorage.removeItem('userMailAddress')
    localStorage.removeItem('userToken')
    localStorage.removeItem('domainName')
    // localStorage.removeItem('colorMode')
    localStorage.removeItem('userAccount')
    localStorage.removeItem('userFullName')
    localStorage.removeItem('employeeCode')
    localStorage.removeItem('managerCode')
    localStorage.removeItem('firstNameAr')
    localStorage.removeItem('secondNameAr')
    localStorage.removeItem('profilePicPath')
    localStorage.removeItem('managerEmail')
    // remove authorization header
    this.$axios.defaults.headers.common.Authorization = ''
  },
}

export const actions = {
  async logInUser({ commit, dispatch }, payload) {
    try {
      // make the server call with the user credentials
      const login = await this.$axios.post(
        `${this.$config.baseURL}/login-api/login`,
        payload
      )
      if (login.status === 200) {
        // set the user states with the received data
        await commit('SAVE_USER_DATA', login.data)

        await dispatch('portal/getUserAuthorizations', undefined, {
          root: true,
        })
        await dispatch('portal/getUserProfile', undefined, { root: true })

        this.$router.push(this.localePath('/'))
      }
    } catch (error) {
      const notification = {
        type: 'error',
        message: this.app.i18n.t(
          `errorMessages.login.${error.response.data.message}`
        ),
      }
      dispatch('appNotifications/addNotification', notification, { root: true })
    }
  },

  async reAuthenticate({ commit, dispatch }, payload) {
    try {
      const authenticate = await this.$axios.post(
        `${this.$config.baseURL}/login-api/reauthenticate`,
        payload
      )
      if (authenticate.status === 200) {
        // set the user state with the received token
        await commit('SAVE_REAUTHENTICATE_USER_DATA', authenticate.data)
        await dispatch('portal/getUserAuthorizations', undefined, {
          root: true,
        })
        await dispatch('portal/getUserProfile', undefined, { root: true })
      }
    } catch (error) {
      const notification = {
        type: 'error',
        message: this.app.i18n.t(
          `errorMessages.login.${error.response.data.message}`
        ),
      }
      dispatch('appNotifications/addNotification', notification, { root: true })
      // logoff user
      const theToken = localStorage.getItem('userToken')
      const tokenPayload = { token: theToken }
      await dispatch('login/logoff', tokenPayload, { root: true })
    }
  },

  async logoff({ commit }, payload) {
    try {
      // make the server call with the user token to be deleted
      const logoff = await this.$axios.post(
        `${this.$config.baseURL}/login-api/logoff`,
        payload
      )
      if (logoff.status === 200) {
        // delete local storage data
        await commit('DELETE_USER_DATA')
        this.$router.push(this.localePath('/login'))
      }
    } catch (error) {
      await commit('DELETE_USER_DATA')
      this.$router.push(this.localePath('/login'))
    }
  },
}

export const getters = {}
