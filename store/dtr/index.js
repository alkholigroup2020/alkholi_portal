import { authErrorMessage } from '~/utils/auth-client'

const API = '/dtr-api'

async function notifyError(store, dispatch, error) {
  await dispatch(
    'appNotifications/addNotification',
    { type: 'error', message: authErrorMessage(store, error, 'dtr') },
    { root: true }
  )
}

export const state = () => ({
  dtrAppStartDate: undefined,
  dtrAppEndDate: undefined,
})

export const mutations = {
  SET_START_END_DATES(state, payload) {
    state.dtrAppStartDate = payload.start
    state.dtrAppEndDate = payload.end
  },
}

// The server takes the caller from the session: no action sends an
// administrator, manager or assignment identity. `start` and `end` are the
// period as YYYY-MM-DD.
export const actions = {
  async saveStartAndEndDates({ commit, dispatch }, payload) {
    try {
      await commit('SET_START_END_DATES', payload)
    } catch (error) {
      const notification = {
        type: 'error',
        message: "Couldn't Save In The Store!",
      }
      await dispatch('appNotifications/addNotification', notification, {
        root: true,
      })
    }
  },

  // Resolves to the employees assigned to the caller; empty when none or when
  // the list cannot be loaded.
  async getAssignedEmployees({ dispatch }) {
    try {
      const serverCall = await this.$axios.get(
        `${this.$config.baseURL}${API}/assigned-employees`
      )
      return Array.isArray(serverCall.data) ? serverCall.data : []
    } catch (error) {
      await notifyError(this, dispatch, error)
      return []
    }
  },

  // Resolves to the entry statuses of the assigned employees (or of the one
  // given by `employeeCode`) for the period, or null when they cannot be loaded.
  async getPeriodEntries({ dispatch }, { start, end, employeeCode }) {
    try {
      const params = { start, end }
      if (employeeCode) params.employeeCode = employeeCode
      const serverCall = await this.$axios.get(
        `${this.$config.baseURL}${API}/period-entries`,
        { params }
      )
      return Array.isArray(serverCall.data) ? serverCall.data : []
    } catch (error) {
      await notifyError(this, dispatch, error)
      return null
    }
  },

  // Resolves to `{ EmployeeCode, entry }` (entry is null when nothing is saved
  // yet), or null when the calendar cannot be loaded.
  async getCalendar({ dispatch }, { employeeCode, start, end }) {
    try {
      const serverCall = await this.$axios.get(
        `${this.$config.baseURL}${API}/employees/${encodeURIComponent(
          employeeCode
        )}/calendar`,
        { params: { start, end } }
      )
      const calendar = serverCall.data
      return calendar &&
        typeof calendar === 'object' &&
        !Array.isArray(calendar)
        ? calendar
        : null
    } catch (error) {
      await notifyError(this, dispatch, error)
      return null
    }
  },

  // Resolves to the HR details of an assigned employee, or null.
  async getEmployee({ dispatch }, employeeCode) {
    try {
      const serverCall = await this.$axios.get(
        `${this.$config.baseURL}${API}/employees/${encodeURIComponent(
          employeeCode
        )}`
      )
      const employee = serverCall.data
      return employee &&
        typeof employee === 'object' &&
        !Array.isArray(employee)
        ? employee
        : null
    } catch (error) {
      await notifyError(this, dispatch, error)
      return null
    }
  },

  // Resolves to the pending entries of the period that await the caller's
  // approval; empty when none or when the list cannot be loaded.
  async getPendingApprovals({ dispatch }, { start, end }) {
    try {
      const serverCall = await this.$axios.get(
        `${this.$config.baseURL}${API}/pending-approvals`,
        { params: { start, end } }
      )
      return Array.isArray(serverCall.data) ? serverCall.data : []
    } catch (error) {
      await notifyError(this, dispatch, error)
      return []
    }
  },
}

export const getters = {}
