<template>
  <div>
    <v-overlay :value="overlay">
      <v-progress-circular indeterminate size="60"></v-progress-circular>
    </v-overlay>

    <v-toolbar
      color="mainBG"
      height="50px"
      :width="$vuetify.breakpoint.lgAndUp ? barWidth : '100%'"
      style="position: fixed; z-index: 2"
      flat
    >
      <div class="d-flex align-center" style="width: 100%"></div>
    </v-toolbar>

    <div style="height: 50px"></div>

    <v-container>
      <v-row v-if="employeesWaitingApproval.length > 0">
        <v-col>
          <h3 class="text-h6 text-md-h5 py-2 py-md-5 px-2 px-md-14">
            The following employees' DTR needs your approval.
          </h3>
        </v-col>
      </v-row>
      <v-row v-else>
        <v-col>
          <h3 class="text-h6 text-md-h5 py-2 py-md-5 px-2 px-md-14">
            No approvals are currently required.
          </h3>
        </v-col>
      </v-row>

      <v-row justify="center" class="pb-3 pb-md-10 px-3 px-md-16">
        <v-expansion-panels inset>
          <v-expansion-panel
            v-for="(employee, index) in employeesWaitingApproval"
            :key="index"
            class="secondaryBG"
          >
            <!-- header -->
            <v-expansion-panel-header
              disable-icon-rotate
              :class="$vuetify.theme.dark ? 'mainBG' : ''"
              @click="getDtrValues(employee)"
            >
              <div class="d-flex align-center">
                <!-- employee picture -->
                <div>
                  <v-avatar
                    v-if="employee.employeePicture"
                    style="border: 0.5px #000046 solid"
                    size="33"
                    max-width="33px"
                  >
                    <v-img
                      :src="`https://hr.alkholi.com/MenaITech/application/hrms/MenaImages/Employees_Pictures/${employee.employeePicture}`"
                      alt="Profile Image"
                    ></v-img>
                  </v-avatar>
                  <v-avatar
                    v-else
                    max-width="33px"
                    style="border: 0.5px #000046 solid"
                    size="33"
                  >
                    <v-img
                      :src="`/generalPictures/profile.png`"
                      alt="Profile Image"
                    ></v-img>
                  </v-avatar>
                </div>
                <v-divider vertical class="mx-3"></v-divider>
                <!-- employee code -->
                <p class="mb-0 px-3">
                  {{ employee.EmployeeCode }}
                </p>
                <v-divider vertical></v-divider>
                <!-- employee name -->
                <p class="mb-0 px-3">
                  {{ employee.employeeName }}
                </p>
                <v-divider vertical></v-divider>
              </div>
              <template #actions>
                <span class="px-5">{{ employee.statusName }}</span>
                <v-icon :color="employee.statusColor" size="20"
                  >mdi-circle</v-icon
                >
              </template>
            </v-expansion-panel-header>

            <!-- content -->
            <v-expansion-panel-content>
              <v-divider class="my-1"></v-divider>
              <div class="py-1 d-flex">
                <div>
                  <v-btn
                    color="green"
                    outlined
                    text
                    elevation="0"
                    @click="singleApproval"
                  >
                    <v-icon>mdi-success</v-icon>
                    <span class="text-capitalize">Approve</span>
                  </v-btn>
                </div>

                <div class="mx-3">
                  <v-btn
                    color="red"
                    outlined
                    text
                    elevation="0"
                    @click="singleDecline"
                  >
                    <v-icon>mdi-success</v-icon>
                    <span class="text-capitalize">Decline</span>
                  </v-btn>
                </div>
              </div>
              <v-divider class="mt-1 mb-3"></v-divider>
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
                  <tr v-for="(week, I) in weeks" :key="I">
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
                        <p class="mb-0">
                          {{ dtrValues[new Date(day.date).getDate()] }}
                        </p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </v-expansion-panel-content>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-row>
    </v-container>
  </div>
</template>

