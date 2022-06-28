<template>
  <div>
    <v-overlay :value="overlay">
      <v-progress-circular
        indeterminate
        size="80"
        color=""
      ></v-progress-circular>
    </v-overlay>

    <v-toolbar class="d-print-none" color="mainBG" height="50" flat>
      <div
        class="d-flex align-center"
        style="width: 100%; height: 50px"
        :class="
          $i18n.locale === 'ar' ? 'flex-row-reverse pl-3 pl-xl-16' : ' pl-xl-3'
        "
      >
        <nuxt-link
          class="text-decoration-none"
          style="height: 50px"
          :to="localePath('/administration/dtr-setup')"
        >
          <v-btn
            tile
            depressed
            height="100%"
            color="transparent"
            class="text-subtitle-1 text-capitalize primaryText--text"
          >
            <div
              :class="$i18n.locale === 'ar' ? 'd-flex flex-row-reverse' : ''"
            >
              <v-icon class="mr-2 mt-n1">mdi-home-outline</v-icon>
              <span>{{ $t('generals.home') }}</span>
            </div>
          </v-btn>
        </nuxt-link>

        <nuxt-link
          class="text-decoration-none"
          style="height: 50px"
          :to="localePath(`/administration/dtr-setup/divisions/${branch}`)"
        >
          <v-btn
            tile
            depressed
            height="100%"
            color="transparent"
            class="text-subtitle-1 text-capitalize primaryText--text"
          >
            <div
              :class="$i18n.locale === 'ar' ? 'd-flex flex-row-reverse' : ''"
            >
              <v-icon class="mr-2">mdi-arrow-left-bold-outline</v-icon>
              <span>{{ $t('generals.back') }}</span>
            </div>
          </v-btn>
        </nuxt-link>

        <v-spacer></v-spacer>
      </div>
    </v-toolbar>

    <v-container class="px-3 px-md-8">
      <v-row>
        <v-col
          v-for="(department, index) in allDepartments"
          :key="index"
          cols="6"
          md="3"
          class="py-5"
        >
          <v-card
            elevation="1"
            color="whiteColor"
            outlined
            nuxt
            :to="
              localePath(
                `/administration/dtr-setup/section/${department.system_code}?department=${department.major_code}&branch=${branch}`
              )
            "
          >
            <v-list-item three-line>
              <v-list-item-content>
                <v-list-item-subtitle>{{
                  department.system_desp_a
                }}</v-list-item-subtitle>
                <v-list-item-subtitle>{{
                  department.system_desp_e
                }}</v-list-item-subtitle>
                <v-list-item-subtitle class="red--text"
                  >Section:{{ department.system_code }}</v-list-item-subtitle
                >
                <v-list-item-subtitle class="red--text"
                  >Department:{{ department.major_code }}</v-list-item-subtitle
                >
                <v-list-item-subtitle
                  >Employees Count:{{
                    department.employeesCount
                  }}</v-list-item-subtitle
                >
              </v-list-item-content>
            </v-list-item>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script>
export default {
  layout: 'adminPage',
  asyncData({ params }) {
    const department = params.departments
    return { department }
  },
  data() {
    return {
      overlay: false,
      allDepartments: [],
      branch: undefined,
    }
  },
  created() {
    if (this.$nuxt.context.query.branch) {
      this.branch = this.$nuxt.context.query.branch
    }
    this.getDepartmentsPerDivision()
  },
  methods: {
    async getDepartmentsPerDivision() {
      this.overlay = true
      try {
        const departments = await this.$axios.post(
          `${this.$config.baseURL}/administration-api/hr-sql-call`,
          {
            query: `SELECT system_desp_a, system_desp_e, system_code, major_code FROM [dbo].[pay_code_tables] 
                    WHERE branch_code='${this.branch}' and system_code_type='42' and major_code='${this.department}'`,
          }
        )
        if (departments.status === 200) {
          await this.filterIncomingData(departments.data)
          this.overlay = false
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
    async filterIncomingData(data) {
      try {
        const X = []

        for await (const element of data) {
          let counter = 0

          const employees = await this.$axios.post(
            `${this.$config.baseURL}/administration-api/hr-sql-call`,
            {
              query: `SELECT employee_code FROM [MenaITech].[dbo].[Pay_employees] where branch_code='${this.branch}' 
                        and department='${element.major_code}' and section='${element.system_code}'`,
            }
          )

          if (employees.status === 200) {
            if (employees.data.length > 0) {
              // if employees founded in the department

              for await (const ele of employees.data) {
                // check if the employee still active
                const checkEmployeeStatus = await this.$axios.post(
                  `${this.$config.baseURL}/administration-api/hr-sql-call`,
                  {
                    query: `SELECT stop_val_flag AS theFlag FROM [dbo].[pay_emp_finance]
                            where employee_code='${ele.employee_code}'`,
                  }
                )

                if (checkEmployeeStatus.status === 200) {
                  if (checkEmployeeStatus.data[0].theFlag === 0) {
                    // employee is not terminated
                    counter += 1
                  }
                  element.employeesCount = counter
                }
              }
              X.push(element)
            } else {
              // no employees founded in the department
              element.employeesCount = 0
              X.push(element)
            }
          }
        }

        this.allDepartments = X
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
