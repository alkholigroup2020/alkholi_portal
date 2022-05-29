<template>
  <v-container>
    <!-- title -->
    <v-row>
      <v-col cols="12" class="mx-5 mx-md-15">
        <h2 class="primaryText--text text-h6 text-md-h5 pt-3 pb-2 px-3">
          {{ $t('businessCards.generatedCards.title') }}
        </h2>
        <p class="text-subtitle-2 pt-1 pb-2 px-3 mb-0">
          {{ $t('businessCards.generatedCards.subTitle') }}
        </p>
      </v-col>
    </v-row>

    <!-- Search Box -->
    <v-row class="mx-0">
      <v-col cols="12" class="mx-5 mx-md-15 mb-5" sm="6" lg="4">
        <v-text-field
          v-model="searchTerm"
          :color="$vuetify.theme.dark ? 'white' : 'primary'"
          append-icon="mdi-magnify"
          :label="$t('businessCards.generatedCards.searchLabel')"
          single-line
          hide-details
          outlined
          dense
        ></v-text-field>
      </v-col>
    </v-row>

    <!-- table -->
    <v-row>
      <v-col cols="12" class="py-0">
        <v-simple-table
          :class="$vuetify.theme.dark ? 'primary' : ''"
          class="mx-5 pb-5 mx-md-15 primaryText--text"
        >
          <template #default>
            <thead>
              <tr>
                <th class="text-left text-subtitle-2 primaryText--text"></th>
                <th class="text-left text-subtitle-2 primaryText--text">
                  Name
                </th>
                <th class="text-left text-subtitle-2 primaryText--text">
                  Employee ID
                </th>
                <th class="text-left text-subtitle-2 primaryText--text">
                  Email Address
                </th>
                <th class="text-left text-subtitle-2 primaryText--text">
                  Title
                </th>
                <th class="text-left text-subtitle-2 primaryText--text">
                  QR Code
                </th>
                <th class="text-left text-subtitle-2 primaryText--text">
                  Business Card
                </th>
                <th class="text-left text-subtitle-2 primaryText--text"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in bCardsArray" :key="member._id">
                <td>
                  <v-avatar
                    v-if="member.profilePic"
                    style="border: 0.5px #000046 solid"
                    size="40"
                  >
                    <v-img
                      :src="`${$config.baseURL}/business-cards-api/business-cards/${member.profilePic}`"
                      alt="Profile Image"
                    ></v-img>
                  </v-avatar>
                  <v-avatar
                    v-else
                    style="border: 0.5px #000046 solid"
                    size="40"
                  >
                    <v-img
                      :src="`${$config.baseURL}/portal-api/profile-data/profile.png`"
                      alt="Profile Image"
                    ></v-img>
                  </v-avatar>
                </td>
                <td>{{ member.fullName_e }}</td>
                <td>{{ member.employeeID }}</td>
                <td>{{ member.mailAddress }}</td>
                <td>{{ member.title }}</td>
                <td>
                  <a
                    download
                    :class="$vuetify.theme.dark ? 'white--text' : ''"
                    :href="`${$config.baseURL}/business-cards-api/business-cards/${member.qrCodePath}`"
                    >{{ member.qrCodePath }}</a
                  >
                </td>
                <td>
                  <a
                    target="_blank"
                    :class="$vuetify.theme.dark ? 'white--text' : ''"
                    :href="`${$config.baseURL}/business-card/${member.employeeID}`"
                  >
                    {{ $t('businessCards.generatedCards.showCard') }}
                  </a>
                </td>
                <!-- delete confirmation -->
                <!-- <portal-admins-delete-confirmation
                  :memberID="member.employeeID"
                /> -->
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
      bCards: [],
      searchTerm: '',
    }
  },
  computed: {
    bCardsArray() {
      return this.bCards.filter((singleCard) => {
        return (
          singleCard.employeeID
            .toLowerCase()
            .match(this.searchTerm.toLowerCase()) ||
          singleCard.fullName_e
            .toLowerCase()
            .match(this.searchTerm.toLowerCase())
        )
      })
    },
  },
  mounted() {
    this.getGeneratedCards()
  },
  methods: {
    async getGeneratedCards() {
      try {
        const generatedCards = await this.$axios.post(
          `${this.$config.baseURL}/business-cards-api/sql-call`,
          {
            query: `SELECT * FROM [businessCards].[employeeData]`,
          }
        )
        this.bCards = generatedCards.data
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