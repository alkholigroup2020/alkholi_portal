<template>
  <v-app>
    <v-main>
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
  computed: {
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
}
</script>
