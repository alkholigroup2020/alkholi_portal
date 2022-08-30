<template>
  <div>
    <v-overlay :value="overlay">
      <v-progress-circular
        indeterminate
        size="80"
        color=""
      ></v-progress-circular>
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
      <div class="d-flex align-center" style="width: 100%; height: 50px">
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
          :to="localePath(`${fromPath}`)"
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

    <div class="pa-5">
      <v-data-table
        :headers="headers"
        :items="employees"
        :items-per-page="10"
        class="elevation-1"
      >
        <template #[`item.employee_picture`]="{ item }">
          <v-avatar
            v-if="item.employee_picture"
            style="border: 0.5px #000046 solid"
            size="40"
          >
            <v-img
              :src="`https://hr.alkholi.com/MenaITech/application/hrms/MenaImages/Employees_Pictures/${item.employee_picture}`"
              alt="Profile Image"
            ></v-img>
          </v-avatar>
          <v-avatar v-else style="border: 0.5px #000046 solid" size="40">
            <v-img
              :src="`/generalPictures/profile.png`"
              alt="Profile Image"
            ></v-img>
          </v-avatar>
        </template>
      </v-data-table>
    </div>
  </div>
</template>

<script>
export default {
  layout: 'adminPage',
  asyncData({ params }) {
    const section = params.section
    return { section }
  },
  data() {
    return {
      overlay: false,
      employees: [],
      branch: undefined,
      department: undefined,
      fromPath: '',
      headers: [
        { text: 'Profile Picture', value: 'employee_picture' },
        { text: 'Employee Code', value: 'employee_code' },
        { text: 'English Name', value: 'employee_name_eng' },
        { text: 'Arabic Name', value: 'employee_name_a' },
        { text: 'Manager Code', value: 'Manager_Code' },
        { text: 'Email', value: 'Email' },
      ],
    }
  },
  created() {
    if (this.$nuxt.context.query.branch) {
      this.branch = this.$nuxt.context.query.branch
      this.department = this.$nuxt.context.query.department
      // save the from path to provide it to the back button
      this.fromPath = this.$nuxt.context.from.fullPath
    }
    this.getSectionEmployees()
  },
  methods: {
    async getSectionEmployees() {
      this.overlay = true
      try {
        const employees = await this.$axios.post(
          `${this.$config.baseURL}/administration-api/hr-sql-call`,
          {
            query: `SELECT employee_code, employee_name_eng, employee_name_a, position, nationality, employee_picture, Manager_Code, 
            Email FROM [MenaITech].[dbo].[Pay_employees] where branch_code='${this.branch}' and department='${this.department}' 
            and section='${this.section}'`,
          }
        )
        if (employees.status === 200) {
          const A = employees.data
          const B = []
          A.forEach(async (element) => {
            const checkEmployeeStatus = await this.$axios.post(
              `${this.$config.baseURL}/administration-api/hr-sql-call`,
              {
                query: `SELECT stop_val_flag AS theFlag FROM [dbo].[pay_emp_finance] where employee_code='${element.employee_code}'`,
              }
            )
            if (checkEmployeeStatus.status === 200) {
              if (checkEmployeeStatus.data[0].theFlag === 0) {
                // employee is not terminated
                B.push(element)
              }
            }
          })
          this.employees = B
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
  },
}
</script>
