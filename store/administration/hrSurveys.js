import { authErrorMessage } from '~/utils/auth-client'

export const state = () => ({
  hrSurveyUsers: [],
})

export const mutations = {
  SET_HR_SURVEYS_USERS(state, data) {
    state.hrSurveyUsers = data
  },
}

export const actions = {
  async getHRSurveyUsers({ commit, dispatch }) {
    try {
      const serverCall = await this.$axios.get(
        `${this.$config.baseURL}/administration-api/members/hr-surveys`
      )
      if (serverCall.status === 200) {
        await commit('SET_HR_SURVEYS_USERS', serverCall.data)
      }
    } catch (error) {
      // Do not keep showing a list the caller may no longer be allowed to see.
      await commit('SET_HR_SURVEYS_USERS', [])
      const notification = {
        type: 'error',
        message: authErrorMessage(this, error, 'administration.members'),
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
    }
  },
  async addHRSurveyUser({ dispatch }, payload) {
    try {
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/administration-api/add-hr-survey-user`,
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
        message: authErrorMessage(this, error, 'administration.elevators'),
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
    }
  },
  async deleteHRSurveyUser({ dispatch }, payload) {
    try {
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/administration-api/delete-hr-survey-user`,
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
        message: authErrorMessage(this, error, 'administration.elevators'),
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
    }
  },
}

export const getters = {}
