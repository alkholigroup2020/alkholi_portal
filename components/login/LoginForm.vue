<template>
  <!-- animation101 -->
  <v-card
    :max-width="$vuetify.breakpoint.mdAndUp ? '400' : '320'"
    color="#000046"
    elevation="5"
    rounded
    light
  >
    <v-container>
      <ValidationObserver v-slot="{ invalid }">
        <v-form @submit.prevent="loginUser">
          <!-- language switcher -->
          <v-row>
            <v-col cols="12" class="d-flex justify-center">
              <nuxt-link
                v-for="locale in availableLocales"
                :key="locale.code"
                class="white--text text-decoration-none"
                :to="switchLocalePath(locale.code)"
              >
                <v-btn
                  color="white"
                  class="pt-1"
                  depressed
                  text
                  tile
                  height="100%"
                  :ripple="false"
                  plain
                >
                  <span style="font-size: 14px" class="text-capitalize">{{
                    locale.name
                  }}</span>
                  <v-icon class="px-2" size="20">mdi-web</v-icon>
                </v-btn>
              </nuxt-link>
            </v-col>
          </v-row>

          <!-- Title -->
          <v-row>
            <v-col cols="12">
              <h2
                class="text-center py-3 py-md-5 text-h4"
                style="color: #f1e9ec !important"
              >
                {{ $t('loginForm.title') }}
              </h2>
            </v-col>
          </v-row>

          <!-- Input Fields -->
          <v-row class="text-caption text-md-body-2">
            <v-col offset="1" cols="10" class="py-0">
              <p class="my-0 py-0" style="color: #f1e9ec !important">
                {{ $t('loginForm.userName') }}
              </p>
              <ValidationProvider v-slot="{ errors }" rules="required">
                <v-text-field
                  v-model="userAccount"
                  class="pt-0 pb-1 inputColor"
                  background-color="#f1e9ec"
                  height="35"
                  required
                  rounded
                  autocomplete
                  :error-messages="errors[0]"
                ></v-text-field>
              </ValidationProvider>
            </v-col>
            <v-col offset="1" cols="10" class="py-0">
              <p class="my-0 py-0" style="color: #f1e9ec !important">
                {{ $t('loginForm.domainName') }}
              </p>
              <ValidationProvider v-slot="{ errors }" rules="required">
                <v-autocomplete
                  v-model="domain"
                  class="pt-0 pb-1 inputColor"
                  :items="domains"
                  required
                  rounded
                  background-color="#f1e9ec"
                  height="35"
                  :error-messages="errors"
                ></v-autocomplete>
              </ValidationProvider>
            </v-col>
            <v-col offset="1" cols="10" class="py-0">
              <p class="my-0 py-0" style="color: #f1e9ec !important">
                {{ $t('loginForm.password') }}
              </p>
              <ValidationProvider v-slot="{ errors }" rules="required">
                <v-text-field
                  v-model="userPassword"
                  class="pt-0 pb-1 inputColor"
                  background-color="#f1e9ec"
                  height="35"
                  type="password"
                  required
                  rounded
                  autocomplete
                  :error-messages="errors"
                ></v-text-field>
              </ValidationProvider>
            </v-col>
          </v-row>

          <!-- Login BTN -->
          <v-row class="pt-1 pt-md-3 pb-3 pb-md-10">
            <v-col offset="3" cols="6" class="d-flex justify-center">
              <v-btn
                v-if="!invalid"
                width="85%"
                type="submit"
                color="#f1e9ec"
                rounded
                class="
                  py-2 py-md-3
                  primary--text
                  text-subtitle-1 text-capitalize
                "
                >{{ $t('loginForm.submitBTN') }}</v-btn
              >
            </v-col>
          </v-row>
        </v-form>
      </ValidationObserver>
    </v-container>
  </v-card>
</template>

<script>
import { extend, localize } from 'vee-validate'
import { required } from 'vee-validate/dist/rules'

extend('required', {
  ...required,
})

localize({
  en: {
    messages: {
      required: 'This field is required!',
    },
  },
  ar: {
    messages: {
      required: 'هــذا حــقل مطــلوب!',
    },
  },
})

// import { gsap } from 'gsap'

export default {
  data() {
    return {
      userAccount: '',
      userPassword: '',
      showError: false,
      showPlainError: false,
      domain: '',
      domains: ['Alkholi', 'Buildingtek', 'Amos-sa', 'Upmoc'],
    }
  },

  computed: {
    availableLocales() {
      return this.$i18n.locales.filter((i) => i.code !== this.$i18n.locale)
    },
  },
  mounted() {
    // gsap.from('.animation101', {
    //   opacity: 0,
    //   x: 100,
    //   delay: 1.5,
    //   duration: 1,
    // })
  },

  methods: {
    srvName() {
      if (this.domain === 'Alkholi') {
        return '10.10.10.11'
      } else if (this.domain === 'Buildingtek') {
        return '10.11.10.11'
      } else if (this.domain === 'Upmoc') {
        return '10.12.10.11'
      } else if (this.domain === 'Amos-sa') {
        return '10.13.10.11'
      }
    },
    loginUser() {
      this.$nextTick(async () => {
        this.$nuxt.$loading.start()
        const userInfo = {
          userAccount: this.userAccount.toLowerCase(),
          password: this.userPassword,
          domain: this.domain.toLowerCase(),
          dc_ip: this.srvName(),
        }
        await this.$store.dispatch('login/logInUser', userInfo)
        this.$nuxt.$loading.finish()
      })
    },
  },
}
</script>




