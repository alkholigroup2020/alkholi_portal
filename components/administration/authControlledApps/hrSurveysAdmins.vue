<template>
  <v-container fluid class="pt-0">
    <!-- title -->
    <v-row>
      <v-col cols="12">
        <p class="text-subtitle-2 font-weight-regular">
          {{ $t('adminPage.hrSurveys.tableTitle') }}
        </p>
      </v-col>
    </v-row>

    <!-- form -->
    <v-row class="my-0">
      <v-col cols="12" sm="8" lg="6" xl="4" class="py-0">
        <v-form @submit.prevent="addHRSurveyUser">
          <div class="d-flex">
            <v-text-field
              v-model="hrSurveyUser"
              :color="$vuetify.theme.dark ? 'white' : 'primary'"
              outlined
              dense
              :placeholder="$t('adminPage.hrSurveys.formInput')"
            ></v-text-field>
            <v-btn
              type="submit"
              small
              fab
              elevation="0"
              color="primary"
              class="mx-3"
            >
              <v-icon color="white">mdi-plus</v-icon>
            </v-btn>
          </div>
        </v-form>
      </v-col>
    </v-row>

    <!-- table -->
    <v-row>
      <v-col cols="12" class="py-0">
        <v-simple-table
          class="pb-1"
          :class="$vuetify.theme.dark ? 'primary' : ''"
        >
          <template #default>
            <thead>
              <tr>
                <th></th>
                <th class="text-center text-subtitle-2 primaryText--text">
                  Name
                </th>
                <th class="text-center text-subtitle-2 primaryText--text">
                  Employee ID
                </th>
                <th class="text-center text-subtitle-2 primaryText--text">
                  Email Address
                </th>
                <th class="text-center text-subtitle-2 primaryText--text">
                  Title
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in hrSurveyUsers" :key="member._id">
                <td class="text-center py-1">
                  <v-avatar
                    v-if="member.hrPicture"
                    style="border: 0.5px #000046 solid"
                    size="40"
                  >
                    <v-img
                      :src="`${$config.hrPictureURL}/${member.profilePicPath}`"
                      alt="Profile Image"
                    ></v-img>
                  </v-avatar>
                  <v-avatar
                    v-if="member.portalPicture"
                    style="border: 0.5px #000046 solid"
                    size="40"
                  >
                    <v-img
                      :src="`${$config.baseURL}/portal-api/profile-data/${member.profilePicPath}`"
                      alt="Profile Image"
                    ></v-img>
                  </v-avatar>
                </td>
                <td class="text-center">{{ member.fullName }}</td>
                <td class="text-center">{{ member.employeeID }}</td>
                <td class="text-center">{{ member.mailAddress }}</td>
                <td class="text-center">{{ member.title }}</td>
                <td>
                  <hrSurveysDelete :employee="member.employeeID" />
                </td>
              </tr>
            </tbody>
          </template>
        </v-simple-table>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { mapState } from 'vuex'

export default {
  layout: 'adminPage',
  data() {
    return {
      hrSurveyUser: null,
    }
  },

  computed: {
    ...mapState({
      hrSurveyUsers: (state) => state.administration.hrSurveys.hrSurveyUsers,
    }),
  },

  mounted() {
    this.getHRSurveyUsers()
  },

  methods: {
    async getHRSurveyUsers() {
      try {
        await this.$store.dispatch('administration/hrSurveys/getHRSurveyUsers')
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

    async addHRSurveyUser() {
      try {
        const A = this.hrSurveyUser.trim()
        if (A !== '') {
          this.$nextTick(async () => {
            this.$nuxt.$loading.start()
            const employeeCode = {
              code: A,
            }
            await this.$store.dispatch(
              'administration/hrSurveys/addHRSurveyUser',
              employeeCode
            )
            this.hrSurveyUser = null
            await this.getHRSurveyUsers()
            this.$nuxt.$loading.finish()
          })
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