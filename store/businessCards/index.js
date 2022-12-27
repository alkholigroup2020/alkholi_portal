export const state = () => ({
  userCardID: undefined,
})

export const mutations = {
  SET_USER_CARD_ID(state, data) {
    state.userCardID = data
  },
}

export const actions = {
  async saveEmployeeData({ commit, dispatch }, payload) {
    try {
      const FormData = require('form-data')
      const dataToSend = new FormData()

      if (payload.employeeID !== undefined) {
        dataToSend.append('employeeID', payload.employeeID.toUpperCase())
      } else {
        dataToSend.append('employeeID', payload.employeeID)
      }

      dataToSend.append('employeeMailAddress', payload.employeeMailAddress)
      dataToSend.append('employeeCompany', payload.company)
      dataToSend.append('employeeArabicName', payload.employeeArabicName)
      dataToSend.append('employeeEnglishName', payload.employeeEnglishName)
      dataToSend.append('employeeArabicTitle', payload.employeeArabicTitle)
      dataToSend.append('employeeEnglishTitle', payload.employeeEnglishTitle)
      dataToSend.append('employeeMobileNumber', payload.employeeMobileNumber)
      dataToSend.append('employeeLandLines', payload.employeeLandLines)
      dataToSend.append('companyLogo', payload.companyLogo)
      dataToSend.append('employeeWebSite', payload.employeeWebSite)
      dataToSend.append('employeePicture', payload.employeePicture)
      dataToSend.append('qrLogo', payload.qrLogo)
      dataToSend.append('bgColor', payload.bgColor)
      dataToSend.append('frColor', payload.frColor)
      dataToSend.append('qrSize', payload.qrSize)
      dataToSend.append('faxLine', payload.faxLine)
      dataToSend.append('creator', payload.creator)

      const serverCall = await this.$axios({
        method: 'post',
        url: `${this.$config.baseURL}/business-cards-api/save-employee-data`,
        data: dataToSend,
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      if (serverCall.status === 200) {
        await commit('SET_USER_CARD_ID', serverCall.data)
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
  async deleteBusinessCard({ commit, dispatch }, payload) {
    const A = localStorage.getItem('userAccount')
    const B = localStorage.getItem('employeeCode')
    const C = localStorage.getItem('userFullName')

    const callData = {
      adminAccount: A,
      adminID: B,
      adminName: C,
      bCardID: payload.code,
      qrFileName: payload.file,
      employeeCardName: payload.name,
    }

    try {
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/business-cards-api/delete-business-card`,
        callData
      )
      if (serverCall.status === 200) {
        const notification = {
          type: 'success',
          message: this.app.i18n.t(`successMessages.successDelete`),
        }
        await dispatch('appNotifications/addNotification', notification, {
          root: true,
        })
      }
    } catch (error) {
      const notification = {
        type: 'error',
        message: this.app.i18n.t(
          `errorMessages.${error.response.data.message}`
        ),
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
    }
  },
}

export const getters = {}
