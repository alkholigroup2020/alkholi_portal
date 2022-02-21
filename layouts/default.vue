<template>
  <v-app>
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
          plain
          height="100%"
          :ripple="false"
        >
          <span class="px-2 pt-1 text-capitalize">Dark</span>
          <v-icon>mdi-theme-light-dark</v-icon>
          <span class="px-2 pt-1 text-capitalize">Light</span>
        </v-btn>

        <v-btn
          v-if="$vuetify.breakpoint.mdAndUp"
          color="white"
          depressed
          text
          tile
          plain
          height="100%"
          :ripple="false"
        >
          <v-icon>mdi-exit-to-app</v-icon>
          <span class="px-2 pt-1 text-capitalize">Logout</span>
        </v-btn>

        <v-btn
          v-if="$vuetify.breakpoint.mdAndUp"
          color="white "
          depressed
          text
          tile
          plain
          height="100%"
          :ripple="false"
          nuxt
        >
          <v-icon class="px-2" size="18">mdi-web</v-icon>
          <div class="text-h4 text-body-1 pt-1">
            <nuxt-link
              v-for="locale in availableLocales"
              :key="locale.code"
              class="white--text text-decoration-none text-capitalize"
              :to="switchLocalePath(locale.code)"
              >{{ locale.name }}
            </nuxt-link>
          </div>
        </v-btn>
      </v-container>
    </v-app-bar>

    <v-main>
      <Nuxt />
    </v-main>
  </v-app>
</template>

<script>
export default {
  data() {
    return {
      drawer: false,
    }
  },
  computed: {
    availableLocales() {
      return this.$i18n.locales.filter((i) => i.code !== this.$i18n.locale)
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
}
</script>

<style lang="scss" scoped>
</style>
