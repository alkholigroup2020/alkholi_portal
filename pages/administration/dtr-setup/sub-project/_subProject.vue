<template>
  <div>
    <v-overlay :value="overlay">
      <v-progress-circular indeterminate size="60"></v-progress-circular>
    </v-overlay>

    <v-toolbar
      class="d-print-none px-0 px-md-5"
      color="mainBG"
      height="50"
      :class="$i18n.locale === 'ar' ? 'flex-row-reverse' : ''"
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
          :to="
            localePath(
              `/administration/dtr-setup/sub-projects/${projectCode}?branch=${branch}&division=${divisionCode}&department=${departmentCode}&divisionName=${divisionName}&departmentName=${departmentName}&projectName=${projectName}`
            )
          "
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
        <h6 class="text-body-1 primaryText--Text">{{ divisionName }}</h6>
        <div class="px-2">
          <v-icon color="primaryText">mdi-arrow-right-thin</v-icon>
        </div>
        <h6 class="text-body-1 primaryText--Text">{{ departmentName }}</h6>
        <div class="px-2">
          <v-icon color="primaryText">mdi-arrow-right-thin</v-icon>
        </div>
        <h6 class="text-body-1 primaryText--Text">{{ projectName }}</h6>
        <div class="px-2">
          <v-icon color="primaryText">mdi-arrow-right-thin</v-icon>
        </div>
        <h6 class="text-body-1 primaryText--Text">{{ subProjectName }}</h6>
      </div>
    </v-toolbar>

    <div style="height: 50px"></div>

    <drtAdminPopup
      v-if="showDTRAdminPopup"
      :brach="branch"
      :division="divisionCode"
      :department="departmentCode"
      :project="projectCode"
      :subproject="subProjectCode"
      @resetPopupValue="popupClosed"
    />

    <!-- <hr class="red" />
    <div class="d-flex">
      <v-spacer></v-spacer>
      <div>Branch code is ==> {{ branch }}</div>
      <v-spacer></v-spacer>
      <div>Division code is ==> {{ divisionCode }}</div>
      <v-spacer></v-spacer>
      <div>Department code is ==> {{ departmentCode }}</div>
      <v-spacer></v-spacer>
      <div>Project code is ==> {{ projectCode }}</div>
      <v-spacer></v-spacer>
      <div>Sub-project code is ==> {{ subProjectCode }}</div>
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
          <div class="d-md-flex mb-1">
            <p class="text-h5 mb-1">
              {{ $t('adminPage.dtrApp.setup.subProjectTitle') }}
            </p>
            <v-spacer></v-spacer>
            <div class="d-md-flex">
              <v-btn
                outlined
                depressed
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                class="text-capitalize px-2 text-body-2"
                :disabled="allEmployeesResult.length <= 0"
                @click="showDTRAdminPopup = true"
              >
                <v-icon small :color="$vuetify.theme.dark ? 'white' : 'primary'"
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
        </v-col>
      </v-row>

      <v-row v-if="showTable">
        <v-col v-if="allEmployeesResult.length > 0">
          <employeesTable :all-employees-result="allEmployeesResult" />
        </v-col>
        <v-col v-else>
          <h5 class="text-body-1 px-1 py-3 red--text">
            {{ $t('adminPage.dtrApp.setup.noEmployees') }}
          </h5>
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
    const subProjectCode = params.subProject
    return { subProjectCode }
  },

  data() {
    return {
      overlay: false,
      showTable: false,
      allEmployeesResult: [],
      dtrAdmins: [],
      branch: undefined,
      divisionCode: undefined,
      departmentCode: undefined,
      projectCode: undefined,
      divisionName: undefined,
      departmentName: undefined,
      projectName: undefined,
      showDTRAdminPopup: false,
      subProjectName: undefined,
    }
  },

  computed: {
    ...mapState({
      barWidth: (state) => state.portal.toolbarWidth,
    }),
  },

  async created() {
    if (this.$nuxt.context.query) {
      this.branch = this.$nuxt.context.query.branch
      this.divisionCode = this.$nuxt.context.query.division
      this.departmentCode = this.$nuxt.context.query.department
      this.projectCode = this.$nuxt.context.query.project
      this.divisionName = this.$nuxt.context.query.divisionName
      this.departmentName = this.$nuxt.context.query.departmentName
      this.projectName = this.$nuxt.context.query.projectName
      this.subProjectName = this.$nuxt.context.query.subProjectName
    }
    await this.getAllEmployeesPerSubProject()
    await this.getDTRAdmins()
  },

  methods: {
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
              AND departmentCode='${this.departmentCode}'
              AND projectCode ='${this.projectCode}'
              AND subProjectCode='${this.subProjectCode}'
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
    async getAllEmployeesPerSubProject() {
      try {
        this.overlay = true
        const allEmployees = []
        const getEmployeesData = await (async () => {
          const queryResult = await this.$axios.post(
            `${this.$config.baseURL}/administration-api/hr-sql-call`,
            {
              query: `
                SELECT A.employee_code, A.employee_name_eng, A.employee_name_a, A.position, A.nationality, A.employee_picture, A.Manager_Code, A.Email
                FROM [MenaITech].[dbo].[Pay_employees] as A, [MenaITech].[dbo].[pay_emp_finance] as B
                WHERE A.employee_code=B.employee_code
                AND A.branch_code='${this.branch}' AND A.department='${this.divisionCode}' 
                AND A.Division='${this.projectCode}' 
                AND A.section='${this.departmentCode}' AND A.Unit='${this.subProjectCode}'
                AND B.stop_val_flag='0'
                `,
            }
          )
          if (queryResult.status === 200) {
            queryResult.data.forEach((e) => {
              allEmployees.push(e)
            })
          }
        })
        await getEmployeesData()
        this.allEmployeesResult = allEmployees
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

<style>
</style>