import { authErrorMessage } from '~/utils/auth-client'

const PATH_FIELDS = [
  'branch',
  'division',
  'department',
  'project',
  'subProject',
]

// Only the hierarchy codes that are set; lower levels are omitted entirely.
function pathParams(path = {}) {
  const params = {}
  for (const field of PATH_FIELDS) {
    const value = path[field]
    if (value !== undefined && value !== null && value !== '')
      params[field] = value
  }
  return params
}

// A list response that is not an array is treated as empty.
function rows(data) {
  return Array.isArray(data) ? data : []
}

async function notifyError(store, dispatch, error) {
  const notification = {
    type: 'error',
    message: authErrorMessage(store, error, 'administration.dtrSetup'),
  }
  await dispatch('appNotifications/addNotification', notification, {
    root: true,
  })
}

export const state = () => ({
  employeeInfo: {},
})

export const mutations = {
  SET_EMPLOYEE_INFO(state, data) {
    state.employeeInfo = data
  },
}

export const actions = {
  async getEmployeeInfo({ dispatch, commit }, payload) {
    try {
      // reset the value of employeeInfo first
      await commit('SET_EMPLOYEE_INFO', {})
      // make the call to get the info
      const serverCall = await this.$axios.post(
        `${this.$config.baseURL}/administration-api/get-employee-info`,
        payload
      )
      await commit('SET_EMPLOYEE_INFO', serverCall.data)
    } catch (error) {
      await notifyError(this, dispatch, error)
    }
  },

  // kind: companies | branches | divisions | departments | projects | sub-projects
  async getOrganization({ dispatch }, { kind, path }) {
    try {
      const serverCall = await this.$axios.get(
        `${this.$config.baseURL}/administration-api/dtr-setup/organization/${kind}`,
        { params: pathParams(path) }
      )
      return rows(serverCall.data)
    } catch (error) {
      await notifyError(this, dispatch, error)
      return []
    }
  },

  // level: division | department | project | sub-project
  async getEmployees({ dispatch }, { level, path }) {
    try {
      const serverCall = await this.$axios.get(
        `${this.$config.baseURL}/administration-api/dtr-setup/employees/${level}`,
        { params: pathParams(path) }
      )
      return rows(serverCall.data)
    } catch (error) {
      await notifyError(this, dispatch, error)
      return []
    }
  },

  async getAssignments({ dispatch }, { level, path }) {
    try {
      const serverCall = await this.$axios.get(
        `${this.$config.baseURL}/administration-api/dtr-setup/assignments/${level}`,
        { params: pathParams(path) }
      )
      return rows(serverCall.data)
    } catch (error) {
      await notifyError(this, dispatch, error)
      return []
    }
  },

  // Resolves to 'created', 'exists' or 'failed'; employee details and the
  // duplicate check are handled by the server.
  async createAssignment({ dispatch }, { level, path, employeeCode, roles }) {
    try {
      await this.$axios.post(
        `${this.$config.baseURL}/administration-api/dtr-setup/assignments/${level}`,
        { ...pathParams(path), employeeCode, ...roles }
      )
      return 'created'
    } catch (error) {
      await notifyError(this, dispatch, error)
      return error &&
        error.response &&
        error.response.data &&
        error.response.data.message === 'assignmentExists'
        ? 'exists'
        : 'failed'
    }
  },
}

export const getters = {}
