export const state = () => ({
  cocAdmins: [],
})

export const mutations = {
  SET_COC_ADMINS(state, data) {
    state.cocAdmins = data
  },
}

export const actions = {
  async getCOCAdmins({ commit, dispatch }) {
    try {
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/administration-api/sql-call`,
        { query: 'SELECT * FROM dbo.coc_admins' }
      )
      if (serverCall.status === 200) {
        await commit('SET_COC_ADMINS', serverCall.data)
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

  async addCOCAdmin({ dispatch }, payload) {
    try {
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/administration-api/add-coc-admin`,
        payload
      )
      if (serverCall.status === 200) {
        const notification = {
          type: 'success',
          message: this.app.i18n.t(
            `successMessages.administration.bCards.successAdd`
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
          `errorMessages.administration.bCards.${error.response.data.message}`
        ),
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
    }
  },

  async deleteCOCAdmin({ dispatch }, payload) {
    try {
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/administration-api/delete-coc-admin`,
        payload
      )
      if (serverCall.status === 200) {
        const notification = {
          type: 'success',
          message: this.app.i18n.t(
            `successMessages.administration.bCards.successDelete`
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
          `errorMessages.administration.bCards.${error.response.data.message}`
        ),
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
    }
  },
}

export const getters = {}
