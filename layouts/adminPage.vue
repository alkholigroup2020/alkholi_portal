<template>
  <v-app v-if="show">
    <!-- notifications snackbar -->
    <v-snackbar
      v-model="showSnack"
      app
      right
      timeout="3000"
      top
      color="transparent"
      elevation="0"
    >
      <Notification v-for="n in appNotifications" :key="n.id" :current="n" />
    </v-snackbar>

    <v-navigation-drawer
      v-model="drawer"
      :right="$i18n.locale === 'ar'"
      class="mainBG"
      app
    >
      <div class="d-flex flex-column" style="height: 100%">
        <!-- on small size screens -->
        <div
          v-if="$vuetify.breakpoint.mdAndDown"
          class="d-flex justify-center"
          style="height: 55px"
        >
          <nuxt-link :to="localePath(`/`)" class="text-decoration-none">
            <v-btn depressed text tile height="100%" :ripple="false">
              <v-icon>mdi-monitor-dashboard</v-icon>
            </v-btn>
          </nuxt-link>
          <v-btn
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

        <!-- group logo -->
        <div
          v-if="!$vuetify.breakpoint.mdAndDown"
          class="d-flex align-center justify-center pt-4"
        >
          <v-img
            max-width="170"
            contain
            :src="
              $vuetify.theme.dark
                ? '/generalPictures/Alkholi Group White.png'
                : '/generalPictures/companyLogo-T.png'
            "
          ></v-img>
        </div>

        <!-- profile picture -->
        <div class="d-flex justify-center py-8">
          <v-avatar
            height="150"
            :size="$vuetify.breakpoint.smAndDown ? '120' : '140'"
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

        <v-divider class="mt-1"></v-divider>

        <!-- application pages -->
        <v-list class="py-0 my-0">
          <v-list-item
            nuxt
            :to="localePath('/administration')"
            exact
            class="py-3"
          >
            <v-list-item-action>
              <v-icon>mdi-account-cog</v-icon>
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title class="primaryText--text">
                {{ $t('adminPage.layout.tab1') }}
              </v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </v-list>

        <!-- footer -->
        <div class="mt-auto">
          <v-divider class="py-0 my-0"></v-divider>
          <div
            class="d-flex justify-center align-center"
            style="height: 50px !important"
          >
            <p
              style="width: fit-content"
              class="primaryText--text pa-0 ma-0 text-subtitle-2"
            >
              Copyright &copy; Alkholi Group {{ getTheCurrentYear }}
            </p>
          </div>
        </div>
      </div>
    </v-navigation-drawer>

    <v-app-bar app color="primary" flat height="60">
      <v-container fluid class="py-0 fill-height px-xl-16">
        <!-- hamburger icon -->
        <v-app-bar-nav-icon
          v-if="$vuetify.breakpoint.mdAndDown"
          class="white--text"
          @click="drawer = !drawer"
        ></v-app-bar-nav-icon>

        <v-spacer></v-spacer>

        <!-- action buttons -->
        <v-divider
          v-if="$vuetify.breakpoint.lgAndUp"
          vertical
          class="white"
          style="opacity: 0.25"
        ></v-divider>

        <div style="height: 100%">
          <nuxt-link :to="localePath(`/`)">
            <v-btn
              v-if="$vuetify.breakpoint.lgAndUp"
              color="white"
              depressed
              text
              tile
              height="100%"
              :ripple="false"
            >
              <v-icon>mdi-monitor-dashboard</v-icon>
              <span class="px-2 pt-1 text-capitalize">{{
                $t('portalPage.appBar.dashboard')
              }}</span>
            </v-btn>
          </nuxt-link>
        </div>

        <v-divider
          v-if="$vuetify.breakpoint.lgAndUp"
          vertical
          class="white"
          style="opacity: 0.25"
        ></v-divider>

        <v-btn
          v-if="$vuetify.breakpoint.lgAndUp"
          color="white"
          depressed
          text
          tile
          height="100%"
          :ripple="false"
          @click="changeColorMode"
        >
          <span class="px-2 pt-1 text-capitalize">{{
            $t('portalPage.appBar.light')
          }}</span>
          <v-icon>mdi-theme-light-dark</v-icon>
          <span class="px-2 pt-1 text-capitalize">{{
            $t('portalPage.appBar.dark')
          }}</span>
        </v-btn>

        <v-divider
          v-if="$vuetify.breakpoint.lgAndUp"
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
              v-if="$vuetify.breakpoint.lgAndUp"
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
          v-if="$vuetify.breakpoint.lgAndUp"
          vertical
          class="white"
          style="opacity: 0.25"
        ></v-divider>

        <v-btn
          v-if="$vuetify.breakpoint.lgAndUp"
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
          v-if="$vuetify.breakpoint.lgAndUp"
          vertical
          class="white"
          style="opacity: 0.25"
        ></v-divider>
      </v-container>
    </v-app-bar>

    <v-main class="secondaryBG">
      <Nuxt />
    </v-main>
  </v-app>
</template>

<script>
import { mapState } from 'vuex'

export default {
  data() {
    return {
      showSnack: false,
      drawer: null,
      show: false,
      profilePicPath: '',
    }
  },

  computed: {
    ...mapState({
      appNotifications: (state) => state.appNotifications.notifications,
      isPortalAdmin: (state) => state.portal.isPortalAdmin,
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
  mounted() {
    this.$nextTick(async () => {
      this.$nuxt.$loading.start()
      await this.reAuthenticate()
      // check the preferred color mode and the profile picture path
      setTimeout(() => {
        const colorMode = localStorage.getItem('colorMode')
        if (colorMode === 'dark') {
          this.$vuetify.theme.dark = true
        }
        const profilePicPath = localStorage.getItem('profilePicPath')
        this.profilePicPath = profilePicPath
        this.show = true
        this.$nuxt.$loading.finish()
      }, 100)
    })
  },
  created() {
    // this.reAuthenticate()

    // watch the lang changes, then change the page direction
    this.$watch(
      '$i18n.locale',
      (newLocale) => {
        if (newLocale === 'ar') {
          // localize('ar') // to support arabic and english error messages for vee-validate
          this.$vuetify.rtl = true
        } else {
          // localize('en') // to support arabic and english error messages for vee-validate
          this.$vuetify.rtl = false
        }
      },
      { immediate: true }
    )
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
            // check authorization
            if (!this.isPortalAdmin) {
              this.$router.push(this.localePath('/'))
            }
          } else {
            this.$router.push('/login')
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

<style>
</style>