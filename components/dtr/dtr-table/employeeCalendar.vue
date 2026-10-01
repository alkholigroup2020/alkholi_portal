<template>
  <div>
    <v-overlay :value="overlay" :absolute="true">
      <v-progress-circular indeterminate size="60"></v-progress-circular>
    </v-overlay>

    <!-- single approval confirmation dialog -->
    <v-dialog v-model="singleApprovalDialog" width="500" persistent>
      <v-card>
        <v-card-title class="text-subtitle-1 primary_5">
          {{ $t('adminPage.bCards.confirmationTitle') }}
        </v-card-title>

        <v-card-text class="pb-0">
          <p
            class="text-subtitle-1 font-weight-medium pt-3 pb-8 mb-0 text-center"
          >
            {{ $t('dtrApp.dtrPage.confirmSubmit') }}
          </p>
        </v-card-text>

        <v-card-actions class="pb-10">
          <v-spacer></v-spacer>

          <v-btn
            outlined
            class="px-8 mx-2 text-capitalize cursor-pointer"
            color="success darken-1 "
            text
            @click="sendSingleForApproval"
          >
            {{ $t('generals.yes') }}
          </v-btn>
          <v-btn
            outlined
            class="px-8 text-capitalize cursor-pointer"
            color="error darken-1 "
            text
            @click="singleApprovalDialog = false"
          >
            {{ $t('generals.no') }}
          </v-btn>
          <v-spacer></v-spacer>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <div>
      <v-divider></v-divider>

      <div style="width: 100%" class="py-2 d-flex">
        <div class="d-flex">
          <v-btn
            v-if="!calendarLoaded && !overlay"
            text
            outlined
            small
            color="warning"
            class="mx-2 text-capitalize cursor-pointer"
            @click="getSavedData"
            >{{ $t('dtrApp.dtrPage.reload') }}</v-btn
          >
          <v-btn
            v-if="entryStatus === 0 || entryStatus === 2"
            text
            outlined
            small
            color="success"
            class="text-capitalize cursor-pointer"
            :disabled="disabledStatus || changeOccurs"
            @click="singleApprovalDialog = true"
            ><v-icon color="green" small class="mx-2"
              >mdi-checkbox-marked-circle-plus-outline</v-icon
            >
            <span class="text-capitalize">
              {{ $t('dtrApp.dtrPage.sendForApproval') }}
            </span></v-btn
          >
          <v-btn
            text
            outlined
            :class="declineFlag ? 'mx-2' : ''"
            small
            color="success"
            class="text-capitalize cursor-pointer"
            :disabled="disabledStatus"
            @click="normalizeDataHO"
            ><v-icon small>mdi-cursor-default-click-outline</v-icon>
            <span class="mx-1">{{
              $t('dtrApp.dtrPage.normalizeHO')
            }}</span></v-btn
          >
          <v-btn
            text
            outlined
            :class="declineFlag ? '' : 'mx-2'"
            small
            color="success"
            class="text-capitalize cursor-pointer"
            :disabled="disabledStatus"
            @click="normalizeDataSites"
            ><v-icon small>mdi-cursor-default-click-outline</v-icon>
            <span class="mx-1">{{
              $t('dtrApp.dtrPage.normalizeSites')
            }}</span></v-btn
          >
        </div>
        <v-spacer></v-spacer>
        <div class="d-flex">
          <v-btn
            text
            outlined
            small
            color="success"
            :disabled="disabledStatus || !changeOccurs"
            class="mx-3 text-capitalize cursor-pointer"
            @click="saveData"
            ><v-icon small>mdi-content-save-all-outline</v-icon>
            <span class="mx-1">{{ $t('generals.save') }}</span></v-btn
          >
          <v-btn
            text
            outlined
            small
            color="warning"
            :disabled="disabledStatus"
            class="text-capitalize cursor-pointer"
            @click="resetData"
          >
            <v-icon small>mdi-restart</v-icon>
            <span class="mx-1">{{ $t('generals.reset') }}</span>
          </v-btn>
        </div>
      </div>

      <v-divider class="mb-2"></v-divider>

      <table>
        <thead
          :style="
            $vuetify.theme.isDark
              ? `background-color: ${$vuetify.theme.defaults.dark.mainBG}`
              : `background-color: ${$vuetify.theme.defaults.light.mainBG}`
          "
        >
          <tr style="border-bottom: #000046 1px solid">
            <th v-for="day in days" :key="day">{{ day }}</th>
          </tr>
        </thead>
        <tbody class="text-body-2">
          <tr v-for="(week, index) in weeks" :key="index">
            <td
              v-for="day in week"
              :key="day.dayIndex"
              :style="
                day.empty
                  ? $vuetify.theme.isDark
                    ? `background-color: ${$vuetify.theme.defaults.dark.mainBG};`
                    : `background-color: ${$vuetify.theme.defaults.light.mainBG};`
                  : ''
              "
            >
              <div v-if="!day.empty">
                <div class="date">{{ day.date | formatDate }}</div>
                <select
                  v-model="day.type"
                  class="primaryText--text"
                  :disabled="disabledStatus"
                  @change="prepareDataArray"
                >
                  <option value="RA" class="black--text">
                    Regular Attendance
                  </option>
                  <option value="AB" class="black--text">Absent</option>
                  <option value="AV" class="black--text">
                    Annual Vacation
                  </option>
                  <option value="SV" class="black--text">Sick Vacation</option>
                  <option value="UP<20" class="black--text">
                    UnPaid Vacation less than 20 days
                  </option>
                  <option value="UP>20" class="black--text">
                    UnPaid Vacation more than 20 days
                  </option>
                  <option value="D" class="black--text">Death</option>
                  <option value="NB" class="black--text">New Born</option>
                  <option value="HA" class="black--text">HAJJ Vacation</option>
                  <option value="MV" class="black--text">
                    Maternity Vacation
                  </option>
                  <option value="HDM" class="black--text">
                    Huzband Death - Muslim
                  </option>
                  <option value="HDN" class="black--text">
                    Huzband Death - Non Muslim
                  </option>
                  <option value="MRG" class="black--text">
                    Marriage Vacation
                  </option>
                  <option value="DOC" class="black--text">
                    Dayoff Compensation
                  </option>
                  <option value="ST" class="black--text">Study Vacation</option>
                </select>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="declineMessage" class="d-flex align-center py-5">
        <span class="text-body-2">{{
          $t('dtrApp.dtrPage.declineMessage')
        }}</span>
        <span class="error--text text-body-2 px-2">{{ declineMessage }}</span>
      </div>
      <v-divider></v-divider>
    </div>
  </div>
