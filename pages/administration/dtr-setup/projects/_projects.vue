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
          :to="
            localePath(
              `/administration/dtr-setup/departments/${divisionCode}?branch=${branch}&divisionName=${divisionName}`
            )
          "
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
        style="width: 100%; height: 50px"
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
      </div>
    </v-toolbar>

    <v-container class="px-3 px-md-8">
      <v-row>
        <v-col class="pt-5 pb-0" cols="12">
          <div>
            <p class="text-h5 mb-1">Projects</p>
            <hr />
            <hr />
          </div>
        </v-col>
      </v-row>
      <v-row v-if="allProjects.length > 0">
        <v-col
          v-for="(project, index) in allProjects"
          :key="index"
          cols="6"
          md="3"
          class="py-5"
        >
          <!-- 
          :to="
              localePath(
                `/administration/dtr-setup/projects/${department.system_code}?branch=${branch}&division=${divisionCode}&divisionName=${divisionName}&departmentName=${department.system_desp_e}`
              )
            "
         -->
          <v-card
            elevation="1"
            color="whiteColor"
            outlined
            nuxt
            min-height="150"
          >
            <v-list-item three-line>
              <v-list-item-content>
                <v-list-item-subtitle>{{
                  project.system_desp_e
                }}</v-list-item-subtitle>

                <v-list-item-subtitle>{{
                  project.system_desp_a
                }}</v-list-item-subtitle>

                <v-list-item-subtitle
                  >system_code: {{ project.system_code }}</v-list-item-subtitle
                >

                <v-list-item-subtitle
                  >major_code: {{ project.major_code }}</v-list-item-subtitle
                >

                <v-list-item-subtitle
                  >section_code:
                  {{ project.section_code }}</v-list-item-subtitle
                >
              </v-list-item-content>
            </v-list-item>
          </v-card>
        </v-col>
      </v-row>
      <v-row v-else>
        <v-col>
          <h5 class="text-h6 pa-5">
            {{ $t('adminPage.dtrApp.setup.noProjects') }}
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
    const departmentCode = params.projects
    return { departmentCode }
  },
  data() {
    return {
      overlay: false,
      allProjects: [],
      branch: undefined,
      divisionCode: undefined,
      divisionName: undefined,
      departmentName: undefined,
    }
  },
  created() {
    if (this.$nuxt.context.query) {
      this.branch = this.$nuxt.context.query.branch
      this.divisionCode = this.$nuxt.context.query.division
      this.divisionName = this.$nuxt.context.query.divisionName
      this.departmentName = this.$nuxt.context.query.departmentName
    }
    this.getProjectsPerDepartment()
  },

  methods: {
    async getProjectsPerDepartment() {
      this.overlay = true
      try {
        const projects = await this.$axios.post(
          `${this.$config.baseURL}/administration-api/hr-sql-call`,
          {
            query: `SELECT system_desp_a, system_desp_e, section_code, major_code, system_code FROM [dbo].[pay_code_tables] WHERE branch_code='${this.branch}' and system_code_type='71'  
                    and major_code='${this.divisionCode}' and section_code='${this.departmentCode}'`,
          }
        )
        if (projects.status === 200) {
          this.allProjects = projects.data
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

<style>
</style>