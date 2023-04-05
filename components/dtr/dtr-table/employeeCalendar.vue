<template>
  <div>
    <v-divider></v-divider>

    <div style="width: 100%" class="py-2 d-flex">
      <v-spacer></v-spacer>
      <div class="d-flex">
        <v-btn color="success" class="mx-2" @click="saveData">Save</v-btn>
        <v-btn color="warning" @click="resetData">Reset</v-btn>
      </div>
      <!-- <div class="d-flex">
        <h3 class="text-body-2 py-1">
          {{
            `From: ${new Date(startDate).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })} - To: ${new Date(endDate).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}`
          }}
        </h3>
        <v-spacer></v-spacer>
      </div> -->
    </div>

    <v-divider class="mb-2"></v-divider>

    <table>
      <thead>
        <tr>
          <th v-for="day in days" :key="day">{{ day }}</th>
        </tr>
      </thead>
      <tbody class="text-body-2">
        <tr v-for="(week, index) in weeks" :key="index">
          <td
            v-for="day in week"
            :key="day.dayIndex"
            :class="{ empty: day.empty }"
          >
            <div v-if="!day.empty">
              <div class="date">{{ day.date | formatDate }}</div>
              <select v-model="day.type" @change="updateData">
                <option value="RA">Regular Attendance</option>
                <option value="AB">Absent</option>
                <option value="AV">Annual Vacation</option>
                <option value="SV">Sick Vacation</option>
                <option value="UP<20">UnPaid Vacation less than 20 days</option>
                <option value="UP>20">UnPaid Vacation more than 20 days</option>
                <option value="D">Death</option>
                <option value="NB">New Born</option>
                <option value="HA">HAJJ Vacation</option>
                <option value="MV">Maternity Vacation</option>
                <option value="HDM">Huzband Death - Muslim</option>
                <option value="HDN">Huzband Death - Non Muslim</option>
                <option value="MRG">Marriage Vacation</option>
                <option value="DOC">Dayoff Compensation</option>
                <option value="ST">Study Vacation</option>
              </select>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
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

        // If the date is before the start date or after the end date, mark it as empty
        const empty =
          date < this.startDate ||
          date > this.endDate ||
          dayIndex - offset >= totalDays

        // Add the day to the current week
        week.push({
          date,
          empty,
          type: 'RA',
          dayIndex,
        })
      }

      // Add the current week to the array of weeks
      this.weeks.push(week)
    }
  },
  mounted() {
    this.updateData()
  },
  methods: {
    updateData() {
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

    async resetData() {},

    async saveData() {
      try {
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

        const saveThePayload = await this.$axios.post(
          `${this.$config.baseURL}/dtr-api/save-dtr-data`,
          payload
        )

        console.log('🚀 saveThePayload:', saveThePayload)
      } catch (e) {
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

th {
  background-color: #f2f2f2;
}

select {
  width: 100%;
  padding: 5px;
  margin-top: 5px;
  border-radius: 5px;
  border: 1px solid #ccc;
  box-sizing: border-box;
}

.empty {
  background-color: #fafafa;
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
