export const state = () => ({
  employeeInfo: {},
})

export const mutations = {
  SET_EMPLOYEE_INFO(state, data) {
    state.employeeInfo = data
  },
}

export const actions = {
  async getEmployeeInfo({ dispatch, commit }, payload) {
    try {
      // reset the value of employeeInfo first
      await commit('SET_EMPLOYEE_INFO', {})
      // make the call to get the info
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/administration-api/get-employee-info`,
        payload
      )
      await commit('SET_EMPLOYEE_INFO', serverCall.data)
    } catch (error) {
      const notification = {
        type: 'error',
        message: this.app.i18n.t(
          `errorMessages.administration.dtrSetup.${error.response.data.message}`
        ),
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
    }
  },
}

export const getters = {}
