import { authErrorMessage } from '~/utils/auth-client'

export const state = () => ({
  profilePicPath: '',
  isPortalAdmin: undefined,
  isBusinessCardsAdmin: undefined,
  isElevatorsSurveysUser: undefined,
  isHRSurveysUser: undefined,
  isDTRUser: undefined,
  isCOCAdmin: undefined,
  toolbarWidth: undefined,
})

export const mutations = {
  SET_USER_PROFILE_DATA(state, data) {
    if (data.portalProfilePicPath == null) {
      if (data.profilePicPath === 'profile.png') {
        state.profilePicPath = `${this.$config.baseURL}/portal-api/profile-data/profile.png`
        localStorage.setItem(
          'profilePicPath',
          `${this.$config.baseURL}/portal-api/profile-data/profile.png`
        )
      } else {
        state.profilePicPath = `https://hr.alkholi.com/MenaITech/application/hrms/MenaImages/Employees_Pictures/${data.profilePicPath}`
        localStorage.setItem(
          'profilePicPath',
          `https://hr.alkholi.com/MenaITech/application/hrms/MenaImages/Employees_Pictures/${data.profilePicPath}`
        )
      }
    } else {
      state.profilePicPath = `${this.$config.baseURL}/portal-api/profile-data/${data.portalProfilePicPath}`
      localStorage.setItem(
        'profilePicPath',
        `${this.$config.baseURL}/portal-api/profile-data/${data.portalProfilePicPath}`
      )
    }
  },
  SET_USER_AUTHORIZATIONS_DATA(state, data) {
    state.isPortalAdmin = data.isPortalAdmin
    state.isBusinessCardsAdmin = data.isBusinessCardsAdmin
    state.isCOCAdmin = data.isCOCAdmin
    state.isElevatorsSurveysUser = data.isElevatorsSurveysUser
    state.isHRSurveysUser = data.isHRSurveysUser
    state.isDTRUser = data.isDTRUser
  },
  SET_TOOLBAR_WIDTH(state, data) {
    state.toolbarWidth = data
  },
}

export const actions = {
  async getUserProfile({ commit, dispatch }) {
    const token = localStorage.getItem('userToken')
    if (!token) return false
    try {
      const response = await this.$axios.post(
        `${this.$config.baseURL}/portal-api/get-user-profile`,
        {}
      )
      if (token !== localStorage.getItem('userToken')) return false
      commit('SET_USER_PROFILE_DATA', response.data)
      return true
    } catch (error) {
      if (token !== localStorage.getItem('userToken')) return false
      await dispatch(
        'appNotifications/addNotification',
        {
          type: 'error',
          message: authErrorMessage(this, error, 'portal'),
        },
        { root: true }
      )
      await dispatch('login/logoff', undefined, { root: true })
      return false
    }
  },

  async saveUserProfile({ dispatch }, image) {
    const token = localStorage.getItem('userToken')
    if (!token) return false
    try {
      const profileData = new FormData()
      profileData.append('attachment', image)

      const serverCall = await this.$axios({
        method: 'post',
        url: `${this.$config.baseURL}/portal-api/save-user-profile`,
        data: profileData,
      })
      if (token !== localStorage.getItem('userToken')) return false
      if (serverCall.status === 201) {
        const notification = {
          type: 'success',
          message: this.app.i18n.t(
            `successMessages.portal.${serverCall.data.message}`
          ),
        }
        await dispatch('appNotifications/addNotification', notification, {
          root: true,
        })
        return true
      }
      return false
    } catch (error) {
      if (token !== localStorage.getItem('userToken')) return false
      const notification = {
        type: 'error',
        message: authErrorMessage(this, error, 'portal'),
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
      if (error && error.response && error.response.status === 401)
        await dispatch('login/logoff', undefined, { root: true })
      return false
    }
  },

  async getUserAuthorizations({ commit, dispatch }) {
    const token = localStorage.getItem('userToken')
    if (!token) return false
    try {
      const response = await this.$axios.post(
        `${this.$config.baseURL}/portal-api/get-user-authorizations`,
        {}
      )
      if (token !== localStorage.getItem('userToken')) return false
      commit('SET_USER_AUTHORIZATIONS_DATA', response.data)
      return true
    } catch (error) {
      if (token !== localStorage.getItem('userToken')) return false
      await dispatch(
        'appNotifications/addNotification',
        {
          type: 'error',
          message: authErrorMessage(this, error, 'login'),
        },
        { root: true }
      )
      await dispatch('login/logoff', undefined, { root: true })
      return false
    }
  },

  async setToolbarsWidth({ commit, dispatch }, payload) {
    try {
      await commit('SET_TOOLBAR_WIDTH', payload)
    } catch (error) {
      const notification = {
        type: 'error',
        message: error,
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
    }
  },
}

export const getters = {}
