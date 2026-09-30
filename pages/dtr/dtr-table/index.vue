<template>
  <div>
    <v-overlay :value="overlay">
      <v-progress-circular indeterminate size="60"></v-progress-circular>
    </v-overlay>

    <v-dialog
      v-model="dialog"
      overlay-opacity="0.8"
      persistent
      max-width="750px"
    >
      <v-card>
        <v-card-title>
          <div class="d-flex justify-center pt-5" style="width: 100%">
            <span class="text-h5">{{ $t('chooseTimePeriod') }}</span>
          </div>
        </v-card-title>
        <v-card-text>
          <div class="d-flex align-center justify-center px-3">
            <div
              style="height: 180px"
              :class="
                $i18n.locale == 'en'
                  ? 'd-flex align-center'
                  : 'd-flex align-center flex-row-reverse'
              "
            >
              <v-btn
                fab
                small
                outlined
                class="mx-1 cursor-pointer"
                @click="prev"
              >
                <v-icon size="30"> mdi-chevron-left </v-icon>
              </v-btn>
              <p class="mb-0 px-3 text-h6 text-md-h5">
                {{ `From: ${startDate} - To: ${endDate}` }}
              </p>
              <v-btn
                fab
                small
                outlined
                class="mx-1 cursor-pointer"
                @click="next"
              >
                <v-icon size="30"> mdi-chevron-right </v-icon>
              </v-btn>
            </div>
          </div>
        </v-card-text>
        <v-card-actions class="pb-10">
          <v-spacer></v-spacer>
          <v-btn
            outlined
            text
            color="warning"
            class="px-8 mx-2 text-capitalize cursor-pointer"
            @click="goBack"
          >
            {{ $t('generals.back') }}
          </v-btn>
          <v-btn
            outlined
            color="success"
            class="px-8 mx-2 text-capitalize cursor-pointer"
            text
            @click="saveStartAndEndDatesInStore"
          >
            {{ $t('generals.save') }}
          </v-btn>
          <v-spacer></v-spacer>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-toolbar
      color="mainBG"
      height="50px"
      class="pa-0"
      :width="$vuetify.breakpoint.lgAndUp ? barWidth : '100%'"
      style="position: fixed; z-index: 2"
      flat
    >
      <!-- approve all confirmation dialog -->
      <v-dialog v-model="approvalDialog" width="500" persistent>
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
              class="px-8 mx-2 text-capitalize cursor-pointer"
              color="success darken-1 "
              text
              @click="sendForApproval"
            >
              {{ $t('generals.yes') }}
            </v-btn>
            <v-btn
              outlined
              class="px-8 text-capitalize cursor-pointer"
              color="error darken-1 "
              text
              @click="approvalDialog = false"
            >
              {{ $t('generals.no') }}
            </v-btn>
            <v-spacer></v-spacer>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <div class="d-flex align-center px-3 px-xl-16" style="width: 100%">
        <v-btn
          outlined
          text
          class="cursor-pointer"
          :disabled="disableSendForApprovalBTN"
          @click="approvalDialog = true"
        >
          <v-icon color="green" small class="mx-2"
            >mdi-checkbox-marked-circle-plus-outline</v-icon
          >
          <span class="text-capitalize">
            {{ $t('dtrApp.dtrPage.sendForApproval') }}
          </span>
        </v-btn>
        <v-spacer></v-spacer>
        <div v-if="dtrAppStartDate" class="d-flex align-center px-3">
          <p class="mb-0 px-3 text-body-2">
            {{ `From: ${dtrAppStartDate} - To: ${dtrAppEndDate}` }}
          </p>
        </div>

        <div>
          <div class="d-flex align-center">
            <v-btn small outlined class="cursor-pointer" @click="refreshPage">
              <v-icon small> mdi-calendar-multiselect-outline </v-icon>
              <span class="text-capitalize px-2">{{
                $t('dtrApp.dtrPage.periodChange')
              }}</span>
            </v-btn>
          </div>
        </div>
      </div>
    </v-toolbar>

    <div style="height: 50px"></div>

    <v-container class="py-8 py-md-10 py-xl-12 px-3 px-xl-16">
      <v-row class="px-1 px-xl-4">
        <v-expansion-panels v-model="panel" inset>
          <v-expansion-panel
            v-for="(employee, index) in allEmployeesData"
            :key="index"
            class="secondaryBG"
          >
            <!-- header -->
            <v-expansion-panel-header
              disable-icon-rotate
              :class="$vuetify.theme.dark ? 'mainBG' : ''"
            >
              <div class="d-flex align-center">
                <!-- employee picture -->
                <div>
                  <v-avatar
                    v-if="employee.employee_picture"
                    style="border: 0.5px #000046 solid"
                    size="33"
                    max-width="33px"
                  >
                    <v-img
                      :src="`https://hr.alkholi.com/MenaITech/application/hrms/MenaImages/Employees_Pictures/${employee.employee_picture}`"
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
                  {{ employee.employee_code }}
                </p>
                <v-divider vertical></v-divider>
                <!-- employee name -->
                <p class="mb-0 px-3">
                  {{ employee.employee_name_eng }}
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
              <employeeCalendar
                :start-date="
                  new Date(activeStartYear, activeStartMonth - 1, 21)
                "
                :end-date="new Date(activeEndYear, activeEndMonth - 1, 20)"
                :employee-code="employee.employee_code"
                :status-color="employee.statusColor"
                :decline-flag="employee.declineFlag"
                @employeeDataSaved="getSingleRecordStatus"
                @employeeDataReset="employeeDataReset(employee)"
                @closePanel="closePanel(employee)"
              />
            </v-expansion-panel-content>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-row>
    </v-container>
  </div>
