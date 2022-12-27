<template>
  <v-container fluid class="pt-5 px-5 px-md-16">
    <v-overlay :value="overlay">
      <v-progress-circular indeterminate size="60"></v-progress-circular>
    </v-overlay>
    <!-- title -->
    <v-row>
      <v-col>
        <h3 class="text-h5 primaryText--text">
          {{ $t('businessCards.appPageNames.logs') }}
        </h3>
        <hr class="mt-3 mb-1" />
      </v-col>
    </v-row>
    <!-- Search Box -->
    <v-row>
      <v-col class="mb-2" cols="12" sm="6" lg="4">
        <v-text-field
          v-model="searchTerm"
          :color="$vuetify.theme.dark ? 'white' : 'primary'"
          append-icon="mdi-magnify"
          :label="$t('businessCards.activityLogs.searchLabel')"
          single-line
          hide-details
          outlined
          dense
        ></v-text-field>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" class="py-0">
        <v-simple-table
          :class="$vuetify.theme.dark ? 'primary' : ''"
          class="primaryText--text"
          dense
        >
          <template #default>
            <thead>
              <tr>
                <th class="text-subtitle-2 primaryText--text">
                  {{ $t('businessCards.activityLogs.dateTitle') }}
                </th>
                <th class="text-subtitle-2 primaryText--text">
                  {{ $t('businessCards.activityLogs.timeTitle') }}
                </th>
                <th class="text-subtitle-2 primaryText--text">
                  {{ $t('businessCards.activityLogs.adminName') }}
                </th>
                <th class="text-subtitle-2 primaryText--text">
                  {{ $t('businessCards.activityLogs.theAction') }}
                </th>
                <th class="text-subtitle-2 primaryText--text">
                  {{ $t('businessCards.activityLogs.bCardID') }}
                </th>
                <th class="text-subtitle-2 primaryText--text">
                  {{ $t('businessCards.activityLogs.bCardName') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in logsArray" :key="log.ID">
                <td>
                  {{ log.theDate.slice(0, 10) }}
                </td>
                <td>{{ log.theTime.slice(11, 19) }}</td>
                <td>{{ log.Admin_Name }}</td>
                <td>{{ log.theAction }}</td>
                <td>{{ log.BCard_ID }}</td>
                <td>{{ log.BCard_Name }}</td>
              </tr>
            </tbody>
          </template>
        </v-simple-table>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  layout: 'businessCards',
  data() {
    return {
      searchTerm: '',
      activityLogs: [],
      overlay: false,
    }
  },
  computed: {
    logsArray() {
      return this.activityLogs.filter((singleCard) => {
        return (
          singleCard.BCard_ID.toLowerCase().match(
            this.searchTerm.toLowerCase()
          ) ||
          singleCard.BCard_Name.toLowerCase().match(
            this.searchTerm.toLowerCase()
          ) ||
          singleCard.theAction
            .toLowerCase()
            .match(this.searchTerm.toLowerCase())
        )
      })
    },
  },
  mounted() {
    this.getActivityLogs()
  },
  methods: {
    async getActivityLogs() {
      try {
        this.overlay = true
        const savedLogs = await this.$axios.post(
          `${this.$config.baseURL}/business-cards-api/sql-call`,
          {
            query: `SELECT * FROM [businessCards].[logs] ORDER BY ID DESC`,
          }
        )
        this.activityLogs = savedLogs.data
        this.overlay = false
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