<template>
  <v-container fluid class="pt-0">
    <!-- title -->
    <v-row>
      <v-col cols="12">
        <p class="text-subtitle-2 font-weight-regular">
          {{ $t('adminPage.portalAdmins.tableTitle') }}
        </p>
      </v-col>
    </v-row>
    <!-- form -->
    <v-row class="my-0">
      <v-col cols="12" sm="8" lg="6" xl="4" class="py-0">
        <v-form @submit.prevent="addPortalAdmin">
          <div class="d-flex">
            <v-text-field
              v-model="adminMember"
              :color="$vuetify.theme.dark ? 'white' : 'primary'"
              outlined
              dense
              :placeholder="$t('adminPage.bCards.formInput')"
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
              <tr v-for="member in portalAdmins" :key="member._id">
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
                  <v-dialog v-model="dialog" width="500" persistent>
                    <template #activator="{ on, attrs }">
                      <v-btn
                        text
                        fab
                        small
                        v-bind="attrs"
                        v-on="on"
                        @click="setToBeDeleted(member.employeeID)"
                      >
                        <v-icon small color="error">mdi-delete</v-icon>
                      </v-btn>
                    </template>

                    <v-card>
                      <v-card-title class="text-subtitle-1 primary_5">
                        {{ $t('adminPage.bCards.confirmationTitle') }}
                      </v-card-title>

                      <v-card-text class="pb-0">
                        <p class="text-subtitle-1 pt-3 pb-8 mb-0 text-center">
                          {{ $t('adminPage.bCards.confirmationMessage') }}
                        </p>
                      </v-card-text>

                      <v-divider></v-divider>

                      <v-card-actions>
                        <v-spacer></v-spacer>
                        <v-btn
                          color="error darken-1"
                          text
                          @click="dialog = false"
                        >
                          {{ $t('generals.no') }}
                        </v-btn>
                        <v-btn
                          color="success darken-1"
                          text
                          @click="deletePortalAdmin()"
                        >
                          {{ $t('generals.yes') }}
                        </v-btn>
                      </v-card-actions>
                    </v-card>
                  </v-dialog>
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
      adminMember: null,
      dialog: false,
      toBeDeleted: null,
    }
  },

  computed: {
    ...mapState({
      portalAdmins: (state) => state.administration.portalAdmins.portalAdmins,
    }),
  },

  mounted() {
    this.getPortalAdmins()
  },

  methods: {
    async getPortalAdmins() {
      try {
        await this.$store.dispatch(
          'administration/portalAdmins/getPortalAdmins'
        )
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
    async addPortalAdmin() {
      try {
        const A = this.adminMember.trim()
        if (A !== '') {
          this.$nextTick(async () => {
            this.$nuxt.$loading.start()
            const employeeCode = {
              code: A,
            }
            await this.$store.dispatch(
              'administration/portalAdmins/addPortalAdmin',
              employeeCode
            )
            this.adminMember = ''
            await this.getPortalAdmins()
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
    setToBeDeleted(id) {
      this.toBeDeleted = id
      this.dialog = true
    },
    async deletePortalAdmin() {
      try {
        this.dialog = false
        this.$nextTick(async () => {
          this.$nuxt.$loading.start()
          await this.$store.dispatch(
            'administration/portalAdmins/deletePortalAdmin',
            { code: this.toBeDeleted }
          )
          await this.getPortalAdmins()
          this.toBeDeleted = null
          this.$nuxt.$loading.finish()
        })
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
