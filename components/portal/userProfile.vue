<template>
  <v-card
    elevation="0"
    rounded="lg"
    color="transparent"
    class="d-flex flex-column"
    height="50vh"
  >
    <div class="d-flex justify-center pb-5 pt-8">
      <v-avatar
        :size="$vuetify.breakpoint.smAndDown ? '140' : '160'"
        height="170"
        style="border-radius: 10px !important"
        tile
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
        :class="$vuetify.breakpoint.smAndDown ? 'white--text' : ''"
      >
        {{ userFullName }}
      </p>
      <p
        v-else
        class="mb-1 text-body-1 font-weight-medium"
        :class="$vuetify.breakpoint.smAndDown ? 'white--text' : ''"
      >
        {{ userFullNameAr }}
      </p>
    </div>
    <div class="body-2 text-center">
      <p
        class="mb-0 text-body-1 font-weight-medium"
        :class="$vuetify.breakpoint.smAndDown ? 'white--text' : ''"
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
              :class="$vuetify.breakpoint.smAndDown ? 'white--text' : ''"
              outlined
              v-on="on"
              @click="dialog = !dialog"
            >
              {{ $t('portalPage.editProfile.edit') }}
            </v-btn>
          </div>
        </template>
        <v-card class="pa-10" color="secondaryBG">
          <ValidationObserver v-slot="{ invalid }">
            <v-form @submit.prevent="saveUserProfile">
              <ValidationProvider
                v-slot="{ errors }"
                rules="size:5120|required|image"
              >
                <v-file-input
                  v-model="profilePic"
                  :color="$vuetify.theme.dark ? 'white' : ''"
                  :error-messages="errors"
                  accept="image/png, image/jpeg, image/jpg"
                  prepend-icon="mdi-camera"
                  :label="$t('portalPage.editProfile.label')"
                ></v-file-input>
              </ValidationProvider>
              <v-btn
                :disabled="invalid"
                color="primary"
                class="px-8 py-0 mt-5 text-capitalize"
                type="submit"
                >{{ $t('portalPage.editProfile.submit') }}</v-btn
              >
            </v-form>
          </ValidationObserver>
        </v-card>
      </v-dialog>
    </div>
  </v-card>
</template>

<script>
import { mapState } from 'vuex'
import { extend, localize } from 'vee-validate'
import { required, image, size } from 'vee-validate/dist/rules'

// Override the default message.
extend('required', {
  ...required,
})
extend('image', {
  ...image,
})
extend('size', {
  ...size,
})

localize({
  en: {
    messages: {
      required: 'This field is required!',
      image: 'Should be an image file!',
      size: "File size shouldn't exceed 5MB!",
    },
  },
  ar: {
    messages: {
      required: 'هــذا الحــقل مطــلوب!',
      image: 'يجب أن يكون نوع الملف، صورة!',
      size: 'حجم الملف يجب أن يكون أقل من 5 ميجا بايت!',
    },
  },
})
export default {
  data() {
    return {
      dialog: false,
      profilePic: null,
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

  methods: {
    async saveUserProfile() {
      const employeeCode = localStorage.getItem('employeeCode')

      const profileData = {
        img: this.profilePic,
        eCode: employeeCode,
      }

      await this.$store.dispatch('portal/saveUserProfile', profileData)
      await this.$store.dispatch('portal/getUserProfile')

      this.profilePic = null
      this.dialog = false
    },
  },
}
</script>
