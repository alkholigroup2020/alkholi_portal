import { authErrorMessage } from '~/utils/auth-client'

export const state = () => ({
  portalAdmins: [],
})

export const mutations = {
  SET_PORTAL_ADMINS(state, data) {
    state.portalAdmins = data
  },
}

export const actions = {
  async getPortalAdmins({ commit, dispatch }) {
    try {
      const serverCall = await this.$axios.get(
        `${this.$config.baseURL}/administration-api/members/portal`
      )
      if (serverCall.status === 200) {
        await commit('SET_PORTAL_ADMINS', serverCall.data)
      }
    } catch (error) {
      // Do not keep showing a list the caller may no longer be allowed to see.
      await commit('SET_PORTAL_ADMINS', [])
      const notification = {
        type: 'error',
        message: authErrorMessage(this, error, 'administration.members'),
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
    }
  },
  async addPortalAdmin({ dispatch }, payload) {
    try {
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/administration-api/add-portal-admin`,
        payload
      )
      if (serverCall.status === 200) {
        const notification = {
          type: 'success',
          message: this.app.i18n.t(
            `successMessages.administration.portalAdmins.successAdd`
          ),
        }
        await dispatch('appNotifications/addNotification', notification, {
          root: true,
        })
      }
    } catch (error) {
      const notification = {
        type: 'error',
        message: authErrorMessage(this, error, 'administration.portalAdmins'),
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
    }
  },
  async deletePortalAdmin({ dispatch }, payload) {
    try {
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/administration-api/delete-portal-admin`,
        payload
      )
      if (serverCall.status === 200) {
        const notification = {
          type: 'success',
          message: this.app.i18n.t(
            `successMessages.administration.portalAdmins.successDelete`
          ),
        }
        await dispatch('appNotifications/addNotification', notification, {
          root: true,
        })
      }
    } catch (error) {
      const notification = {
        type: 'error',
        message: authErrorMessage(this, error, 'administration.portalAdmins'),
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
    }
  },
}

export const getters = {}
