<template>
  <div>
    <v-overlay :value="overlay">
      <v-progress-circular indeterminate size="60"></v-progress-circular>
    </v-overlay>

    <v-toolbar
      class="d-print-none px-0 px-md-5"
      :class="$i18n.locale === 'ar' ? 'flex-row-reverse ' : ''"
      color="mainBG"
      height="50"
      :width="$vuetify.breakpoint.lgAndUp ? barWidth : '100%'"
      style="position: fixed"
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
            class="text-subtitle-1 text-capitalize primaryText--text px-1"
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
            class="text-subtitle-1 text-capitalize primaryText--text px-1 mx-2"
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
            ? 'd-flex flex-row-reverse justify-start align-center'
            : 'd-flex justify-end align-center'
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

    <div style="height: 50px"></div>

    <drtAdminPopup
      v-if="showDTRAdminPopup"
      :brach="branch"
      :division="divisionCode"
      @resetPopupValue="popupClosed"
    />

    <!-- <hr class="red" />
    <div class="d-flex">
      <v-spacer></v-spacer>
      <div>Branch code is ==> {{ branch }}</div>
      <v-spacer></v-spacer>
      <div>Division code is ==> {{ divisionCode }}</div>
      <v-spacer></v-spacer>
    </div>
    <hr class="red" /> -->

    <div v-if="dtrAdmins.length > 0">
      <p class="text-h5 pt-3 mb-0 px-5 px-md-9">Admins Table</p>
      <hr class="mx-5 mx-md-9" />
      <hr class="mx-5 mx-md-9" />
      <adminsTable :admins="dtrAdmins" />
      <hr class="mx-5 mx-md-9 mt-5" />
      <hr class="mx-5 mx-md-9" />
    </div>

    <v-container fluid class="px-5 px-md-9">
      <v-row>
        <v-col class="pt-3 pb-0" cols="12">
          <div>
            <div class="d-md-flex mb-1">
              <p class="text-h5 mb-1">
                {{ $t('adminPage.dtrApp.setup.departmentsTitle') }}
              </p>
              <v-spacer></v-spacer>

              <div>
                <v-text-field
                  v-model="searchTerm"
                  :color="$vuetify.theme.dark ? 'white' : 'primary'"
                  append-icon="mdi-magnify"
                  single-line
                  outlined
                  hide-details
                  dense
                  class="mt-n1"
                ></v-text-field>
              </div>

              <v-spacer></v-spacer>
              <div class="d-md-flex">
                <v-btn
                  outlined
                  max-width="100%"
                  :color="$vuetify.theme.dark ? 'white' : 'primary'"
                  depressed
                  :disabled="allDepartments.length <= 0"
                  class="text-capitalize my-2 my-md-0 mx-md-2 px-2 text-body-2"
                  style="direction: ltr"
                  @click="listAllEmployees"
                >
                  <v-icon
                    size="18"
                    :color="$vuetify.theme.dark ? 'white' : 'primary'"
                    >mdi-format-list-bulleted</v-icon
                  >
                  <span
                    :class="
                      $vuetify.theme.dark
                        ? 'white--text mx-2'
                        : 'primary--text mx-2'
                    "
                    >List all under -
                    <span class="font-weight-medium"
                      >&nbsp;{{ divisionName }}&nbsp;</span
                    >
                    - division</span
                  >
                </v-btn>
                <v-btn
                  :color="$vuetify.theme.dark ? 'white' : 'primary'"
                  outlined
                  depressed
                  :disabled="allDepartments.length <= 0"
                  class="text-capitalize px-2 text-body-2"
                  @click="showDTRAdminPopup = true"
                >
                  <v-icon
                    small
                    :color="$vuetify.theme.dark ? 'white' : 'primary'"
                    >mdi-vector-link</v-icon
                  >
                  <span
                    :class="
                      $vuetify.theme.dark
                        ? 'white--text mx-2'
                        : 'primary--text mx-2'
                    "
                    >Assign An Admin</span
                  >
                </v-btn>
              </div>
            </div>
            <hr />
            <hr />
          </div>
        </v-col>
      </v-row>

      <v-row v-if="departmentsArray.length > 0">
        <v-col
          v-for="(department, index) in departmentsArray"
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
            <v-list-item two-line class="text-body-1 font-weight-medium">
              <v-list-item-content>
                <v-list-item-subtitle>{{
                  department.system_desp_e
                }}</v-list-item-subtitle>

                <v-list-item-subtitle>{{
                  department.system_desp_a
                }}</v-list-item-subtitle>

                <!-- <v-list-item-subtitle
                  >Department:{{ department.system_code }}</v-list-item-subtitle
                > -->

                <!-- <v-list-item-subtitle
                  >Division:{{ department.major_code }}</v-list-item-subtitle
                > -->

                <!-- <v-list-item-subtitle
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
          <h5 class="text-body-1 px-1 py-3 red--text">
            {{ $t('adminPage.dtrApp.setup.noDepartments') }}
          </h5>
        </v-col>
      </v-row>

      <v-row v-if="showTable">
        <v-col v-if="allEmployeesResult.length > 0">
          <employeesTable :all-employees-result="allEmployeesResult" />
        </v-col>
        <v-col v-else>
          <p class="text-body-1 px-1 red--text">
            {{ $t('adminPage.dtrApp.setup.noEmployees') }}
          </p>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  layout: 'adminPage',
  asyncData({ params }) {
    const divisionCode = params.departments
    return { divisionCode }
  },
  data() {
    return {
      overlay: false,
      showTable: false,
      searchTerm: '',
      dtrAdmins: [],
      allDepartments: [],
      branch: undefined,
      divisionName: undefined,
      allEmployeesResult: [],
      showDTRAdminPopup: false,
    }
  },
  computed: {
    ...mapState({
      barWidth: (state) => state.portal.toolbarWidth,
    }),
    departmentsArray() {
      return this.allDepartments.filter((singleDepartment) => {
        return (
          singleDepartment.system_desp_e
            .toLowerCase()
            .match(this.searchTerm.toLowerCase()) ||
          singleDepartment.system_desp_a
            .toLowerCase()
            .match(this.searchTerm.toLowerCase())
        )
      })
    },
  },
  async created() {
    if (this.$nuxt.context.query) {
      this.branch = this.$nuxt.context.query.branch
      this.divisionName = this.$nuxt.context.query.divisionName
    }

    await this.getDepartmentsPerDivision()
    await this.getDTRAdmins()
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

    async listAllEmployees() {
      this.overlay = true
      try {
        const allEmployees = await this.$axios.post(
          `${this.$config.baseURL}/administration-api/hr-sql-call`,
          {
            query: `
              SELECT A.employee_code, A.employee_name_eng, A.employee_name_a, A.position, A.nationality, A.employee_picture, A.Manager_Code, A.Email
              FROM [MenaITech].[dbo].[Pay_employees] as A, [MenaITech].[dbo].[pay_emp_finance] as B
              WHERE A.employee_code=B.employee_code
              AND A.branch_code='${this.branch}' AND A.department='${this.divisionCode}' 
              AND B.stop_val_flag='0'
            `,
          }
        )

        if (allEmployees.status === 200) {
          if (allEmployees.data.length > 0) {
            this.allEmployeesResult = allEmployees.data
          }
        }

        this.showTable = true
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

    async getDTRAdmins() {
      try {
        this.overlay = true
        const queryResult = await this.$axios.post(
          `${this.$config.baseURL}/administration-api/sql-call`,
          {
            query: `
                SELECT * FROM [alkholiPortal].[dtr].[adminAssignment]
                WHERE branchName='${this.branch}' 
                AND divisionCode='${this.divisionCode}' 
                AND departmentCode='undefined'
                AND projectCode ='undefined'
                AND subProjectCode='undefined'
                `,
          }
        )
        if (queryResult.status === 200) {
          this.dtrAdmins = queryResult.data
        }
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

    async popupClosed() {
      try {
        await this.getDTRAdmins()
        this.showDTRAdminPopup = false
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
