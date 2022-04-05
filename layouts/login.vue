<template>
  <v-app>
    <!-- notifications snackbar -->
    <v-snackbar
      v-model="showSnack"
      app
      left
      top
      color="transparent"
      elevation="0"
      timeout="3000"
      :absolute="false"
    >
      <Notification v-for="n in appNotifications" :key="n.id" :current="n" />
    </v-snackbar>

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
import { localize } from 'vee-validate' // to support arabic and english error messages for vee-validate
import { mapState } from 'vuex'

export default {
  data() {
    return {
      showSnack: false,
    }
  },
  computed: {
    ...mapState({
      appNotifications: (state) => state.appNotifications.notifications,
    }),
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
    this.$vuetify.theme.dark = false

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
}
</script>

<style lang="scss">
.v-messages__message {
  color: orange !important;
}
</style>
