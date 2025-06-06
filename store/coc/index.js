export const state = () => ({})

export const mutations = {}

export const actions = {
  async saveCoCDocument({ dispatch }, payload) {
    try {
      const FormData = require('form-data')
      const dataToSend = new FormData()

      dataToSend.append('adminID', payload.adminID.toUpperCase())
      dataToSend.append('adminName', payload.adminName)
      dataToSend.append('versionNumber', payload.versionNumber)
      dataToSend.append('attachment', payload.cocFile)

      const serverCall = await this.$axios({
        method: 'post',
        url: `${this.$config.baseURL}/coc-api/save-coc-document`,
        data: dataToSend,
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      if (serverCall.status === 201) {
        const notification = {
          type: 'success',
          message: 'Document uploaded successfully!',
        }
        await dispatch('appNotifications/addNotification', notification, {
          root: true,
        })
        await dispatch('fetchCoCVersions')
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

  async processSignedDocument({ dispatch }, payload) {
    try {
      const FormData = require('form-data')
      const dataToSend = new FormData()

      dataToSend.append('employeeID', payload.employeeID.toUpperCase())
      dataToSend.append('employeeName', payload.employeeName)
      dataToSend.append('versionNumber', payload.versionNumber)
      dataToSend.append('signedForm', payload.uploadedDocument)

      const serverCall = await this.$axios({
        method: 'post',
        url: `${this.$config.baseURL}/coc-api/upload-signed-form`,
        data: dataToSend,
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      if (serverCall.status === 200) {
        const notification = {
          type: 'success',
          message: serverCall.data.message,
        }
        await dispatch('appNotifications/addNotification', notification, {
          root: true,
        })

        await dispatch('fetchCoCVersions')

        return serverCall.data
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

  async fetchCoCVersions({ dispatch }) {
    try {
      const response = await this.$axios.get(
        `${this.$config.baseURL}/coc-api/get-coc-versions`
      )

      if (response.status === 200) {
        return response.data
      }
    } catch (error) {
      const notification = {
        type: 'error',
        message: error.response.data.message,
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
      return []
    }
  },

  async fetchEmployeesData({ dispatch }) {
    try {
      const response = await this.$axios.get(
        `${this.$config.baseURL}/coc-api/get-employee-compliance`
      )

      if (response.status === 200) {
        return response.data
      }
    } catch (error) {
      const notification = {
        type: 'error',
        message: error.response.data.message,
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
      return []
    }
  },

  async fetchEmployeeData({ dispatch }, payload) {
    try {
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/coc-api/get-single-employee-data`,
        {
          employeeID: payload.employeeID.toUpperCase(),
          userFullName: payload.userFullName,
          userMailAddress: payload.userMailAddress,
          branchCode: payload.branchCode,
          titleEnglish: payload.titleEnglish,
          titleArabic: payload.titleArabic,
        }
      )

      if (serverCall.status === 200) {
        return serverCall.data
      }
    } catch (error) {
      const notification = {
        type: 'error',
        message: error.response.data.message,
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
      return []
    }
  },

  // delete CoC document
  async deleteCoCVersion({ dispatch }, versionId) {
    try {
      const response = await this.$axios.delete(
        `${this.$config.baseURL}/coc-api/delete-version/${versionId}`
      )

      if (response.status === 200) {
        await dispatch('fetchCoCVersions')
        const notification = {
          type: 'success',
          message: 'Version deleted successfully!',
        }
        await dispatch('appNotifications/addNotification', notification, {
          root: true,
        })
      }
      return true
    } catch (error) {
      const notification = {
        type: 'error',
        message: error.response.data.message,
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
      return false
    }
  },
}

export const getters = {}
