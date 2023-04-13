<template>
  <div>
    <v-alert
      v-model="showNotification"
      border="left"
      :color="current.type"
      dense
      :type="current.type"
    >
      {{ current.message }}
    </v-alert>
  </div>
</template>

<script>
export default {
  props: {
    current: {
      type: Object,
      require: true,
      default: () => {
        return {}
      },
    },
  },

  data() {
    return {
      showNotification: false,
    }
  },
  mounted() {
    this.showNotification = true
    setTimeout(() => {
      this.$store.dispatch('appNotifications/removeNotification', this.current)
    }, 3000)
  },
}
</script>
