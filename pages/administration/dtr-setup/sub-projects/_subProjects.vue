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
              `/administration/dtr-setup/projects/${departmentCode}?branch=${branch}&division=${divisionCode}&divisionName=${divisionName}&departmentName=${departmentName}`
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
      </div>
    </v-toolbar>

    <drtAdminPopup
      v-if="showDTRAdminPopup"
      @resetPopupValue="showDTRAdminPopup = false"
    />

    <v-container fluid class="px-5 px-md-9">
      <v-row>
        <v-col class="pt-5 pb-0" cols="12">
          <div class="d-md-flex mb-1">
            <p class="text-h5 mb-1">
              {{ $t('adminPage.dtrApp.setup.subProjectsTitle') }}
            </p>
            <v-spacer></v-spacer>

            <div class="d-md-flex">
              <v-btn
                text
                outlined
                depressed
                max-width="100%"
                style="direction: ltr"
                :disabled="allSubProjects.length <= 0"
                class="text-capitalize my-2 my-md-0 mx-md-2 px-2 text-body-2"
                @click="listAllEmployees"
                >List all under -
                <span class="font-weight-medium"
                  >&nbsp;{{ projectName }}&nbsp;</span
                >
                - Project</v-btn
              >
              <v-btn
                text
                outlined
                depressed
                class="text-capitalize px-2 text-body-2"
                @click="showDTRAdminPopup = true"
                >Assign An Admin</v-btn
              >
            </div>
          </div>
          <hr />
          <hr />
        </v-col>
      </v-row>

      <v-row v-if="allSubProjects.length > 0">
        <v-col
          v-for="(subProject, index) in allSubProjects"
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
                `/administration/dtr-setup/sub-project/${subProject.system_code}?branch=${branch}&division=${divisionCode}&department=${departmentCode}&project=${subProject.division_code}&divisionName=${divisionName}&departmentName=${departmentName}&projectName=${projectName}&subProjectName=${subProject.system_desp_e}`
              )
            "
          >
            <v-list-item two-line class="text-body-1 font-weight-medium">
              <v-list-item-content>
                <v-list-item-subtitle>{{
                  subProject.system_desp_e
                }}</v-list-item-subtitle>

                <v-list-item-subtitle>{{
                  subProject.system_desp_a
                }}</v-list-item-subtitle>

                <!-- <v-list-item-subtitle
                  >Division: {{ subProject.major_code }}</v-list-item-subtitle
                > -->

                <!-- <v-list-item-subtitle
                  >Department:
                  {{ subProject.section_code }}</v-list-item-subtitle
                > -->

                <!-- <v-list-item-subtitle
                  >Project: {{ subProject.division_code }}</v-list-item-subtitle
                > -->

                <!-- <v-list-item-subtitle
                  >Sub Project:
                  {{ subProject.system_code }}</v-list-item-subtitle
                > -->
              </v-list-item-content>
            </v-list-item>
          </v-card>
        </v-col>
      </v-row>

      <v-row v-else>
        <v-col v-if="overlay === false">
          <h5 class="text-body-1 px-1 py-3 red--text">
            {{ $t('adminPage.dtrApp.setup.noSubProjects') }}
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
export default {
  layout: 'adminPage',
  asyncData({ params }) {
    const projectCode = params.subProjects
    return { projectCode }
  },
  data() {
    return {
      overlay: false,
      showTable: false,
      allSubProjects: [],
      allEmployeesResult: [],
      branch: undefined,
      divisionCode: undefined,
      departmentCode: undefined,
      divisionName: undefined,
      departmentName: undefined,
      showDTRAdminPopup: false,
      projectName: undefined,
    }
  },
  created() {
    if (this.$nuxt.context.query) {
      this.branch = this.$nuxt.context.query.branch
      this.divisionCode = this.$nuxt.context.query.division
      this.departmentCode = this.$nuxt.context.query.department
      this.divisionName = this.$nuxt.context.query.divisionName
      this.departmentName = this.$nuxt.context.query.departmentName
      this.projectName = this.$nuxt.context.query.projectName
    }
    this.getSubProjectsPerProject()
  },
  methods: {
    async getSubProjectsPerProject() {
      this.overlay = true
      try {
        const subProjects = await this.$axios.post(
          `${this.$config.baseURL}/administration-api/hr-sql-call`,
          {
            query: `SELECT system_desp_a, system_desp_e, system_code, major_code, section_code, division_code
                    FROM [dbo].[pay_code_tables] WHERE branch_code='${this.branch}' and system_code_type='72'  
                    and major_code='${this.divisionCode}' and section_code='${this.departmentCode}' and division_code ='${this.projectCode}'`,
          }
        )
        if (subProjects.status === 200) {
          this.allSubProjects = subProjects.data
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
        const allEmployees = []
        const getEmployeesData = await (async () => {
          for await (const element of this.allSubProjects) {
            const queryResult = await this.$axios.post(
              `${this.$config.baseURL}/administration-api/hr-sql-call`,
              {
                query: `
                SELECT A.employee_code, A.employee_name_eng, A.employee_name_a, A.position, A.nationality, A.employee_picture, A.Manager_Code, A.Email
                FROM [MenaITech].[dbo].[Pay_employees] as A, [MenaITech].[dbo].[pay_emp_finance] as B
                WHERE A.employee_code=B.employee_code
                AND A.branch_code='${this.branch}' AND A.department='${element.major_code}' AND A.Division='${element.division_code}' 
                AND A.section='${element.section_code}' AND A.Unit='${element.system_code}'
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
  },
}
</script>

<style>
</style>