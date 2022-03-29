export const state = () => ({
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

    localStorage.setItem('userToken', userData.token)
    localStorage.setItem('userAccount', userData.userAccount)
    localStorage.setItem('domainName', userData.domain)
    localStorage.setItem(
      'userMailAddress',
      userData.user.mail.toLocaleLowerCase()
    )
    localStorage.setItem('employeeCode', userData.moreInfo.employee_code)
    localStorage.setItem('userFullName', userData.user.cn)
    localStorage.setItem('managerEmail', userData.managerInfo.Email)
    localStorage.setItem('managerCode', userData.moreInfo.Manager_Code)

    // set the authentication header
    this.$axios.defaults.headers.common.Authorization = `Bearer ${userData.token}`
  },
}

export const actions = {
  async logInUser({ commit, dispatch }, payload) {
    try {
      // make the server call with the user credentials
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/login-api/login`,
        payload
      )
      if (serverCall.status === 200) {
        // set the user states with the received data
        commit('SAVE_USER_DATA', serverCall.data)
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
}

export const getters = {}
