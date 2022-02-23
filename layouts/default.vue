<template>
  <v-app v-if="show">
    <v-navigation-drawer
      v-if="$vuetify.breakpoint.mdAndDown"
      v-model="drawer"
      class="primary"
      app
    >
      <div class="d-flex justify-center" style="height: 60px">
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

        <v-btn color="white" depressed text tile height="100%" :ripple="false">
          <v-icon>mdi-exit-to-app</v-icon>
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
            <v-icon class="px-2" size="20">mdi-web</v-icon>
          </v-btn>
        </nuxt-link>
      </div>
      <v-divider class="py-0 mt-n1 white"></v-divider>
      <div class="d-flex justify-center py-5">
        <!-- <v-avatar size="100">
          <v-img
            :src="`${profilePicPath}`"
            alt="Profile Image"
            position="top center"
          ></v-img>
        </v-avatar> -->
      </div>
      <div class="text-subtitle-1 white--text text-center">
        <p class="mb-0">userFullName</p>
      </div>
      <div class="text-subtitle-1 white--text text-center">
        <p class="mb-0">employeeFileNumber</p>
      </div>
      <!-- <div v-if="qrFileName" class="d-flex justify-center pb-5 pt-2">
        <v-img
          :src="`${$config.baseURL}portal-administrations/business-cards/${qrFileName}`"
          max-width="70"
          contain
        ></v-img>
      </div> -->
      <v-divider></v-divider>
      <!-- <v-dialog v-model="dialog" width="500">
        <template #activator="{ on, attrs }">
          <div class="d-flex flex-column align-center py-6">
            <v-btn
              v-bind="attrs"
              elevation="0"
              class="text-subtitle-2 text-capitalize"
              color="primary_8"
              small
              v-on="on"
              @click="dialog = !dialog"
            >
              Edit Your Profile
            </v-btn>
          </div>
        </template>
        <v-card class="pa-10">
          <v-form v-model="formIsValid" @submit.prevent="saveProfile">
            <v-file-input
              v-model="profilePic"
              :rules="profileImgRules"
              accept="image/png, image/jpeg, image/jpg"
              prepend-icon="mdi-camera"
              label="Upload a new profile image"
              @change="checkExt(profilePic)"
            ></v-file-input>
            <div class="mt-3">
              <v-btn color="primary" class="px-8 py-0" type="submit"
                >Save</v-btn
              >
            </div>
          </v-form>
        </v-card>
      </v-dialog> -->
    </v-navigation-drawer>

    <!-- portal bar -->
    <v-app-bar app color="primary" flat>
      <v-container class="py-0 fill-height">
        <!-- hamburger icon -->
        <v-app-bar-nav-icon
          v-if="$vuetify.breakpoint.smAndDown"
          class="white--text"
          @click="drawer = !drawer"
        ></v-app-bar-nav-icon>
        <!-- group logo -->
        <div
          style="height: 100%"
          class="d-flex align-center justify-center px-0 px-md-11"
        >
          <v-img
            contain
            max-width="180"
            max-height="66%"
            src="/generalPictures/Alkholi Group White.png"
          ></v-img>
        </div>

        <v-spacer></v-spacer>
        <!-- action buttons -->
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
          <span class="px-2 pt-1 text-capitalize">{{
            $t('portalPage.appBar.light')
          }}</span>
          <v-icon>mdi-theme-light-dark</v-icon>
          <span class="px-2 pt-1 text-capitalize">{{
            $t('portalPage.appBar.dark')
          }}</span>
        </v-btn>

        <v-btn
          v-if="$vuetify.breakpoint.mdAndUp"
          color="white"
          depressed
          text
          tile
          height="100%"
          :ripple="false"
        >
          <v-icon>mdi-exit-to-app</v-icon>
          <span class="px-2 pt-1 text-capitalize">{{
            $t('portalPage.appBar.logout')
          }}</span>
        </v-btn>

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
              <v-icon class="px-2" size="20">mdi-web</v-icon>
              <span
                class="text-capitalize"
                :style="$i18n.locale == 'ar' ? 'font-size: 17px' : ''"
              >
                {{ locale.name }}
              </span>
            </v-btn>
          </nuxt-link>
        </div>
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
export default {
  data() {
    return {
      drawer: false,
      show: false,
    }
  },
  computed: {
    availableLocales() {
      return this.$i18n.locales.filter((i) => i.code !== this.$i18n.locale)
    },
    getTheCurrentYear() {
      return new Date().getFullYear()
    },
  },
  created() {
    // watch the lang changes, then change the page direction
    this.$watch(
      '$i18n.locale',
      (newLocale) => {
        if (newLocale === 'ar') {
          this.$vuetify.rtl = true
        } else {
          this.$vuetify.rtl = false
        }
      },
      { immediate: true }
    )
  },
  mounted() {
    this.$nextTick(() => {
      this.$nuxt.$loading.start()
      // check the preferred color mode
      setTimeout(() => {
        const colorMode = localStorage.getItem('colorMode')
        if (colorMode === 'dark') {
          this.$vuetify.theme.dark = true
        }
        this.show = true
        this.$nuxt.$loading.finish()
      }, 10)
    })
  },
  methods: {
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