</template>

<script>
import { authErrorMessage } from '~/utils/auth-client'

export default {
  filters: {
    // This function takes a value parameter and returns a formatted date string
    formatDate(value) {
      // Get the day of the month from the value parameter and store it in a variable
      const dayOfMonth = value.getDate()

      if (dayOfMonth === 1) {
        // Get the short name of the month from the value parameter and store it in a variable
        const shortMonthName = value.toLocaleDateString(undefined, {
          month: 'short',
        })

        // Get the year from the value parameter and store it in a variable
        const year = value.getFullYear()

        // Return the formatted date string, which includes the day of the month, the short name of the month, and the year
        return `${dayOfMonth} ${shortMonthName} ${year}`
      } else {
        // Return the formatted date string, which includes the day of the month, the short name of the month, and the year
        return `${dayOfMonth}`
      }
    },
  },
  props: {
    employeeCode: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    statusColor: {
      type: String,
      required: true,
    },
    declineFlag: {
      type: Boolean,
      required: false,
    },
  },
  data() {
    return {
      days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      weeks: [],
      declineMessage: null,
      dtrEntriesArray: null,
      overlay: false,
      singleApprovalDialog: false,
      changeOccurs: false,
      entryVersion: null,
      entryStatus: null,
      calendarLoaded: false,
    }
  },
  computed: {
    disabledStatus() {
      return (
        !this.calendarLoaded ||
        this.overlay ||
        [1, 3].includes(this.entryStatus)
      )
    },
  },
  created() {
    // Calculate the number of days between the start and end dates
    const totalDays =
      Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24)) + 1 // add one day to include the end date
    // Calculate the number of days to add to the start date to align it with the first day of a week (Sunday)
    const offset = (this.startDate.getDay() + 7 - 0) % 7

    // Calculate the total number of days to display in the calendar (including empty days)
    const totalDisplayDays = totalDays + offset

    // Calculate the number of weeks to display in the calendar
    const totalWeeks = Math.ceil(totalDisplayDays / 7)

    // Create a two-dimensional array to hold the days in each week
    for (let i = 0; i < totalWeeks; i++) {
      const week = []

      for (let j = 0; j < 7; j++) {
        const dayIndex = i * 7 + j
        const date = new Date(this.startDate)
        date.setDate(date.getDate() + dayIndex - offset)

        const dayNumber = date.getDate()

        const dayName = new Date(date).toLocaleString('en-US', {
          weekday: 'short',
        })

        // If the date is before the start date or after the end date, mark it as empty
        const empty =
          date < this.startDate ||
          date > this.endDate ||
          dayIndex - offset >= totalDays

        // Add the day to the current week
        week.push({
          date,
          dayNumber,
          dayName,
          empty,
          type: `RA`,
          dayIndex,
        })
      }

      // Add the current week to the array of weeks
      this.weeks.push(week)
    }
  },
  mounted() {
    this.prepareDataArray('firstTime')
    this.getSavedData()
  },
  methods: {
    prepareDataArray(arg) {
      if (arg !== 'firstTime') {
        this.changeOccurs = true
      }

      // Flatten the two-dimensional `weeks` array into a one-dimensional array.
      // Filter out any elements where the `empty` property is truthy.
      // Map the remaining elements into new objects with a `date` and `type` property.
      // Create a new object with a `date` property equal to the `date` property of the `day` object.
      // Create a `type` property equal to the `type` property of the `day` object.

      const dtrEntriesArray = this.weeks
        .flat()
        .filter((day) => !day.empty)
        .map((day) => {
          return {
            date: new Date(day.date).getDate(),
            type: day.type,
          }
        })

      this.dtrEntriesArray = dtrEntriesArray
    },

    async getSavedData() {
      try {
        this.overlay = true
        this.calendarLoaded = false
        // the server checks that this employee is assigned to the signed-in
        // user and returns the saved days of the period only
        const savedData = await this.$store.dispatch('dtr/getCalendar', {
          employeeCode: this.employeeCode,
          start: this.formatDate(new Date(this.startDate)),
          end: this.formatDate(new Date(this.endDate)),
        })

        const entry = savedData && savedData.entry
        this.calendarLoaded = !!savedData
        this.entryVersion = entry ? entry.version : null
        this.entryStatus = entry ? entry.ApprovalStatus : null
        this.declineMessage = entry ? entry.DeclineMessage : null

        if (savedData) {
          this.weeks.forEach((week) =>
            week.forEach((day) => {
              day.type = 'RA'
            })
          )
          this.changeOccurs = false
          this.prepareDataArray('firstTime')
        }

        if (entry) {
          /*
          `entry.days` holds the saved type of every day of the period, keyed by the day number.
          Use Object.keys(input) to get an array of the keys in the input object.
          Use .filter() to create a new array that only includes keys with non-null values.
          Use .map() to create a new array of objects based on the filtered keys.
          For each key, create a new object with properties date and type, and set their values based
          on the key and the value from the input object, respectively.
          Convert the key to an integer using parseInt() before assigning it to the date property.
        */

          const input = entry.days || {}
          const output = Object.keys(input)
            .filter((key) => input[key] !== null)
            .map((key) => {
              return {
                date: parseInt(key),
                type: input[key],
              }
            })

          this.dtrEntriesArray = output
          // Iterate over both arrays and comparing the dayNumber from the this.weeks array with the date value from the this.dtrEntriesArray array.
          // When a match is found, update the type value in the this.weeks array with the type value from the this.dtrEntriesArray array.
          function updateType(a, b) {
            a.forEach((group) => {
              group.forEach((aItem) => {
                b.forEach((bItem) => {
                  if (aItem.dayNumber === bItem.date) {
                    aItem.type = bItem.type
                  }
                })
              })
            })
          }

          updateType(this.weeks, this.dtrEntriesArray)
          this.prepareDataArray('firstTime')
        }

        this.overlay = false
      } catch (e) {
        this.overlay = false
        const error = e.toString()
        const newErrorString = error.replaceAll('Error: ', '')
        const notification = {
          type: 'error',
          message: newErrorString,
        }
        await this.$store.dispatch(
          'appNotifications/addNotification',
          notification
        )
      }
    },

    resetData() {
      const arr = this.weeks
      for (let i = 0; i < arr.length; i++) {
        for (let j = 0; j < arr[i].length; j++) {
          const item = arr[i][j]
          item.type = 'RA'
        }
      }

      this.weeks = arr
      this.prepareDataArray()
      this.changeOccurs = false
      this.$emit('employeeDataReset', this.employeeCode)
    },

    normalizeDataHO() {
      this.resetData()
      const arr = this.weeks
      for (let i = 0; i < arr.length; i++) {
        for (let j = 0; j < arr[i].length; j++) {
          const item = arr[i][j]

          if (item.dayName === 'Fri' || item.dayName === 'Sat') {
            item.type = 'AB'
          }
        }
      }

      this.weeks = arr
      this.prepareDataArray()
      this.changeOccurs = true
    },

    normalizeDataSites() {
      this.resetData()
      const arr = this.weeks
      for (let i = 0; i < arr.length; i++) {
        for (let j = 0; j < arr[i].length; j++) {
          const item = arr[i][j]

          if (item.dayName === 'Fri') {
            item.type = 'AB'
          }
        }
      }

      this.weeks = arr
      this.prepareDataArray()
      this.changeOccurs = true
    },

    async saveData() {
      if (!this.calendarLoaded || this.overlay) return
      if (!this.changeOccurs)
        return this.notifyUser('error', 'errorMessages.noChange')
      this.overlay = true
      try {
        this.prepareDataArray('firstTime')
        const response = await this.$axios.post(
          `${this.$config.baseURL}/dtr-api/save-dtr-data`,
          {
            employeeCode: this.employeeCode,
            start: this.formatDate(new Date(this.startDate)),
            end: this.formatDate(new Date(this.endDate)),
            version: this.entryVersion,
            dtrEntries: this.dtrEntriesArray,
          }
        )
        this.entryVersion = response.data.version
        this.entryStatus = 0
        this.changeOccurs = false
        this.$emit('employeeDataSaved', this.employeeCode)
        await this.notifyUser('success', 'successMessages.successSave')
      } catch (error) {
        await this.$store.dispatch('appNotifications/addNotification', {
          type: 'error',
          message: authErrorMessage(this.$store, error, 'dtr'),
        })
        // Preserve unsaved edits; a conflict requires closing/reloading the calendar.
        if (error.response && error.response.status === 409)
          this.calendarLoaded = false
      } finally {
        this.overlay = false
      }
    },

    async sendSingleForApproval() {
      if (!this.calendarLoaded || this.overlay || this.changeOccurs) return
      this.singleApprovalDialog = false
      this.overlay = true
      try {
        await this.$axios.post(`${this.$config.baseURL}/dtr-api/submit`, {
          employeeCode: this.employeeCode,
          start: this.formatDate(new Date(this.startDate)),
          end: this.formatDate(new Date(this.endDate)),
          version: this.entryVersion,
        })
        this.entryStatus = 1
        this.$emit('closePanel')
        await this.notifyUser('success', 'dtrApp.dtrPage.sentForApproval')
      } catch (error) {
        await this.$store.dispatch('appNotifications/addNotification', {
          type: 'error',
          message: authErrorMessage(this.$store, error, 'dtr'),
        })
        if (error.response && error.response.status === 409)
          this.calendarLoaded = false
      } finally {
        this.overlay = false
      }
    },

    formatDate(d) {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')

      return `${year}-${month}-${day}`
    },

    // Notify the user by dispatching a Vuex action
    async notifyUser(type, message) {
      const notification = { type, message: this.$t(message) }
      await this.$store.dispatch(
        'appNotifications/addNotification',
        notification
      )
    },
  },
}
</script>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 1rem;
  box-sizing: border-box;
}

th,
td {
  padding: 10px;
  text-align: center;
  border: 1px solid #ccc;
  box-sizing: border-box;
}

select {
  width: 100%;
  padding: 5px;
  margin-top: 5px;
  border-radius: 5px;
  border: 1px solid #ccc;
  box-sizing: border-box;
}

@media (max-width: 576px) {
  table {
    font-size: 0.8rem;
  }

  th,
  td {
    padding: 6px;
  }
}
</style>
