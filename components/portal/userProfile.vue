<template>
  <v-card
    elevation="0"
    rounded="lg"
    color="transparent"
    class="d-flex flex-column"
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
    <div class="body-2 text-center mb-1">
      <p
        class="mb-0 text-body-1 font-weight-medium"
        :class="$vuetify.breakpoint.smAndDown ? 'white--text' : ''"
      >
        {{ employeeCode }}
      </p>
    </div>
    <div v-if="qrFileName" class="d-flex justify-center mt-3 mb-5">
      <a
        :href="localePath(`/business-card/${employeeCode}`)"
        target="_blank"
      >
        <v-img
          :src="`${$config.baseURL}/business-cards-api/business-cards/${qrFileName}`"
          class="cursor-pointer"
          max-width="110"
          contain
          style="border: 2px #000046 solid"
        ></v-img>
      </a>
    </div>
    <div class="mt-auto">
      <v-divider :class="$vuetify.theme.dark ? 'secondary' : ''"></v-divider>
      <v-dialog v-model="profileDialog" width="500">
        <template #activator="{ on, attrs }">
          <div class="d-flex flex-column align-center py-6">
            <v-btn
              v-bind="attrs"
              elevation="0"
              class="text-body-2 text-capitalize"
              :class="$vuetify.breakpoint.smAndDown ? 'white--text' : ''"
              outlined
              v-on="on"
              @click="profileDialog = !profileDialog"
            >
              {{ $t('portalPage.editProfile.edit') }}
            </v-btn>
          </div>
        </template>
        <v-card class="pa-10" color="secondaryBG">
          <ValidationObserver>
            <v-form @submit.prevent="saveUserProfile">
              <ValidationProvider
                v-slot="{ errors, validate, valid }"
                rules="image|size:5120|required"
              >
                <v-file-input
                  v-model="profilePic"
                  :color="$vuetify.theme.dark ? 'white' : 'primary'"
                  :error-messages="errors[0]"
                  accept="image/png, image/jpeg, image/jpg"
                  prepend-icon="mdi-camera"
                  type="file"
                  :label="$t('portalPage.editProfile.label')"
                  @input="validate"
                ></v-file-input>
                <v-btn
                  :disabled="!valid"
                  color="primary"
                  class="px-8 py-0 mt-3 text-capitalize"
                  type="submit"
                  >{{ $t('portalPage.editProfile.submit') }}</v-btn
                >
              </ValidationProvider>
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
import { image, size, required } from 'vee-validate/dist/rules'
import { authErrorMessage } from '~/utils/auth-client'

// Override the default message.
extend('image', {
  ...image,
})
extend('size', {
  ...size,
})
extend('required', {
  ...required,
})

localize({
  en: {
    messages: {
      image: 'Should be an image file!',
      size: "File size shouldn't exceed 5MB!",
      required: 'This field is required!',
    },
  },
  ar: {
    messages: {
      image: 'يجب أن يكون نوع الملف، صورة!',
      size: 'حجم الملف يجب أن يكون أقل من 5 ميجا بايت!',
      required: 'هــذا حــقل مطــلوب!',
    },
  },
})

export default {
  data() {
    return {
      profileDialog: false,
      profilePic: null,
      qrFileName: null,
      cardRequestId: 0,
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
    this.checkQR()
  },

  beforeDestroy() {
    this.cardRequestId++
  },

  methods: {
    async saveUserProfile() {
      const saved = await this.$store.dispatch(
        'portal/saveUserProfile',
        this.profilePic
      )
      if (saved) await this.$store.dispatch('portal/getUserProfile')

      this.profilePic = null
      this.profileDialog = false
    },

    async checkQR() {
      const token = localStorage.getItem('userToken')
      if (!token) return
      const requestId = ++this.cardRequestId
      try {
        const response = await this.$axios.get(
          `${this.$config.baseURL}/portal-api/my-business-card`
        )
        if (
          requestId !== this.cardRequestId ||
          token !== localStorage.getItem('userToken')
        )
          return
        this.qrFileName = response.data.hasCard
          ? response.data.qrCodePath
          : null
      } catch (error) {
        if (
          requestId !== this.cardRequestId ||
          token !== localStorage.getItem('userToken')
        )
          return
        const notification = {
          type: 'error',
          message: authErrorMessage(this.$store, error, 'portal'),
        }
        await this.$store.dispatch(
          'appNotifications/addNotification',
          notification
        )
        if (error && error.response && error.response.status === 401)
          await this.$store.dispatch('login/logoff')
      }
    },
  },
}
</script>
