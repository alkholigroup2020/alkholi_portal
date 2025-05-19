<template>
  <v-app v-if="show">
    <!-- notifications snackbar -->
    <v-snackbar
      v-model="showSnack"
      app
      top
      right
      color="transparent"
      elevation="0"
      timeout="3000"
      :absolute="false"
    >
      <Notification v-for="n in appNotifications" :key="n.id" :current="n" />
    </v-snackbar>

    <!-- Global Go to Top Button -->
    <GoToTopButton />

    <v-navigation-drawer
      v-if="$vuetify.breakpoint.mdAndDown"
      v-model="drawer"
      class="primary"
      app
    >
      <div class="d-flex justify-center" style="height: 62px">
        <v-btn
          color="white"
          depressed
          text
          tile
          height="100%"
          :ripple="false"
          @click="changeColorMode"
        >
          <v-icon>mdi-theme-light-dark</v-icon>
        </v-btn>
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
          >
            <v-icon class="px-2" size="20">mdi-translate</v-icon>
          </v-btn>
        </nuxt-link>
        <v-btn
          color="white"
          depressed
          text
          tile
          height="100%"
          :ripple="false"
          @click="logoff"
        >
          <v-icon>mdi-exit-to-app</v-icon>
        </v-btn>
      </div>

      <v-divider class="py-0 mt-n1 white"></v-divider>

      <userProfile />
    </v-navigation-drawer>

    <!-- portal bar -->
    <v-app-bar app color="primary" flat height="60">
      <v-container fluid class="py-0 fill-height px-xl-16">
        <!-- hamburger icon -->
        <v-app-bar-nav-icon
          v-if="$vuetify.breakpoint.smAndDown"
          class="white--text"
          @click="drawer = !drawer"
        ></v-app-bar-nav-icon>
        <!-- group logo -->
        <div
          style="height: 100%"
          class="d-flex align-center justify-center mt-n1 px-0 px-md-10"
        >
          <v-img
            contain
            max-width="180"
            max-height="80%"
            src="/generalPictures/Alkholi Group White.png"
          ></v-img>
        </div>

        <v-spacer></v-spacer>
        <!-- action buttons -->
        <v-divider
          v-if="$vuetify.breakpoint.mdAndUp"
          vertical
          class="white"
          style="opacity: 0.25"
        ></v-divider>

        <v-btn
          v-if="$vuetify.breakpoint.mdAndUp"
          color="white"
          depressed
          text
          tile
          height="100%"
          :ripple="false"
          @click="changeColorMode"
        >
          <span class="pt-1 text-capitalize">{{
            $t('portalPage.appBar.light')
          }}</span>
          <v-icon>mdi-theme-light-dark</v-icon>
          <span class="pt-1 text-capitalize">{{
            $t('portalPage.appBar.dark')
          }}</span>
        </v-btn>

        <v-divider
          v-if="$vuetify.breakpoint.mdAndUp"
          vertical
          class="white"
          style="opacity: 0.25"
        ></v-divider>

        <div style="height: 100%">
          <nuxt-link
            v-for="locale in availableLocales"
            :key="locale.code"
            class="white--text text-decoration-none"
            :to="switchLocalePath(locale.code)"
          >
            <v-btn
              v-if="$vuetify.breakpoint.mdAndUp"
              color="white"
              class="pt-1"
              depressed
              text
              tile
              height="100%"
              :ripple="false"
            >
              <v-icon class="px-2" size="20">mdi-translate</v-icon>
              <span
                class="text-capitalize"
                :style="$i18n.locale == 'ar' ? 'font-size: 17px' : ''"
              >
                {{ locale.name }}
              </span>
            </v-btn>
          </nuxt-link>
        </div>

        <v-divider
          v-if="$vuetify.breakpoint.mdAndUp"
          vertical
          class="white"
          style="opacity: 0.25"
        ></v-divider>

        <v-btn
          v-if="$vuetify.breakpoint.mdAndUp"
          color="white"
          depressed
          text
          tile
          height="100%"
          :ripple="false"
          @click="logoff"
        >
          <v-icon>mdi-exit-to-app</v-icon>
          <span class="px-2 pt-1 text-capitalize">{{
            $t('portalPage.appBar.logout')
          }}</span>
        </v-btn>
        <v-divider
          v-if="$vuetify.breakpoint.mdAndUp"
          vertical
          class="white"
          style="opacity: 0.25"
        ></v-divider>
      </v-container>
    </v-app-bar>

    <v-main class="mainBG">
      <Nuxt />
    </v-main>

    <v-footer
      class="primary d-flex justify-center align-center pa-0"
      height="22"
      app
    >
      <p
        class="pa-0 ma-0 white--text"
        style="width: fit-content; font-size: 13px"
      >
        Copyright &copy; Alkholi Group {{ getTheCurrentYear }}
      </p>
    </v-footer>
  </v-app>
