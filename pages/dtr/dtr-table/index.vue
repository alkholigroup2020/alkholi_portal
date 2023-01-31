<template>
  <div>
    <v-overlay :value="overlay">
      <v-progress-circular indeterminate size="60"></v-progress-circular>
    </v-overlay>
    <v-toolbar
      color="mainBG"
      height="50px"
      :width="$vuetify.breakpoint.lgAndUp ? barWidth : '100%'"
      style="position: fixed"
      flat
    ></v-toolbar>
    <div style="height: 50px"></div>
    <pre>{{ allEmployeesData }}</pre>
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
    }
  },
  computed: {
    ...mapState({
      barWidth: (state) => state.portal.toolbarWidth,
    }),
  },
  mounted() {
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
  },
}
</script>

