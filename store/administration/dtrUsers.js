import { authErrorMessage } from '~/utils/auth-client'

export const state = () => ({
  dtrUsers: [],
})

export const mutations = {
  SET_DTR_USERS(state, data) {
    state.dtrUsers = data
  },
}

export const actions = {
  async getDTRUsers({ commit, dispatch }) {
    try {
      const serverCall = await this.$axios.get(
        `${this.$config.baseURL}/administration-api/members/dtr`
      )
      if (serverCall.status === 200) {
        await commit('SET_DTR_USERS', serverCall.data)
      }
    } catch (error) {
      // Do not keep showing a list the caller may no longer be allowed to see.
      await commit('SET_DTR_USERS', [])
      const notification = {
        type: 'error',
        message: authErrorMessage(this, error, 'administration.members'),
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
    }
  },
  async addDTRUser({ dispatch }, payload) {
    try {
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/administration-api/add-dtr-user`,
        payload
      )
      if (serverCall.status === 200) {
        const notification = {
          type: 'success',
          message: this.app.i18n.t(
            `successMessages.administration.dtrApp.successAdd`
          ),
        }
        await dispatch('appNotifications/addNotification', notification, {
          root: true,
        })
      }
    } catch (error) {
      const notification = {
        type: 'error',
        message: authErrorMessage(this, error, 'administration.dtrApp'),
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
    }
  },
  async deleteDTRUser({ dispatch }, payload) {
    try {
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/administration-api/delete-dtr-user`,
        payload
      )
      if (serverCall.status === 200) {
        const notification = {
          type: 'success',
          message: this.app.i18n.t(
            `successMessages.administration.dtrApp.successDelete`
          ),
        }
        await dispatch('appNotifications/addNotification', notification, {
          root: true,
        })
      }
    } catch (error) {
      const notification = {
        type: 'error',
        message: authErrorMessage(this, error, 'administration.dtrApp'),
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
    }
  },
}

export const getters = {}
