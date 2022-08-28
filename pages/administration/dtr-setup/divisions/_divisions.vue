<template>
  <div>
    <v-overlay :value="overlay">
      <v-progress-circular indeterminate size="60"></v-progress-circular>
    </v-overlay>

    <v-toolbar
      class="d-print-none"
      :class="
        $i18n.locale === 'ar' ? 'flex-row-reverse px-3 px-xl-16' : 'px-xl-3'
      "
      color="mainBG"
      height="50"
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
      </div>
    </v-toolbar>

    <v-container class="px-3 px-md-8">
      <v-row>
        <v-col class="pt-5 pb-0" cols="12">
          <div>
            <p class="text-h5 mb-1">Divisions</p>
            <hr />
            <hr />
          </div>
        </v-col>
      </v-row>
      <v-row>
        <v-col
          v-for="(division, index) in divisions"
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
            height="100"
            :to="
              localePath(
                `/administration/dtr-setup/departments/${division.system_code}?branch=${branch}&divisionName=${division.system_desp_e}`
              )
            "
          >
            <v-list-item two-line>
              <v-list-item-content>
                <v-list-item-subtitle>{{
                  division.system_desp_e
                }}</v-list-item-subtitle>

                <v-list-item-subtitle>{{
                  division.system_desp_a
                }}</v-list-item-subtitle>

                <!-- <v-list-item-subtitle
                  >division code:{{
                    division.system_code
                  }}</v-list-item-subtitle
                >
                <v-list-item-subtitle
                  >Major Code:{{ division.major_code }}</v-list-item-subtitle
                > -->
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
    const branch = params.divisions
    return { branch }
  },
  data() {
    return {
      overlay: false,
      divisions: [],
    }
  },
  created() {
    this.getBranchDivisions()
  },
  methods: {
    async getBranchDivisions() {
      this.overlay = true
      try {
        const divisions = await this.$axios.post(
          `${this.$config.baseURL}/administration-api/hr-sql-call`,
          {
            query: `SELECT system_desp_a, system_desp_e, system_code, major_code FROM [dbo].[pay_code_tables] 
            WHERE branch_code='${this.branch}' and system_code_type='41'`,
          }
        )
        if (divisions.status === 200) {
          this.divisions = divisions.data
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

