<template>
  <v-container class="pt-0">
    <!-- title -->
    <v-row>
      <v-col cols="12">
        <p class="text-subtitle-2 font-weight-regular">
          {{ $t('adminPage.bCards.tableTitle') }}
        </p>
      </v-col>
    </v-row>
    <!-- form -->
    <v-row class="my-0">
      <v-col cols="12" sm="8" lg="6" xl="4" class="py-0">
        <v-form @submit.prevent="addBusinessCardsAdmin">
          <div class="d-flex">
            <v-text-field
              v-model="adminMember"
              color="primary"
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
        <v-simple-table class="pb-3">
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
                <th class="text-left text-subtitle-2 primaryText--text"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in bCardsAdmins" :key="member._id">
                <td>
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
                <td>{{ member.fullName }}</td>
                <td>{{ member.employeeID }}</td>
                <td>{{ member.mailAddress }}</td>
                <td>{{ member.title }}</td>

                <!-- delete confirmation -->
                <v-dialog v-model="dialog" width="500" persistent>
                  <template #activator="{ on, attrs }">
                    <v-btn
                      text
                      fab
                      small
                      v-bind="attrs"
                      v-on="on"
                      @click="dialog = true"
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
                        @click.stop="dialog = false"
                      >
                        {{ $t('generals.no') }}
                      </v-btn>
                      <v-btn
                        color="success darken-1"
                        text
                        @click.stop="
                          deleteBusinessCardsAdmin(member.employeeID)
                        "
                      >
                        {{ $t('generals.yes') }}
                      </v-btn>
                    </v-card-actions>
                  </v-card>
                </v-dialog>
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
      showSnackbar: true,
      adminMember: null,
      dialog: false,
    }
  },

  computed: {
    ...mapState({
      bCardsAdmins: (state) =>
        state.administration.businessCardsAdmins.bCardsAdmins,
    }),
  },

  created() {
    this.getBusinessCardsAdmins()
  },

  methods: {
    async getBusinessCardsAdmins() {
      try {
        await this.$store.dispatch(
          'administration/businessCardsAdmins/getBusinessCardsAdmins'
        )
      } catch (error) {
        //
      }
    },
    addBusinessCardsAdmin() {
      try {
        const A = this.adminMember.trim()
        if (A !== '') {
          this.$nextTick(async () => {
            this.$nuxt.$loading.start()
            const employeeCode = {
              code: A,
            }
            await this.$store.dispatch(
              'administration/businessCardsAdmins/addBusinessCardsAdmin',
              employeeCode
            )
            this.adminMember = ''
            await this.getBusinessCardsAdmins()
            this.$nuxt.$loading.finish()
          })
        }
      } catch (error) {
        //
      }
    },
    deleteBusinessCardsAdmin(id) {
      try {
        this.dialog = false
        this.$nextTick(async () => {
          this.$nuxt.$loading.start()
          await this.$store.dispatch(
            'administration/businessCardsAdmins/deleteBusinessCardsAdmin',
            { code: id }
          )
          await this.getBusinessCardsAdmins()
          this.$nuxt.$loading.finish()
        })
      } catch (error) {
        //
      }
    },
  },
}
</script>
