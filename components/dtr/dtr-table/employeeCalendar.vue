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
            {{ $t('dtrApp.approvalPage.approveAllMessage') }}
          </p>
        </v-card-text>

        <v-card-actions class="pb-10">
          <v-spacer></v-spacer>

          <v-btn
            outlined
            class="px-8 mx-2 text-capitalize"
            color="success darken-1 "
            text
            @click="sendSingleForApproval"
          >
            {{ $t('generals.yes') }}
          </v-btn>
          <v-btn
            outlined
            class="px-8 text-capitalize"
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
            v-if="declineFlag"
            text
            outlined
            small
            color="success"
            class="text-capitalize"
            :disabled="disabledStatus"
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
            class="text-capitalize"
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
            class="text-capitalize"
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
            class="mx-3 text-capitalize"
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
            class="text-capitalize"
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
        <span class="text-body-2">Decline Message:</span>
        <span class="error--text text-body-2 px-2">{{ declineMessage }}</span>
      </div>
      <v-divider></v-divider>
    </div>
  </div>
</template>

<script>
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
    }
  },
  computed: {
    disabledStatus() {
      if (this.statusColor === 'orange' || this.statusColor === 'green') {
        return true
      } else {
        return false
      }
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
        // prepare the start date
        const sDate = new Date(this.startDate)
        const sYear = sDate.getFullYear()
        const sMonth = ('0' + (sDate.getMonth() + 1)).slice(-2)
        const sDay = ('0' + sDate.getDate()).slice(-2)
        const theStartDate = `${sYear}-${sMonth}-${sDay}`

        // prepare the end date
        const eDate = new Date(this.endDate)
        const eYear = eDate.getFullYear()
        const eMonth = ('0' + (eDate.getMonth() + 1)).slice(-2)
        const eDay = ('0' + eDate.getDate()).slice(-2)
        const theEndDate = `${eYear}-${eMonth}-${eDay}`

        // make the sql call
        const savedData = await this.$axios.post(
          `${this.$config.baseURL}/dtr-api/sql-call`,
          {
            query: `SELECT DeclineMessage, [21], [22], [23], [24], [25], [26], [27], [28], [29], [30], [31], [1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11], [12], [13], [14], [15], [16], [17], [18], [19], [20]
            FROM [alkholiPortal].[dtr].[dtrEntries] WHERE EmployeeCode='${this.employeeCode}' AND StartDate='${theStartDate}' AND EndDate='${theEndDate}'`,
          }
        )

        if (savedData.data[0]) {
          if (savedData.data[0].DeclineMessage) {
            this.declineMessage = savedData.data[0].DeclineMessage
          }
        }

        /*
          Use Object.keys(input) to get an array of the keys in the input object.
          Use .filter() to create a new array that only includes keys with non-null values.
          Use .map() to create a new array of objects based on the filtered keys.
          For each key, create a new object with properties date and type, and set their values based
          on the key and the value from the input object, respectively.
          Convert the key to an integer using parseInt() before assigning it to the date property.
        */

        if (savedData.data.length > 0) {
          const input = savedData.data[0]
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
      try {
        if (this.changeOccurs) {
          this.overlay = true
          const employeeCode = this.employeeCode

          const sDate = new Date(this.startDate)
          const sDay = sDate.getDate().toString().padStart(2, '0')
          const sMonth = (sDate.getMonth() + 1).toString().padStart(2, '0')
          const sYear = sDate.getFullYear().toString()
          const startingDate = `${sYear}-${sMonth}-${sDay}`

          const eDate = new Date(this.endDate)
          const eDay = eDate.getDate().toString().padStart(2, '0')
          const eMonth = (eDate.getMonth() + 1).toString().padStart(2, '0')
          const eYear = eDate.getFullYear().toString()
          const endingDate = `${eYear}-${eMonth}-${eDay}`

          const managerCodeReq = await this.$axios.post(
            `${this.$config.baseURL}/dtr-api/hr-sql-call`,
            {
              query: `SELECT * FROM dbo.Pay_employees where employee_code='${employeeCode}'`,
            }
          )

          if (managerCodeReq.status === 200) {
            const managerCode = managerCodeReq.data[0].Manager_Code
            const employeeName = managerCodeReq.data[0].employee_name_eng
            const employeePicture = managerCodeReq.data[0].employee_picture

            const dtrAdmin = localStorage.getItem('userFullName')

            const payload = {
              employeeCode,
              managerCode,
              startingDate,
              endingDate,
              dtrEntries: this.dtrEntriesArray,
              dtrAdmin,
              employeeName,
              employeePicture,
            }

            const saveToDB = await this.$axios.post(
              `${this.$config.baseURL}/dtr-api/save-dtr-data`,
              payload
            )

            if (saveToDB.data[0] === 1) {
              this.$emit('employeeDataSaved', this.employeeCode)

              this.overlay = false
              const notification = {
                type: 'success',
                message: this.$t(`successMessages.successSave`),
              }
              await this.$store.dispatch(
                'appNotifications/addNotification',
                notification
              )
            }
          }
        } else {
          const notification = {
            type: 'error',
            message: this.$t(`errorMessages.noChange`),
          }
          await this.$store.dispatch(
            'appNotifications/addNotification',
            notification
          )
        }
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

    async sendSingleForApproval() {
      try {
        this.singleApprovalDialog = false
        this.overlay = true

        // Prepare variables for the query
        const startingDate = this.formatDate(new Date(this.startDate))
        const endingDate = this.formatDate(new Date(this.endDate))

        const response = await this.$axios.post(
          `${this.$config.baseURL}/dtr-api/sql-params-call`,
          {
            query: `
                UPDATE [dtr].[dtrEntries]
                SET [ApprovalStatus] = @approvalStatus
                WHERE [EmployeeCode] = @employeeCode
                AND [StartDate] = @startDate
                AND [EndDate] = @endDate
              `,
            parameters: {
              approvalStatus: 1,
              employeeCode: this.employeeCode,
              startDate: startingDate,
              endDate: endingDate,
            },
          }
        )

        if (response.status === 200) {
          // close the panel
          this.$emit('closePanel')

          this.overlay = false

          // Send a successful feedback to the user
          await this.notifyUser('success', 'dtrApp.dtrPage.sentForApproval')
        }
      } catch (e) {
        this.overlay = false
        await this.notifyUser('error', e.toString().replaceAll('Error: ', ''))
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
