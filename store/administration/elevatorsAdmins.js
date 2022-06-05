export const state = () => ({
  elevatorsAdmins: [],
})

export const mutations = {
  SET_ELEVATORS_ADMINS(state, data) {
    state.elevatorsAdmins = data
  },
}

export const actions = {
  async getElevatorsAdmins({ commit, dispatch }) {
    try {
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/administration-api/sql-call`,
        { query: 'SELECT * FROM dbo.elevators_users' }
      )
      if (serverCall.status === 200) {
        await commit('SET_ELEVATORS_ADMINS', serverCall.data)
      }
    } catch (error) {
      const notification = {
        type: 'error',
        message: error.response.data.message,
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
    }
  },
  async addElevatorsAdmin({ dispatch }, payload) {
    try {
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/administration-api/add-elevators-survey-admin`,
        payload
      )
      if (serverCall.status === 200) {
        const notification = {
          type: 'success',
          message: this.app.i18n.t(
            `successMessages.administration.elevators.successAdd`
          ),
        }
        await dispatch('appNotifications/addNotification', notification, {
          root: true,
        })
      }
    } catch (error) {
      const notification = {
        type: 'error',
        message: this.app.i18n.t(
          `errorMessages.administration.elevators.${error.response.data.message}`
        ),
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
    }
  },
  async deleteElevatorsAdmin({ dispatch }, payload) {
    try {
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/administration-api/delete-elevators-survey-admin`,
        payload
      )
      if (serverCall.status === 200) {
        const notification = {
          type: 'success',
          message: this.app.i18n.t(
            `successMessages.administration.elevators.successDelete`
          ),
        }
        await dispatch('appNotifications/addNotification', notification, {
          root: true,
        })
      }
    } catch (error) {
      const notification = {
        type: 'error',
        message: this.app.i18n.t(
          `errorMessages.administration.elevators.${error.response.data.message}`
        ),
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
    }
  },
}

export const getters = {}