<script>
import { mapState } from 'vuex'

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
  layout: 'dtr',
  data() {
    return {
      overlay: false,
      weeks: [],
      days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      employeesWaitingApproval: [],
      dtrValues: [],
    }
  },
  computed: {
    ...mapState({
      barWidth: (state) => state.portal.toolbarWidth,
      dtrAppStartDate: (state) => state.dtr.dtrAppStartDate,
      dtrAppEndDate: (state) => state.dtr.dtrAppEndDate,
    }),
  },
  mounted() {
    if (!this.dtrAppStartDate) {
      this.$router.push('/dtr/dtr-table')
    } else {
      const activeStartMonth = Number(this.dtrAppStartDate.split('-')[1])
      const activeStartYear = Number(this.dtrAppEndDate.split('-')[2])
      const activeEndMonth = Number(this.dtrAppEndDate.split('-')[1])
      const activeEndYear = Number(this.dtrAppEndDate.split('-')[2])

      const theStartDate = new Date(activeStartYear, activeStartMonth - 1, 21)
      const theEndDate = new Date(activeEndYear, activeEndMonth - 1, 20)

      this.getEmployeesWaitingForApproval()

      // Calculate the number of days between the start and end dates
      const totalDays =
        Math.ceil((theEndDate - theStartDate) / (1000 * 60 * 60 * 24)) + 1 // add one day to include the end date

      // Calculate the number of days to add to the start date to align it with the first day of a week (Sunday)
      const offset = (theStartDate.getDay() + 7 - 0) % 7

      // Calculate the total number of days to display in the calendar (including empty days)
      const totalDisplayDays = totalDays + offset

      // Calculate the number of weeks to display in the calendar
      const totalWeeks = Math.ceil(totalDisplayDays / 7)

      // Create a two-dimensional array to hold the days in each week
      for (let i = 0; i < totalWeeks; i++) {
        const week = []

        for (let j = 0; j < 7; j++) {
          const dayIndex = i * 7 + j
          const date = new Date(theStartDate)
          date.setDate(date.getDate() + dayIndex - offset)

          const dayNumber = date.getDate()

          const dayName = new Date(date).toLocaleString('en-US', {
            weekday: 'short',
          })

          // If the date is before the start date or after the end date, mark it as empty
          const empty =
            date < theStartDate ||
            date > theEndDate ||
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
    }
  },

  methods: {
    flipDateString(dateString) {
      const dateParts = dateString.split('-')
      const year = dateParts[2]
      const month = dateParts[1]
      const day = dateParts[0]
      return year + '-' + month + '-' + day
    },

    async getEmployeesWaitingForApproval() {
      try {
        const managerCode = localStorage.getItem('employeeCode')
        const startDate = this.flipDateString(this.dtrAppStartDate)
        const endDate = this.flipDateString(this.dtrAppEndDate)

        // make the SQL request to get the employees waiting for approval
        const employeesWaitingApproval = await this.$axios.post(
          `${this.$config.baseURL}/dtr-api/sql-params-call`,
          {
            query: `
                SELECT * FROM [dtr].[dtrEntries] 
                WHERE [ManagerCode] = @managerCode
                AND [ApprovalStatus] = @approvalStatus
                AND [StartDate] = @startDate
                AND [EndDate] = @endDate
              `,
            parameters: {
              approvalStatus: 1,
              managerCode,
              startDate,
              endDate,
            },
          }
        )
        if (employeesWaitingApproval.status === 200) {
          // calculate employees status
          const modifiedArray = []
          employeesWaitingApproval.data.forEach((element) => {
            if (element.ApprovalStatus === 1) {
              element.statusColor = 'orange'
              element.statusName = 'Waiting for your approval'
              modifiedArray.push(element)
            }
          })
          this.employeesWaitingApproval = modifiedArray
        }
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

    getDtrValues(databaseReplyObject) {
      const dtrValues = {}
      Object.keys(databaseReplyObject).forEach((key) => {
        if (!isNaN(parseInt(key))) {
          dtrValues[key] = databaseReplyObject[key]
        }
      })

      const mapping = {
        RA: 'Regular Attendance',
        AB: 'Absent',
        AV: 'Annual Vacation',
        SV: 'Sick Vacation',
        'UP<20': 'UnPaid Vacation less than 20 days',
        'UP>20': 'UnPaid Vacation more than 20 days',
        D: 'Death',
        NB: 'New Born',
        HA: 'HAJJ Vacation',
        MV: 'Maternity Vacation',
        HDM: 'Huzband Death - Muslim',
        HDN: 'Huzband Death - Non Muslim',
        MRG: 'Marriage Vacation',
        DOC: 'Dayoff Compensation',
        ST: 'Study Vacation',
      }

      for (const key in dtrValues) {
        if (
          Object.prototype.hasOwnProperty.call(dtrValues, key) &&
          dtrValues[key] !== null
        ) {
          dtrValues[key] = mapping[dtrValues[key]]
        }
      }

      this.dtrValues = dtrValues
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
