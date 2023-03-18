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
      <div class="d-flex align-center px-5" style="width: 100%">
        <v-spacer></v-spacer>
        <div v-if="!calenderIsExpanded" class="d-flex align-center">
          <p class="mb-0 pr-3 grey--text text--darken-2">
            {{ `From: ${startDate} - To: ${endDate}` }}
          </p>
          <v-btn
            fab
            text
            x-small
            outlined
            color="grey darken-2"
            class="mx-1"
            @click="prev"
          >
            <v-icon small> mdi-chevron-left </v-icon>
          </v-btn>
          <v-btn
            fab
            text
            x-small
            outlined
            color="grey darken-2"
            class="mx-1"
            @click="next"
          >
            <v-icon small> mdi-chevron-right </v-icon>
          </v-btn>
        </div>
        <div v-else>
          <div class="d-flex align-center">
            <v-btn
              text
              small
              outlined
              color="grey darken-2"
              class="mx-1"
              @click="refreshPage"
            >
              <v-icon small> mdi-calendar-multiselect-outline </v-icon>
              <span class="text-capitalize">Change time period</span>
            </v-btn>
          </div>
        </div>
      </div>
    </v-toolbar>
    <div style="height: 50px"></div>
    <v-container>
      <v-row justify="center" class="py-3 py-md-10 px-3 px-md-12">
        <v-expansion-panels inset>
          <v-expansion-panel
            v-for="(employee, index) in allEmployeesData"
            :key="index"
          >
            <!-- header -->
            <v-expansion-panel-header disable-icon-rotate>
              <div class="d-flex align-center">
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
                <p class="mb-0 px-3">
                  {{ employee.employee_name_eng }}
                </p>
              </div>
              <template #actions>
                <v-icon color="teal">mdi-check</v-icon>
              </template>
            </v-expansion-panel-header>
            <!-- content -->
            <v-expansion-panel-content>
              <theCalender
                :start="startDate"
                :end="endDate"
                :code="employee.employee_code"
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
    }
  },

  computed: {
    ...mapState({
      barWidth: (state) => state.portal.toolbarWidth,
    }),
  },

  mounted() {
    this.getAssignedEmployees()
    this.getDateRange()
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

        this.allEmployeesData = allEmployees
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

    getDateRange() {
      // const testDate = '2023-01-05T07:24:54.056Z'
      const currentDay = Number(new Date().toISOString().substring(8, 10))
      const currentMonth = Number(new Date().toISOString().substring(5, 7))
      const currentYear = Number(new Date().toISOString().substring(0, 4))

      if (currentMonth === 1) {
        if (currentDay >= 1 && currentDay <= 20) {
          this.startDate = `${currentYear - 1}-12-21`
          this.endDate = `${currentYear}-01-20`
        } else {
          this.startDate = `${currentYear}-01-21`
          this.endDate = `${currentYear}-02-20`
        }
      } else if (currentMonth >= 2 && currentMonth <= 8) {
        if (currentDay >= 1 && currentDay <= 20) {
          this.startDate = `${currentYear}-0${currentMonth - 1}-21`
          this.endDate = `${currentYear}-0${currentMonth}-20`
        } else {
          this.startDate = `${currentYear}-0${currentMonth}-21`
          this.endDate = `${currentYear}-0${currentMonth + 1}-20`
        }
      } else if (currentMonth === 9) {
        if (currentDay >= 1 && currentDay <= 20) {
          this.startDate = `${currentYear}-0${currentMonth - 1}-21`
          this.endDate = `${currentYear}-${currentMonth}-20`
        } else {
          this.startDate = `${currentYear}-${currentMonth}-21`
          this.endDate = `${currentYear}-${currentMonth + 1}-20`
        }
      } else if (currentMonth === 10) {
        if (currentDay >= 1 && currentDay <= 20) {
          this.startDate = `${currentYear}-0${currentMonth - 1}-21`
          this.endDate = `${currentYear}-${currentMonth}-20`
        } else {
          this.startDate = `${currentYear}-${currentMonth}-21`
          this.endDate = `${currentYear}-${currentMonth + 1}-20`
        }
      } else if (currentMonth === 11) {
        if (currentDay >= 1 && currentDay <= 20) {
          this.startDate = `${currentYear}-${currentMonth - 1}-21`
          this.endDate = `${currentYear}-${currentMonth}-20`
        } else {
          this.startDate = `${currentYear}-${currentMonth}-21`
          this.endDate = `${currentYear}-${currentMonth + 1}-20`
        }
      } else if (currentMonth === 12) {
        if (currentDay >= 1 && currentDay <= 20) {
          this.startDate = `${currentYear}-${currentMonth - 1}-21`
          this.endDate = `${currentYear}-${currentMonth}-20`
        } else {
          this.startDate = `${currentYear}-${currentMonth}-21`
          this.endDate = `${currentYear + 1}-01-20`
        }
      }
    },

    updateCalenderOpenStatus() {
      this.calenderIsExpanded = true
    },

    prev() {
      // need to add [0] here as the calender is inside a loop
      // this.$refs.calendar[0].prev()
      const startingDateMonth = this.startDate.substring(5, 7)
      const currentYear = this.startDate.substring(0, 4)
      switch (startingDateMonth) {
        case '01':
          this.startDate = `${Number(currentYear - 1)}-12-21`
          this.endDate = `${currentYear}-01-20`
          break
        case '02':
          this.startDate = `${currentYear}-01-21`
          this.endDate = `${currentYear}-02-20`
          break
        case '03':
          this.startDate = `${currentYear}-02-21`
          this.endDate = `${currentYear}-03-20`
          break
        case '04':
          this.startDate = `${currentYear}-03-21`
          this.endDate = `${currentYear}-04-20`
          break
        case '05':
          this.startDate = `${currentYear}-04-21`
          this.endDate = `${currentYear}-05-20`
          break
        case '06':
          this.startDate = `${currentYear}-05-21`
          this.endDate = `${currentYear}-06-20`
          break
        case '07':
          this.startDate = `${currentYear}-06-21`
          this.endDate = `${currentYear}-07-20`
          break
        case '08':
          this.startDate = `${currentYear}-07-21`
          this.endDate = `${currentYear}-08-20`
          break
        case '09':
          this.startDate = `${currentYear}-08-21`
          this.endDate = `${currentYear}-09-20`
          break
        case '10':
          this.startDate = `${currentYear}-09-21`
          this.endDate = `${currentYear}-10-20`
          break
        case '11':
          this.startDate = `${currentYear}-10-21`
          this.endDate = `${currentYear}-11-20`
          break
        case '12':
          this.startDate = `${currentYear}-11-21`
          this.endDate = `${currentYear}-12-20`
          break
        default:
          break
      }
    },

    next() {
      // need to add [0] here as the calender is inside a loop
      // this.$refs.calendar[0].next()
      const startingDateMonth = this.startDate.substring(5, 7)
      const currentYear = this.startDate.substring(0, 4)
      switch (startingDateMonth) {
        case '01':
          this.startDate = `${currentYear}-02-21`
          this.endDate = `${currentYear}-03-20`
          break
        case '02':
          this.startDate = `${currentYear}-03-21`
          this.endDate = `${currentYear}-04-20`
          break
        case '03':
          this.startDate = `${currentYear}-04-21`
          this.endDate = `${currentYear}-05-20`
          break
        case '04':
          this.startDate = `${currentYear}-05-21`
          this.endDate = `${currentYear}-06-20`
          break
        case '05':
          this.startDate = `${currentYear}-06-21`
          this.endDate = `${currentYear}-07-20`
          break
        case '06':
          this.startDate = `${currentYear}-07-21`
          this.endDate = `${currentYear}-08-20`
          break
        case '07':
          this.startDate = `${currentYear}-08-21`
          this.endDate = `${currentYear}-09-20`
          break
        case '08':
          this.startDate = `${currentYear}-09-21`
          this.endDate = `${currentYear}-10-20`
          break
        case '09':
          this.startDate = `${currentYear}-10-21`
          this.endDate = `${currentYear}-11-20`
          break
        case '10':
          this.startDate = `${currentYear}-11-21`
          this.endDate = `${currentYear}-12-20`
          break
        case '11':
          this.startDate = `${currentYear}-12-21`
          this.endDate = `${Number(currentYear) + 1}-01-20`
          break
        case '12':
          this.startDate = `${Number(currentYear) + 1}-01-21`
          this.endDate = `${Number(currentYear) + 1}-02-20`
          break
        default:
          break
      }
    },

    refreshPage() {
      this.$router.go(0)
    },
  },
}
</script>



