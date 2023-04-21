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
}

export const getters = {}