</template>

<script>
/*
No Record => pink => No Changes Yet
0 => yellow => Ready to be sent
1 => orange => Waiting for approval
2 => red => Declined - Needs review!
3 => green => Approved
4 => gray => Migrated
*/
import { mapState } from 'vuex'
import { periodContaining, periodParts, shiftPeriod } from '~/utils/dtr-period'

export default {
  layout: 'dtr',
  data() {
    return {
      allEmployeesData: [],
      overlay: false,
      dialog: false,
      approvalDialog: false,
      panel: null,
      disableSendForApprovalBTN: false,
      startDate: '',
      endDate: '',
      activeStartMonth: 0,
      activeStartYear: 0,
      activeEndMonth: 0,
      activeEndYear: 0,
    }
  },

  computed: {
    ...mapState({
      barWidth: (state) => state.portal.toolbarWidth,
      dtrAppStartDate: (state) => state.dtr.dtrAppStartDate,
      dtrAppEndDate: (state) => state.dtr.dtrAppEndDate,
    }),
  },

  async mounted() {
    if (this.dtrAppStartDate === undefined) {
      // if there was no data saved in the store
      this.getDateRange()
      this.dialog = true
    } else {
      // if the data range was already defined and saved --> set the date values based on the saved data
      this.startDate = this.dtrAppStartDate
      this.endDate = this.dtrAppEndDate
      this.setActivePeriod()
      await this.getAssignedEmployees()
    }
  },

  methods: {
    async saveStartAndEndDatesInStore() {
      const payload = {
        start: this.startDate,
        end: this.endDate,
      }
      this.dialog = false
      await this.$store.dispatch('dtr/saveStartAndEndDates', payload)
      await this.getAssignedEmployees()
    },

    async getAssignedEmployees() {
      try {
        this.overlay = true
        // the server resolves the employees assigned to the signed-in user
        const allEmployees = await this.$store.dispatch(
          'dtr/getAssignedEmployees'
        )
        await this.getRecordsStatus(allEmployees)
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

    flipDateString(dateString) {
      const dateParts = dateString.split('-')
      const year = dateParts[2]
      const month = dateParts[1]
      const day = dateParts[0]
      return year + '-' + month + '-' + day
    },

    areAllApprovalStatusEqualTo(arr) {
      // Use the every() method to iterate over the array
      // The every() method tests whether all elements in the array pass
      // the test implemented by the provided function
      return arr.every(function (item) {
        // Check if the current item's statusColor property is equal to "yellow"
        // If it is not equal to "yellow", the every() method will return false immediately
        return item.statusColor === 'yellow'
      })
    },

    async getRecordsStatus(assignedEmployees) {
      try {
        // flip the starting date
        const startingDate = this.flipDateString(this.startDate)
        const endingDate = this.flipDateString(this.endDate)

        // the server returns the entries of the assigned employees only;
        // nothing is requested when no employee is assigned
        const entries =
          assignedEmployees.length > 0
            ? await this.$store.dispatch('dtr/getPeriodEntries', {
                start: startingDate,
                end: endingDate,
              })
            : []

        // null: the entries could not be loaded and the user was notified
        if (entries) {
          const modifiedArray = assignedEmployees.map((element) => {
            const employeeData = entries.find(
              (record) => record.EmployeeCode === element.employee_code
            )

            if (employeeData) {
              if (employeeData.DeclineFlag) {
                element.declineFlag = true
              } else {
                element.declineFlag = false
              }
            }

            if (employeeData) {
              if (employeeData.ApprovalStatus === 0) {
                element.statusColor = 'yellow'
                element.statusName = 'Ready to be sent for approval'
              } else if (employeeData.ApprovalStatus === 1) {
                element.statusColor = 'orange'
                element.statusName = 'Waiting for manager approval'
              } else if (employeeData.ApprovalStatus === 2) {
                element.statusColor = 'red'
                element.statusName = 'Declined - Needs Review'
              } else if (employeeData.ApprovalStatus === 3) {
                element.statusColor = 'green'
                element.statusName = 'Approved'
              }
            } else {
              element.statusColor = 'pink'
              element.statusName = 'No changes yet!'
            }

            return element
          })

          this.allEmployeesData = modifiedArray

          // check if we need to disable the button of "send for approval" or not
          const allApprovalStatusEqual = this.areAllApprovalStatusEqualTo(
            this.allEmployeesData
          )

          if (allApprovalStatusEqual && this.allEmployeesData.length > 0) {
            this.disableSendForApprovalBTN = false
          } else {
            this.disableSendForApprovalBTN = true
          }
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

    async getSingleRecordStatus(payload) {
      try {
        // flip the starting date
        const startingDate = this.flipDateString(this.startDate)
        const endingDate = this.flipDateString(this.endDate)

        const employeeCode = payload

        const entries = await this.$store.dispatch('dtr/getPeriodEntries', {
          start: startingDate,
          end: endingDate,
          employeeCode,
        })

        // null: the entry could not be loaded and the user was notified
        if (entries) {
          const modifiedArray = this.allEmployeesData.map((element) => {
            const employeeData = entries.find(
              (record) => record.EmployeeCode === element.employee_code
            )

            if (employeeData) {
              if (employeeData.ApprovalStatus === 0) {
                element.statusColor = 'yellow'
                element.statusName = 'Ready to be sent for approval'
              } else if (employeeData.ApprovalStatus === 1) {
                element.statusColor = 'orange'
                element.statusName = 'Waiting for manager approval'
              } else if (employeeData.ApprovalStatus === 2) {
                element.statusColor = 'red'
                element.statusName = 'Declined - Needs Review'
              }
            }
            return element
          })

          // close the panel
          this.panel = -1

          this.allEmployeesData = modifiedArray
          // check if we need to disable the button of "send for approval" or not
          const allApprovalStatusEqual = this.areAllApprovalStatusEqualTo(
            this.allEmployeesData
          )

          if (allApprovalStatusEqual) {
            this.disableSendForApprovalBTN = false
          } else {
            this.disableSendForApprovalBTN = true
          }
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

    getDateRange() {
      /**
       * Sets the start and end date of the period that contains the current date
       * in the format of DD-MM-YYYY (from the 21st to the 20th of the next month)
       */

      // Get the current day, month, and year as numbers
      const today = new Date().toISOString()
      const currentDay = Number(today.substring(8, 10))
      const currentMonth = Number(today.substring(5, 7))
      const currentYear = Number(today.substring(0, 4))

      this.setPeriod(periodContaining(currentYear, currentMonth, currentDay))
    },

    setPeriod(period) {
      this.startDate = period.start
      this.endDate = period.end
      this.setActivePeriod()
    },

    setActivePeriod() {
      // Set the values to send to the child component
      const parts = periodParts(this.startDate, this.endDate)
      this.activeStartMonth = parts.startMonth
      this.activeStartYear = parts.startYear
      this.activeEndMonth = parts.endMonth
      this.activeEndYear = parts.endYear
    },

    prev() {
      this.overlay = true
      this.setPeriod(shiftPeriod(this.startDate, -1))
      this.overlay = false
    },

    next() {
      this.overlay = true
      this.setPeriod(shiftPeriod(this.startDate, 1))
      this.overlay = false
    },

    refreshPage() {
      this.$router.go(0)
    },

    goBack() {
      this.$router.push(this.localePath('/'))
    },

    async closePanel(payload) {
      this.panel = -1
      await this.getSingleRecordStatus(payload.employee_code)
    },

    employeeDataReset(employee) {
      employee.statusColor = 'pink'
      employee.statusName = 'No changes yet!'
      // check if we need to disable the button of "send for approval" or not
      const allApprovalStatusEqual = this.areAllApprovalStatusEqualTo(
        this.allEmployeesData
      )

      if (allApprovalStatusEqual) {
        this.disableSendForApprovalBTN = false
      } else {
        this.disableSendForApprovalBTN = true
      }
    },

    hasRedStatusColor(array) {
      for (let i = 0; i < array.length; i++) {
        if (array[i].statusColor === 'red') {
          return true
        }
      }
      return false
    },

    async sendForApproval() {
      try {
        // Check if all employees are in the ready-for-approval state
        const isReadyForApproval = !this.hasRedStatusColor(
          this.allEmployeesData
        )

        if (isReadyForApproval) {
          this.overlay = true
          // Define reusable helper functions
          const formatDate = (date) => this.flipDateString(date)

          // Prepare variables for the query
          const startingDate = formatDate(this.startDate)
          const endingDate = formatDate(this.endDate)

          const buildEmployeeCodesString = (employees) =>
            `(${employees.map((e) => `'${e.employee_code}'`).join(',')})`

          const employeeCodesString = buildEmployeeCodesString(
            this.allEmployeesData
          )

          // Update the ApprovalStatus to 1 for the given date range and employees
          // Using parameterized queries to prevent SQL injection
          const response = await this.$axios.post(
            `${this.$config.baseURL}/dtr-api/sql-params-call`,
            {
              query: `
                UPDATE [dtr].[dtrEntries]
                SET [ApprovalStatus] = @approvalStatus
                WHERE [EmployeeCode] IN ${employeeCodesString}
                AND [StartDate] = @startDate
                AND [EndDate] = @endDate
              `,
              parameters: {
                approvalStatus: 1,
                startDate: startingDate,
                endDate: endingDate,
              },
            }
          )

          if (response.status === 200) {
            // Update the records status after sending all for approval
            await this.getRecordsStatus(this.allEmployeesData)
            this.overlay = false
            this.approvalDialog = false

            // Send a successful feedback to the user
            await this.notifyUser('success', 'dtrApp.dtrPage.sentForApproval')
          }
        } else {
          this.overlay = false
          this.approvalDialog = false
          await this.notifyUser('error', 'dtrApp.dtrPage.notReadyForApproval')
        }
      } catch (e) {
        this.overlay = false
        this.approvalDialog = false
        await this.notifyUser('error', e.toString().replaceAll('Error: ', ''))
      }
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
