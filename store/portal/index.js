export const state = () => ({
  profilePicPath: '',
  isBusinessCardsAdmin: undefined,
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
    state.isBusinessCardsAdmin = data.isBusinessCardsAdmin
  },
}

export const actions = {
  async getUserProfile({ commit, dispatch }) {
    try {
      const userToken = localStorage.getItem('userToken')
      const employeeCode = localStorage.getItem('employeeCode')
      this.$axios.defaults.headers.common.Authorization = `Bearer ${userToken}`
      // get user profile data
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/portal-api/get-user-profile`,
        {
          employeeID: employeeCode,
        }
      )
      if (serverCall.status === 200) {
        await commit('SET_USER_PROFILE_DATA', serverCall.data)
      }
    } catch (error) {
      const notification = {
        type: 'error',
        message: this.app.i18n.t(
          `errorMessages.portal.${error.response.data.message}`
        ),
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
      // logoff user
      const theToken = localStorage.getItem('userToken')
      const tokenPayload = { token: theToken }
      await dispatch('login/logoff', tokenPayload, { root: true })
    }
  },

  async saveUserProfile({ dispatch }, payload) {
    try {
      const FormData = require('form-data')
      const profileData = new FormData()
      profileData.append('attachment', payload.img)
      profileData.append('employeeCode', payload.eCode)

      const serverCall = await this.$axios({
        method: 'post',
        url: `${this.$config.baseURL}/portal-api/save-user-profile`,
        data: profileData,
        headers: { 'Content-Type': 'multipart/form-data' },
      })
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

  async getUserAuthorizations({ commit, dispatch }) {
    try {
      const employeeCode = localStorage.getItem('employeeCode')
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/portal-api/get-user-authorizations`,
        {
          employeeID: employeeCode,
        }
      )
      if (serverCall.status === 200) {
        await commit('SET_USER_AUTHORIZATIONS_DATA', serverCall.data)
      }
    } catch (error) {
      const notification = {
        type: 'error',
        message: error.response.data.message,
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
      // logoff user
      const theToken = localStorage.getItem('userToken')
      const tokenPayload = { token: theToken }
      await dispatch('login/logoff', tokenPayload, { root: true })
    }
  },
}

export const getters = {}
