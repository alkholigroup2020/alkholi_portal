<template>
  <div>
    <v-overlay :value="overlay">
      <v-progress-circular indeterminate size="60"></v-progress-circular>
    </v-overlay>

    <v-toolbar
      color="mainBG"
      height="50px"
      class="px-xl-16"
      :width="$vuetify.breakpoint.lgAndUp ? barWidth : '100%'"
      style="position: fixed; z-index: 2"
      flat
    >
      <div class="d-flex align-center" style="width: 100%">
        <v-btn outlined text>
          <span class="text-capitalize">
            {{ $t('dtrApp.dtrPage.sendForApproval') }}
          </span>
        </v-btn>
        <v-spacer></v-spacer>
        <div class="d-flex align-center px-3">
          <p class="mb-0 px-3">
            {{ `From: ${startDate} - To: ${endDate}` }}
          </p>
          <div :class="$i18n.locale == 'en' ? '' : 'd-flex flex-row-reverse'">
            <v-btn
              v-if="!calenderIsExpanded"
              fab
              x-small
              outlined
              class="mx-1"
              @click="prev"
            >
              <v-icon small> mdi-chevron-left </v-icon>
            </v-btn>
            <v-btn
              v-if="!calenderIsExpanded"
              fab
              x-small
              outlined
              class="mx-1"
              @click="next"
            >
              <v-icon small> mdi-chevron-right </v-icon>
            </v-btn>
          </div>
        </div>
        <div v-if="calenderIsExpanded">
          <div class="d-flex align-center">
            <v-btn small outlined class="mx-1" @click="refreshPage">
              <v-icon small> mdi-calendar-multiselect-outline </v-icon>
              <span class="text-capitalize">{{
                $t('dtrApp.dtrPage.periodChange')
              }}</span>
            </v-btn>
          </div>
        </div>
      </div>
    </v-toolbar>

    <div style="height: 50px"></div>

    <v-container>
      <v-row justify="center" class="py-3 py-md-10 px-3 px-md-16">
        <v-expansion-panels inset>
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
                @calenderIsExpanded="updateCalenderOpenStatus"
              />
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
  layout: 'dtr',
  data() {
    return {
      allEmployeesData: [],
      overlay: false,
      calenderIsExpanded: false,
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
    }),
  },

  mounted() {
    this.getDateRange()
    this.getAssignedEmployees()
  },
  methods: {
    async getAssignedEmployees() {
      try {
        this.overlay = true

        const allEmployees = []

        const employeeCode = localStorage.getItem('employeeCode')

        const employeeSections = await this.$axios.post(
          `${this.$config.baseURL}/business-cards-api/sql-call`,
          {
            query: `
              SELECT * FROM [alkholiPortal].[dtr].[adminAssignment]
              WHERE employeeCode='${employeeCode}'
            `,
          }
        )

        for await (const element of employeeSections.data) {
          const branchName = element.branchName
          // if the admin was assigned on the division level
          if (
            element.departmentCode === 'undefined' &&
            element.projectCode === 'undefined' &&
            element.subProjectCode === 'undefined'
          ) {
            const allEmployeesInDivision = await this.$axios.post(
              `${this.$config.baseURL}/administration-api/hr-sql-call`,
              {
                query: `
                  SELECT A.employee_code, A.branch_code, A.employee_name_eng, A.employee_name_a, A.position, A.nationality, A.employee_picture, A.Manager_Code, A.Email
                  FROM [MenaITech].[dbo].[Pay_employees] as A, [MenaITech].[dbo].[pay_emp_finance] as B
                  WHERE A.employee_code=B.employee_code
                  AND A.branch_code='${branchName}' AND A.department='${element.divisionCode}'
                  AND B.stop_val_flag='0'
                `,
              }
            )
            if (allEmployeesInDivision.status === 200) {
              allEmployeesInDivision.data.forEach((e) => {
                allEmployees.push(e)
              })
            }
          }
          // if the admin was assigned on the department level
          else if (
            element.projectCode === 'undefined' &&
            element.subProjectCode === 'undefined'
          ) {
            const projects = await this.$axios.post(
              `${this.$config.baseURL}/administration-api/hr-sql-call`,
              {
                query: `SELECT system_desp_a, system_desp_e, section_code, major_code, system_code FROM [dbo].[pay_code_tables]
                WHERE branch_code='${branchName}' and system_code_type='71'
                and major_code='${element.divisionCode}' and section_code='${element.departmentCode}'`,
              }
            )
            if (projects.status === 200) {
              for await (const project of projects.data) {
                const queryResult = await this.$axios.post(
                  `${this.$config.baseURL}/administration-api/hr-sql-call`,
                  {
                    query: `SELECT A.employee_code, A.branch_code, A.employee_name_eng, A.employee_name_a, A.position, A.nationality, A.employee_picture, A.Manager_Code, A.Email
                        FROM [MenaITech].[dbo].[Pay_employees] as A, [MenaITech].[dbo].[pay_emp_finance] as B
                        WHERE A.employee_code=B.employee_code
                        AND A.branch_code='${branchName}' AND A.department='${project.major_code}'
                        AND A.Division='${project.system_code}'
                        AND B.stop_val_flag='0'`,
                  }
                )
                if (queryResult.status === 200) {
                  queryResult.data.forEach((e) => {
                    allEmployees.push(e)
                  })
                }
              }
            }
          }
          // if the admin was assigned on the project level
          else if (element.subProjectCode === 'undefined') {
            // get all sub-projects first
            const subProjects = await this.$axios.post(
              `${this.$config.baseURL}/administration-api/hr-sql-call`,
              {
                query: `SELECT system_desp_a, system_desp_e, system_code, major_code, section_code, division_code
                    FROM [dbo].[pay_code_tables] WHERE branch_code='${element.branchName}' and system_code_type='72'
                    and major_code='${element.divisionCode}' and section_code='${element.departmentCode}'
                    and division_code ='${element.projectCode}'`,
              }
            )
            if (subProjects.status === 200) {
              for await (const el of subProjects.data) {
                const queryResult = await this.$axios.post(
                  `${this.$config.baseURL}/administration-api/hr-sql-call`,
                  {
                    query: `
                      SELECT A.employee_code, A.branch_code, A.employee_name_eng, A.employee_name_a, A.position, A.nationality, A.employee_picture, A.Manager_Code, A.Email
                      FROM [MenaITech].[dbo].[Pay_employees] as A, [MenaITech].[dbo].[pay_emp_finance] as B
                      WHERE A.employee_code=B.employee_code
                      AND A.branch_code='${branchName}' AND A.department='${el.major_code}'
                      AND A.Division='${el.division_code}'
                      AND A.section='${el.section_code}' AND A.Unit='${el.system_code}'
                      AND B.stop_val_flag='0'
                    `,
                  }
                )
                if (queryResult.status === 200) {
                  queryResult.data.forEach((e) => {
                    allEmployees.push(e)
                  })
                }
              }
            }
          }
          // if the admin was assigned on the sub-project level
          else {
            const queryResult = await this.$axios.post(
              `${this.$config.baseURL}/administration-api/hr-sql-call`,
              {
                query: `
                SELECT A.employee_code, A.branch_code, A.employee_name_eng, A.employee_name_a, A.position, A.nationality, A.employee_picture, A.Manager_Code, A.Email
                FROM [MenaITech].[dbo].[Pay_employees] as A, [MenaITech].[dbo].[pay_emp_finance] as B
                WHERE A.employee_code=B.employee_code
                AND A.branch_code='${element.branchName}' AND A.department='${element.divisionCode}'
                AND A.Division='${element.projectCode}'
                AND A.section='${element.departmentCode}' AND A.Unit='${element.subProjectCode}'
                AND B.stop_val_flag='0'
                `,
              }
            )
            if (queryResult.status === 200) {
              queryResult.data.forEach((e) => {
                allEmployees.push(e)
              })
            }
          }
        }

        await this.getRecordStatus(allEmployees)
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

    async getRecordStatus(assignedEmployees) {
      try {
        // flip the starting date
        const startingDate = this.flipDateString(this.startDate)
        const endingDate = this.flipDateString(this.endDate)

        const employeeCodes = assignedEmployees.map(
          (employee) => `'${employee.employee_code}'`
        )

        const employeeCodesStr = employeeCodes.join(', ')

        const checkStatus = await this.$axios.post(
          `${this.$config.baseURL}/dtr-api/sql-call`,
          {
            query: `
              SELECT * FROM dtr.dtrEntries
              WHERE EmployeeCode IN (${employeeCodesStr})
              AND StartDate='${startingDate}'
              AND EndDate='${endingDate}'
            `,
          }
        )

        if (checkStatus.status === 200) {
          const modifiedArray = assignedEmployees.map((element) => {
            const employeeData = checkStatus.data.find(
              (record) => record.EmployeeCode === element.employee_code
            )

            if (employeeData) {
              if (employeeData.ApprovalStatus === 0) {
                element.statusColor = 'pink'
                element.statusName = 'Ready for approval'
              } else if (employeeData.ApprovalStatus === 1) {
                element.statusColor = 'yellow'
                element.statusName = 'Waiting for approval'
              }
            } else {
              element.statusColor = 'red'
              element.statusName = 'Not saved yet'
            }
            return element
          })

          this.allEmployeesData = modifiedArray
        }

        // const modifiedArray = []
        // // need to loop through the received object and add
        // // the status color property to each one of them
        // await assignedEmployees.forEach(async (element) => {
        //   const checkStatus = await this.$axios.post(
        //     `${this.$config.baseURL}/dtr-api/sql-call`,
        //     {
        //       query: `
        //         SELECT * FROM dtr.dtrEntries
        //         WHERE EmployeeCode='${element.employee_code}'
        //         AND StartDate='${startingDate}'
        //         AND EndDate='${endingDate}'
        //       `,
        //     }
        //   )

        //   if (checkStatus.status === 200) {
        //     if (checkStatus.data.length === 0) {
        //       element.statusColor = 'red'
        //       element.statusName = 'Not saved yet'
        //     } else if (checkStatus.data.length > 0) {
        //       if (checkStatus.data[0].ApprovalStatus === 0) {
        //         element.statusColor = 'pink'
        //         element.statusName = 'Ready for approval'
        //       } else if (checkStatus.data[0].ApprovalStatus === 1) {
        //         element.statusColor = 'yellow'
        //         element.statusName = 'Waiting for approval'
        //       }
        //     }

        //     modifiedArray.push(element)
        //   }
        // })
        // this.allEmployeesData = modifiedArray
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
       * Returns the start and end date of a season based on the current date
       * An object with `startDate` and `endDate` properties in the format of DD-MM-YYYY
       */

      // Get the current day, month, and year as numbers
      const currentDay = Number(new Date().toISOString().substring(8, 10))
      const currentMonth = Number(new Date().toISOString().substring(5, 7))
      const currentYear = Number(new Date().toISOString().substring(0, 4))

      // Calculate the start and end dates based on the current date and season
      let startDate, endDate
      if (currentMonth === 1) {
        // Winter season
        if (currentDay >= 1 && currentDay <= 20) {
          // Before start date
          startDate = `21-12-${currentYear - 1}`
          endDate = `20-01-${currentYear}`
        } else {
          // After start date
          startDate = `21-01-${currentYear}`
          endDate = `20-02-${currentYear}`
        }
      } else if (currentMonth >= 2 && currentMonth <= 8) {
        // Spring/Summer season
        if (currentDay >= 1 && currentDay <= 20) {
          // Before start date
          startDate = `21-0${currentMonth - 1}-${currentYear}`
          endDate = `20-0${currentMonth}-${currentYear}`
        } else {
          // After start date
          startDate = `21-0${currentMonth}-${currentYear}`
          endDate = `20-0${currentMonth + 1}-${currentYear}`
        }
      } else if (currentMonth === 9) {
        // Fall season
        if (currentDay >= 1 && currentDay <= 20) {
          // Before start date
          startDate = `21-08-${currentYear}`
          endDate = `20-09-${currentYear}`
        } else {
          // After start date
          startDate = `21-09-${currentYear}`
          endDate = `20-10-${currentYear}`
        }
      } else if (currentMonth >= 10 && currentMonth <= 11) {
        // Fall/Winter season
        if (currentDay >= 1 && currentDay <= 20) {
          // Before start date
          startDate = `21-0${currentMonth - 1}-${currentYear}`
          endDate = `20-0${currentMonth}-${currentYear}`
        } else {
          // After start date
          startDate = `21-0${currentMonth}-${currentYear}`
          endDate = `20-0${currentMonth + 1}-${currentYear}`
        }
      } else if (currentMonth === 12) {
        // Winter season
        if (currentDay >= 1 && currentDay <= 20) {
          // Before start date
          startDate = `21-11-${currentYear}`
          endDate = `20-12-${currentYear}`
        } else {
          // After start date
          startDate = `21-12-${currentYear}`
          endDate = `20-01-${currentYear + 1}`
        }
      }

      // Set the start and end dates as an object with DD-MM-YYYY format
      this.startDate = startDate.split('-').join('-')
      this.endDate = endDate.split('-').join('-')
      // Set other values to send it to the childe component
      this.activeStartMonth = Number(startDate.split('-')[1])
      this.activeStartYear = Number(startDate.split('-')[2])
      this.activeEndMonth = Number(endDate.split('-')[1])
      this.activeEndYear = Number(endDate.split('-')[2])
    },

    updateCalenderOpenStatus() {
      this.calenderIsExpanded = true
    },

    prev() {
      const startingDateMonth = this.startDate.split('-')[1]
      const currentYear = this.startDate.split('-')[2]
      switch (startingDateMonth) {
        case '01':
          this.startDate = `21-12-${Number(currentYear - 1)}`
          this.endDate = `20-01-${currentYear}`
          this.activeStartMonth = 12
          this.activeStartYear = Number(currentYear - 1)
          this.activeEndMonth = 1
          this.activeEndYear = Number(currentYear)
          break
        case '02':
          this.startDate = `21-01-${currentYear}`
          this.endDate = `20-02-${currentYear}`
          this.activeStartMonth = 1
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 2
          this.activeEndYear = Number(currentYear)
          break
        case '03':
          this.startDate = `21-02-${currentYear}`
          this.endDate = `20-03-${currentYear}`
          this.activeStartMonth = 2
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 3
          this.activeEndYear = Number(currentYear)
          break
        case '04':
          this.startDate = `21-03-${currentYear}`
          this.endDate = `20-04-${currentYear}`
          this.activeStartMonth = 3
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 4
          this.activeEndYear = Number(currentYear)
          break
        case '05':
          this.startDate = `21-04-${currentYear}`
          this.endDate = `20-05-${currentYear}`
          this.activeStartMonth = 4
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 5
          this.activeEndYear = Number(currentYear)
          break
        case '06':
          this.startDate = `21-05-${currentYear}`
          this.endDate = `20-06-${currentYear}`
          this.activeStartMonth = 5
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 6
          this.activeEndYear = Number(currentYear)
          break
        case '07':
          this.startDate = `21-06-${currentYear}`
          this.endDate = `20-07-${currentYear}`
          this.activeStartMonth = 6
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 7
          this.activeEndYear = Number(currentYear)
          break
        case '08':
          this.startDate = `21-07-${currentYear}`
          this.endDate = `20-08-${currentYear}`
          this.activeStartMonth = 7
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 8
          this.activeEndYear = Number(currentYear)
          break
        case '09':
          this.startDate = `21-08-${currentYear}`
          this.endDate = `20-09-${currentYear}`
          this.activeStartMonth = 8
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 9
          this.activeEndYear = Number(currentYear)
          break
        case '10':
          this.startDate = `21-09-${currentYear}`
          this.endDate = `20-10-${currentYear}`
          this.activeStartMonth = 9
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 10
          this.activeEndYear = Number(currentYear)
          break
        case '11':
          this.startDate = `21-10-${currentYear}`
          this.endDate = `20-11-${currentYear}`
          this.activeStartMonth = 10
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 11
          this.activeEndYear = Number(currentYear)
          break
        case '12':
          this.startDate = `21-11-${currentYear}`
          this.endDate = `20-12-${currentYear}`
          this.activeStartMonth = 11
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 12
          this.activeEndYear = Number(currentYear)
          break
        default:
          break
      }
      this.getRecordStatus(this.allEmployeesData)
    },

    next() {
      const startingDateMonth = this.startDate.split('-')[1]
      const currentYear = this.startDate.split('-')[2]
      switch (startingDateMonth) {
        case '01':
          this.startDate = `21-02-${currentYear}`
          this.endDate = `20-03-${currentYear}`
          this.activeStartMonth = 2
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 3
          this.activeEndYear = Number(currentYear)
          break
        case '02':
          this.startDate = `21-03-${currentYear}`
          this.endDate = `20-04-${currentYear}`
          this.activeStartMonth = 3
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 4
          this.activeEndYear = Number(currentYear)
          break
        case '03':
          this.startDate = `21-04-${currentYear}`
          this.endDate = `20-05-${currentYear}`
          this.activeStartMonth = 4
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 5
          this.activeEndYear = Number(currentYear)
          break
        case '04':
          this.startDate = `21-05-${currentYear}`
          this.endDate = `20-06-${currentYear}`
          this.activeStartMonth = 5
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 6
          this.activeEndYear = Number(currentYear)
          break
        case '05':
          this.startDate = `21-06-${currentYear}`
          this.endDate = `20-07-${currentYear}`
          this.activeStartMonth = 6
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 7
          this.activeEndYear = Number(currentYear)
          break
        case '06':
          this.startDate = `21-07-${currentYear}`
          this.endDate = `20-08-${currentYear}`
          this.activeStartMonth = 7
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 8
          this.activeEndYear = Number(currentYear)
          break
        case '07':
          this.startDate = `21-08-${currentYear}`
          this.endDate = `20-09-${currentYear}`
          this.activeStartMonth = 8
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 9
          this.activeEndYear = Number(currentYear)
          break
        case '08':
          this.startDate = `21-09-${currentYear}`
          this.endDate = `20-10-${currentYear}`
          this.activeStartMonth = 9
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 10
          this.activeEndYear = Number(currentYear)
          break
        case '09':
          this.startDate = `21-10-${currentYear}`
          this.endDate = `20-11-${currentYear}`
          this.activeStartMonth = 10
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 11
          this.activeEndYear = Number(currentYear)
          break
        case '10':
          this.startDate = `21-11-${currentYear}`
          this.endDate = `20-12-${currentYear}`
          this.activeStartMonth = 11
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 12
          this.activeEndYear = Number(currentYear)
          break
        case '11':
          this.startDate = `21-12-${currentYear}`
          this.endDate = `20-01-${Number(currentYear) + 1}`
          this.activeStartMonth = 12
          this.activeStartYear = Number(currentYear)
          this.activeEndMonth = 1
          this.activeEndYear = Number(currentYear) + 1
          break
        case '12':
          this.startDate = `21-01-${Number(currentYear) + 1}`
          this.endDate = `20-02-${Number(currentYear) + 1}`
          this.activeStartMonth = 1
          this.activeStartYear = Number(currentYear) + 1
          this.activeEndMonth = 2
          this.activeEndYear = Number(currentYear) + 1
          break
        default:
          break
      }
      this.getRecordStatus(this.allEmployeesData)
    },

    refreshPage() {
      this.$router.go(0)
    },
  },
}
</script>
