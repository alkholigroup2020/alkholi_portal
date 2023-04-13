<template>
  <div>
    <v-overlay :value="overlay" :absolute="true">
      <v-progress-circular indeterminate size="60"></v-progress-circular>
    </v-overlay>
    <div>
      <v-divider></v-divider>

      <div style="width: 100%" class="py-2 d-flex">
        <v-spacer></v-spacer>
        <div class="d-flex">
          <v-btn color="success" class="mx-3" @click="saveData">{{
            $t('generals.save')
          }}</v-btn>
          <v-btn color="warning" @click="resetData">{{
            $t('generals.reset')
          }}</v-btn>
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
            <!-- :class="{ empty: day.empty }" -->
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
                  @change="prepareDataArray, (changeOccurs = true)"
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
  },
  data() {
    return {
      days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      weeks: [],
      dtrEntriesArray: null,
      overlay: false,
      changeOccurs: false,
    }
  },
  created() {
    // notify the parent component calender is expanded to hide the date range navigator
    this.$emit('calenderIsExpanded')
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

        // If the date is before the start date or after the end date, mark it as empty
        const empty =
          date < this.startDate ||
          date > this.endDate ||
          dayIndex - offset >= totalDays

        // Add the day to the current week
        week.push({
          date,
          dayNumber,
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
    this.prepareDataArray()
    this.getSavedData()
  },
  methods: {
    prepareDataArray() {
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

      this.$emit('dataUpdated', dtrEntriesArray)
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
            query: `SELECT [21], [22], [23], [24], [25], [26], [27], [28], [29], [30], [31], [1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11], [12], [13], [14], [15], [16], [17], [18], [19], [20] 
            FROM [alkholiPortal].[dtr].[dtrEntries] WHERE EmployeeCode='${this.employeeCode}' AND StartDate='${theStartDate}' AND EndDate='${theEndDate}'`,
          }
        )

        /* 
          Use Object.keys(input) to get an array of the keys in the input object.
          Use .filter() to create a new array that only includes keys with non-null values.
          Use .map() to create a new array of objects based on the filtered keys.
          For each key, create a new object with properties date and type, and set their values based
          on the key and the value from the input object, respectively.
          Convert the key to an integer using parseInt() before assigning it to the date property.
        */
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

    async resetData() {},

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
              query: `SELECT [Manager_Code] FROM dbo.Pay_employees where employee_code='${employeeCode}'`,
            }
          )
          const managerCode = managerCodeReq.data[0].Manager_Code

          const dtrAdmin = localStorage.getItem('userFullName')

          const payload = {
            employeeCode,
            managerCode,
            startingDate,
            endingDate,
            dtrEntries: this.dtrEntriesArray,
            dtrAdmin,
          }

          const saveToDB = await this.$axios.post(
            `${this.$config.baseURL}/dtr-api/save-dtr-data`,
            payload
          )

          if (saveToDB.data[0] === 1) {
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
