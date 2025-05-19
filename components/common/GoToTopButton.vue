<template>
  <v-fade-transition>
    <v-btn
      v-show="showButton"
      fab
      :color="$vuetify.theme.dark ? 'white' : 'primary'"
      fixed
      bottom
      right
      :class="
        $i18n.locale === 'ar' ? 'go-to-top-button-ar' : 'go-to-top-button-en'
      "
      @click="scrollToTop"
    >
      <v-icon :color="$vuetify.theme.dark ? 'primary' : 'white'"
        >mdi-arrow-up</v-icon
      >
    </v-btn>
  </v-fade-transition>
</template>

<script>
export default {
  data() {
    return {
      showButton: false,
      scrollThreshold: 300, // Show button after scrolling this many pixels
    }
  },
  mounted() {
    window.addEventListener('scroll', this.handleScroll)
  },
  beforeDestroy() {
    window.removeEventListener('scroll', this.handleScroll)
  },
  methods: {
    handleScroll() {
      this.showButton = window.pageYOffset > this.scrollThreshold
    },
    scrollToTop() {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    },
  },
}
</script>

<style scoped>
.go-to-top-button-en {
  bottom: 20px;
  right: 20px;
  z-index: 10;
}

.go-to-top-button-ar {
  bottom: 20px;
  left: 20px;
  z-index: 10;
}
</style>
