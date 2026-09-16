import { state as portal } from './portal'
import { state as businessCards } from './businessCards'
import { state as dtr } from './dtr'
import { state as coc } from './coc'
import { state as portalAdmins } from './administration/portalAdmins'
import { state as businessCardsAdmins } from './administration/businessCardsAdmins'
import { state as cocAdmins } from './administration/cocAdmins'
import { state as elevatorsAdmins } from './administration/elevatorsAdmins'
import { state as hrSurveys } from './administration/hrSurveys'
import { state as dtrUsers } from './administration/dtrUsers'
import { state as dtrSetup } from './administration/dtrSetup'

export const mutations = {
  RESET_SESSION_DATA(state) {
    for (const [name, initialState] of Object.entries({
      portal,
      businessCards,
      dtr,
      coc,
    })) {
      Object.assign(state[name], initialState())
    }
    for (const [name, initialState] of Object.entries({
      portalAdmins,
      businessCardsAdmins,
      cocAdmins,
      elevatorsAdmins,
      hrSurveys,
      dtrUsers,
      dtrSetup,
    })) {
      Object.assign(state.administration[name], initialState())
    }
  },
}
