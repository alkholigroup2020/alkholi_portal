<template>
  <v-card
    elevation="0"
    rounded="lg"
    color="transparent"
    class="d-flex flex-column"
    height="50vh"
  >
    <div class="d-flex justify-center py-5">
      <v-avatar
        :size="$vuetify.breakpoint.mdAndDown ? '120' : '150'"
        style="border: 0.5px #000046 solid"
      >
        <v-img
          :src="`${profilePicPath}`"
          alt="Profile Image"
          position="top center"
        ></v-img>
      </v-avatar>
    </div>
    <div class="body-2 text-center">
      <p
        v-if="$i18n.locale === 'en'"
        class="mb-0 text-body-1 font-weight-medium"
        :class="$vuetify.breakpoint.mdAndDown ? 'white--text' : ''"
      >
        {{ userFullName }}
      </p>
      <p
        v-else
        class="mb-1 text-body-1 font-weight-medium"
        :class="$vuetify.breakpoint.mdAndDown ? 'white--text' : ''"
      >
        {{ userFullNameAr }}
      </p>
    </div>
    <div class="body-2 text-center">
      <p
        class="mb-0 text-body-1 font-weight-medium"
        :class="$vuetify.breakpoint.mdAndDown ? 'white--text' : ''"
      >
        {{ employeeCode }}
      </p>
    </div>
    <!-- <div v-if="qrFileName" class="d-flex justify-center pb-5 pt-2">
      <v-img
        :src="`${$config.baseURL}portal-administrations/business-cards/${qrFileName}`"
        max-width="85"
        contain
        style="border: 2px #000046 solid"
      ></v-img>
    </div> -->
    <div class="mt-auto">
      <v-divider></v-divider>
      <v-dialog v-model="dialog" width="500">
        <template #activator="{ on, attrs }">
          <div class="d-flex flex-column align-center py-6">
            <v-btn
              v-bind="attrs"
              elevation="0"
              class="text-body-2 text-capitalize"
              :class="$vuetify.breakpoint.mdAndDown ? 'white--text' : ''"
              outlined
              v-on="on"
              @click="dialog = !dialog"
            >
              {{ $t('portalPage.editProfile') }}
            </v-btn>
          </div>
        </template>
        <v-card class="pa-10">
          <!-- <v-form v-model="formIsValid" @submit.prevent="saveProfile">
            <v-file-input
              v-model="profilePic"
              :rules="profileImgRules"
              accept="image/png, image/jpeg, image/jpg"
              prepend-icon="mdi-camera"
              label="Upload a new profile image"
              @change="checkExt(profilePic)"
            ></v-file-input>
            <div class="mt-3">
              <v-btn color="primary" class="px-10 py-0" type="submit"
                >Save</v-btn
              >
            </div>
          </v-form> -->
        </v-card>
      </v-dialog>
    </div>
  </v-card>
</template>

<script>
import { mapState } from 'vuex'

export default {
  data() {
    return {
      dialog: false,
    }
  },
  computed: {
    ...mapState({
      profilePicPath: (state) => state.portal.profilePicPath,
    }),
    employeeCode() {
      const employeeCode = localStorage.getItem('employeeCode')
      return employeeCode
    },
    userFullName() {
      const userFullName = localStorage.getItem('userFullName')
      return userFullName
    },
    userFullNameAr() {
      const userFullNameAr = `${localStorage.getItem(
        'firstNameAr'
      )} ${localStorage.getItem('secondNameAr')}`
      return userFullNameAr
    },
  },
  mounted() {
    this.getUserProfileData()
  },
  methods: {
    async getUserProfileData() {
      try {
        await this.$store.dispatch('portal/getUserProfile', this.employeeCode)
      } catch (error) {
        //
      }
    },
  },
}
</script>

<style>
</style>