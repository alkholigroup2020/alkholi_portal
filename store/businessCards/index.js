import { authErrorMessage } from '~/utils/auth-client'

const API = '/business-cards-api'
const TEXT_FIELDS = [
  ['employeeMailAddress', 'employeeMailAddress'],
  ['employeeCompany', 'company'],
  ['employeeArabicName', 'employeeArabicName'],
  ['employeeEnglishName', 'employeeEnglishName'],
  ['employeeArabicTitle', 'employeeArabicTitle'],
  ['employeeEnglishTitle', 'employeeEnglishTitle'],
  ['employeeMobileNumber', 'employeeMobileNumber'],
  ['employeeLandLines', 'employeeLandLines'],
  ['employeeWebSite', 'employeeWebSite'],
  ['bgColor', 'bgColor'],
  ['frColor', 'frColor'],
  ['mainColor', 'mainColor'],
  ['qrSize', 'qrSize'],
  ['faxLine', 'faxLine'],
]
const FILE_FIELDS = ['companyLogo', 'employeePicture', 'qrLogo']

export const state = () => ({
  userCardID: undefined,
  cards: [],
  activityLogs: [],
})

export const mutations = {
  SET_USER_CARD_ID(state, data) {
    state.userCardID = data
  },
  SET_CARDS(state, data) {
    state.cards = data
  },
  SET_ACTIVITY_LOGS(state, data) {
    state.activityLogs = data
  },
}

async function notifyError(store, dispatch, error) {
  await dispatch(
    'appNotifications/addNotification',
    { type: 'error', message: authErrorMessage(store, error, 'businessCards') },
    { root: true }
  )
}

export const actions = {
  async getGeneratedCards({ commit, dispatch }) {
    try {
      const serverCall = await this.$axios.get(
        `${this.$config.baseURL}${API}/cards`
      )
      await commit(
        'SET_CARDS',
        Array.isArray(serverCall.data) ? serverCall.data : []
      )
    } catch (error) {
      // Do not keep showing a list the caller may no longer be allowed to see.
      await commit('SET_CARDS', [])
      await notifyError(this, dispatch, error)
    }
  },
  async getActivityLogs({ commit, dispatch }) {
    try {
      const serverCall = await this.$axios.get(
        `${this.$config.baseURL}${API}/activity-logs`
      )
      await commit(
        'SET_ACTIVITY_LOGS',
        Array.isArray(serverCall.data) ? serverCall.data : []
      )
    } catch (error) {
      await commit('SET_ACTIVITY_LOGS', [])
      await notifyError(this, dispatch, error)
    }
  },
  // Resolves to the editable card, or null when it cannot be loaded.
  async getCard({ dispatch }, code) {
    try {
      const serverCall = await this.$axios.get(
        `${this.$config.baseURL}${API}/cards/${encodeURIComponent(code)}`
      )
      const card = serverCall.data
      return card && typeof card === 'object' && !Array.isArray(card)
        ? card
        : null
    } catch (error) {
      await notifyError(this, dispatch, error)
      return null
    }
  },
  // Resolves to the saved card's ID, or null when saving failed. The acting
  // administrator is taken from the session on the server.
  async saveEmployeeData({ commit, dispatch }, payload) {
    try {
      const dataToSend = new FormData()
      if (payload.employeeID)
        dataToSend.append('employeeID', payload.employeeID.toUpperCase())
      for (const [field, source] of TEXT_FIELDS) {
        const value = payload[source]
        if (value !== undefined && value !== null)
          dataToSend.append(field, value)
      }
      for (const field of FILE_FIELDS)
        if (payload[field]) dataToSend.append(field, payload[field])

      const serverCall = await this.$axios({
        method: 'post',
        url: `${this.$config.baseURL}${API}/save-employee-data`,
        data: dataToSend,
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const cardID = serverCall.data && serverCall.data.employeeID
      if (typeof cardID !== 'string' || !cardID) throw new Error('noCardID')
      await commit('SET_USER_CARD_ID', cardID)
      return cardID
    } catch (error) {
      await notifyError(this, dispatch, error)
      return null
    }
  },
  // Resolves to true only when the server confirmed the deletion.
  async deleteBusinessCard({ dispatch }, payload) {
    try {
      await this.$axios.post(
        `${this.$config.baseURL}${API}/delete-business-card`,
        { bCardID: payload.code }
      )
      await dispatch(
        'appNotifications/addNotification',
        {
          type: 'success',
          message: this.app.i18n.t(`successMessages.successDelete`),
        },
        { root: true }
      )
      return true
    } catch (error) {
      await notifyError(this, dispatch, error)
      return false
    }
  },
}

export const getters = {}
