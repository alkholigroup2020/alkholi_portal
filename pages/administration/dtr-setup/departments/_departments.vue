<template>
  <div>
    <v-overlay :value="overlay">
      <v-progress-circular indeterminate size="60"></v-progress-circular>
    </v-overlay>

    <v-toolbar
      class="d-print-none"
      color="mainBG"
      height="50"
      :class="
        $i18n.locale === 'ar' ? 'flex-row-reverse px-3 px-xl-16' : 'px-xl-3'
      "
      flat
    >
      <div class="d-flex align-center" style="width: 25%; height: 50px">
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
      <v-spacer></v-spacer>
      <div
        v-if="$vuetify.breakpoint.mdAndUp"
        :class="
          $i18n.locale === 'ar'
            ? 'd-flex flex-row-reverse justify-start align-center px-3'
            : 'd-flex justify-end align-center px-16'
        "
        style="width: 75%; height: 50px"
      >
        <h6 class="text-body-1 primaryText--Text">{{ branch }}</h6>
        <div class="px-2">
          <v-icon color="primaryText">mdi-arrow-right-thin</v-icon>
        </div>
        <h6 class="text-body-1 primaryText--Text">
          {{ divisionName }}
        </h6>
      </div>
    </v-toolbar>

    <v-container class="px-3 px-md-8">
      <v-row>
        <v-col class="pt-5 pb-0" cols="12">
          <div>
            <p class="text-h5 mb-1">Departments</p>
            <hr />
            <hr />
          </div>
        </v-col>
      </v-row>

      <v-row v-if="allDepartments.length > 0">
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
            height="100"
            nuxt
            :to="
              localePath(
                `/administration/dtr-setup/projects/${department.system_code}?branch=${branch}&division=${divisionCode}&divisionName=${divisionName}&departmentName=${department.system_desp_e}`
              )
            "
          >
            <v-list-item two-line>
              <v-list-item-content>
                <v-list-item-subtitle>{{
                  department.system_desp_e
                }}</v-list-item-subtitle>

                <v-list-item-subtitle>{{
                  department.system_desp_a
                }}</v-list-item-subtitle>

                <!-- <v-list-item-subtitle
                  >Department:{{ department.system_code }}</v-list-item-subtitle
                >

                <v-list-item-subtitle
                  >Division:{{ department.major_code }}</v-list-item-subtitle
                >

                <v-list-item-subtitle
                  >Employees Count:{{
                    department.employeesCount
                  }}</v-list-item-subtitle
                > -->
              </v-list-item-content>
            </v-list-item>
          </v-card>
        </v-col>
      </v-row>

      <v-row v-else>
        <v-col v-if="overlay === false">
          <h5 class="text-h6 pa-5">
            {{ $t('adminPage.dtrApp.setup.noDepartments') }}
          </h5>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script>
export default {
  layout: 'adminPage',
  asyncData({ params }) {
    const divisionCode = params.departments
    return { divisionCode }
  },
  data() {
    return {
      overlay: false,
      allDepartments: [],
      branch: undefined,
      divisionName: undefined,
    }
  },
  created() {
    if (this.$nuxt.context.query) {
      this.branch = this.$nuxt.context.query.branch
      this.divisionName = this.$nuxt.context.query.divisionName
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
                    WHERE branch_code='${this.branch}' and system_code_type='42' and major_code='${this.divisionCode}'`,
          }
        )
        if (departments.status === 200) {
          this.allDepartments = departments.data
          // await this.filterIncomingData(departments.data)
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