</template>

<script>
import { mapState } from 'vuex'
import { localize } from 'vee-validate' // to support arabic and english error messages for vee-validate
import GoToTopButton from '~/components/common/GoToTopButton.vue'

export default {
  components: {
    GoToTopButton,
  },
  data() {
    return {
      drawer: false,
      show: false,
      showSnack: false,
    }
  },
  computed: {
    ...mapState({
      appNotifications: (state) => state.appNotifications.notifications,
    }),
    availableLocales() {
      return this.$i18n.locales.filter((i) => i.code !== this.$i18n.locale)
    },
    getTheCurrentYear() {
      return new Date().getFullYear()
    },
  },
  watch: {
    appNotifications(newValue) {
      if (newValue) {
        this.showSnack = true
      }
    },
  },
  created() {
    // watch the lang changes, then change the page direction
    this.$watch(
      '$i18n.locale',
      (newLocale) => {
        if (newLocale === 'ar') {
          localize('ar') // to support arabic and english error messages for vee-validate
          this.$vuetify.rtl = true
        } else {
          localize('en') // to support arabic and english error messages for vee-validate
          this.$vuetify.rtl = false
        }
      },
      { immediate: true }
    )
  },
  mounted() {
    this.$nextTick(async () => {
      this.$nuxt.$loading.start()
      if (this.$nuxt.context.from) {
        if (this.$nuxt.context.from.path !== '/login') {
          await this.reAuthenticate()
        }
      } else {
        await this.reAuthenticate()
      }
      // check the preferred color mode
      setTimeout(() => {
        const colorMode = localStorage.getItem('colorMode')
        if (colorMode === 'dark') {
          this.$vuetify.theme.dark = true
        }
        this.show = true
        this.$nuxt.$loading.finish()
      }, 100)
    })
  },
  methods: {
    async reAuthenticate() {
      try {
        if (process.client) {
          const mail = localStorage.getItem('userMailAddress')
          const userAccount = localStorage.getItem('userAccount')
          const domainName = localStorage.getItem('domainName')
          if (mail && userAccount && domainName) {
            const payload = {
              mail,
              userAccount,
              domainName,
            }
            await this.$store.dispatch('login/reAuthenticate', payload)
          } else {
            this.$router.push(this.localePath('/login'))
          }
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
    async logoff() {
      try {
        this.$nextTick(async () => {
          this.$nuxt.$loading.start()
          if (process.client) {
            const userToken = localStorage.getItem('userToken')
            if (userToken) {
              await this.$store.dispatch('login/logoff', { token: userToken })
              this.$nuxt.$loading.finish()
            } else {
              this.$nuxt.$loading.finish()
            }
          }
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
    changeColorMode() {
      this.$vuetify.theme.dark = !this.$vuetify.theme.dark

      if (this.$vuetify.theme.isDark) {
        localStorage.setItem('colorMode', 'dark')
      } else {
        localStorage.setItem('colorMode', 'light')
      }
    },
  },
}
</script>

<style lang="scss">
.main-div {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 1;
  .the-overlay {
    width: 100%;
    height: 100%;
    position: absolute;
    background-color: black;
    opacity: 0.1;
    z-index: 10;
  }
  .the-image {
    width: 100%;
    height: 100%;
    position: absolute;
    z-index: 5;
    background-color: white;
  }
}
</style>
