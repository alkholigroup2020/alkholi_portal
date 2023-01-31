<template>
  <div>
    <v-toolbar
      color="mainBG"
      height="50px"
      :width="$vuetify.breakpoint.lgAndUp ? barWidth : '100%'"
      flat
      style="position: fixed"
    >
      <div class="d-flex mx-xl-16" style="width: 100%; height: 50px">
        <v-spacer></v-spacer>
        <div>
          <v-btn
            depressed
            text
            tile
            height="100%"
            :ripple="false"
            @click="exportData"
          >
            <v-icon class="px-1">mdi-export</v-icon>
            <span class="px-1 text-capitalize">{{
              $t('generals.export')
            }}</span>
          </v-btn>
        </div>
      </div>
    </v-toolbar>

    <div style="height: 50px"></div>

    <div hidden>
      <a
        ref="fileDownload"
        download
        :href="`${$config.baseURL}/elevators-surveys-api/exported-csv-data/surveys-results.csv`"
        >download</a
      >
    </div>

    <div class="pb-1 pt-3 pt-md-5 px-1 px-md-3">
      <!-- <v-card elevation="0" outlined> -->
      <!-- class="elevation-0" -->
      <v-data-table
        :headers="headers"
        :items="surveysData"
        :items-per-page="10"
        :loading="surveysData.length > 0 ? false : true"
        loading-text="Loading data ..."
      ></v-data-table>
      <!-- </v-card> -->
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
export default {
  layout: 'elevatorsSurvey',
  data() {
    return {
      surveysData: [],
      headers: [
        {
          text: 'Contract ID',
          align: 'start',
          sortable: true,
          value: 'contractID',
        },
        {
          text: 'Client Name',
          align: 'start',
          sortable: false,
          value: 'clientName',
        },
        {
          text: 'Project Name',
          align: 'start',
          sortable: false,
          value: 'projectName',
        },
        {
          text: 'Email Address',
          align: 'start',
          sortable: false,
          value: 'customerEmail',
        },
        {
          text: 'Mobile Number',
          align: 'start',
          sortable: false,
          value: 'customerMobileNumber',
        },
        {
          text: 'Experience Level',
          align: 'start',
          sortable: false,
          value: 'Client_Experience_Level',
        },
        {
          text: 'Service Quality',
          align: 'start',
          sortable: false,
          value: 'Service_Quality',
        },
        {
          text: 'Delivery Time',
          align: 'start',
          sortable: false,
          value: 'Delivery_Time',
        },
        {
          text: 'Installation Time',
          align: 'start',
          sortable: false,
          value: 'Installation_Time',
        },
        {
          text: 'Employees Behavior',
          align: 'start',
          sortable: false,
          value: 'Employees_Behavior',
        },
        {
          text: 'Product Rating',
          align: 'start',
          sortable: false,
          value: 'Product_Rating',
        },
        {
          text: 'Client Message',
          align: 'start',
          sortable: false,
          value: 'Client_Message',
        },
      ],
    }
  },
  computed: {
    ...mapState({
      barWidth: (state) => state.portal.toolbarWidth,
    }),
  },

  mounted() {
    this.getClientsData()
  },
  methods: {
    async getClientsData() {
      try {
        const request = await this.$axios.get(
          `${this.$config.baseURL}/elevators-surveys-api/get-clients-survey-data`
        )

        if (request.status === 200) {
          this.surveysData = request.data
        }
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
    async exportData() {
      try {
        const request = await this.$axios.post(
          `${this.$config.baseURL}/elevators-surveys-api/export-clients-csv-data`
        )

        if (request.status === 200) {
          this.$refs.fileDownload.click()
        }
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

<style>
</style>