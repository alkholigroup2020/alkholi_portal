<template>
  <v-app>
    <h1>Alkholi Portal</h1>
    <v-main>
      <Nuxt />
    </v-main>
  </v-app>
</template>

<script>
export default {
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
