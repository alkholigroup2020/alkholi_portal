<template>
  <v-app>
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
    <v-main>
      <nuxt />
    </v-main>
  </v-app>
</template>

<script>
import { mapState } from 'vuex'
import GoToTopButton from '~/components/common/GoToTopButton.vue'

export default {
  components: {
    GoToTopButton,
  },
  data() {
    return {
      showSnack: false,
    }
  },
  computed: {
    ...mapState({
      appNotifications: (state) => state.appNotifications.notifications,
    }),
  },
  watch: {
    appNotifications(newValue) {
      if (newValue) {
        this.showSnack = true
      }
    },
  },
}
</script>
