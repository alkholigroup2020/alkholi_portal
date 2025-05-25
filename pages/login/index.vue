<template>
  <v-container v-if="show" fluid class="loginBG">
    <v-row
      align="center"
      class="pt-10 pt-md-0"
      :style="$vuetify.breakpoint.mdAndUp ? 'height: 100%' : ''"
    >
      <v-col cols="12" md="6" order="2" order-md="1">
        <div class="d-flex flex-column align-center">
          <LoginForm />
        </div>
      </v-col>
      <v-col style="height: 45%" cols="12" md="6" order="1" order-md="2">
        <div class="d-flex flex-column align-center align-md-start">
          <v-img width="50%" src="/generalPictures/companyLogo-T.png"></v-img>
          <p class="custom-width primary--text text-h5 text-md-h4 mt-3">
            {{ $t('loginForm.portalTitle') }}
          </p>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  layout: 'login',

  data() {
    return {
      show: false,
    }
  },

  mounted() {
    this.$nextTick(() => {
      this.$nuxt.$loading.start()
      setTimeout(() => {
        this.show = true
        this.$nuxt.$loading.finish()
      }, 750)
    })
  },
}
</script>

<style lang="scss" scoped>
.loginBG {
  background-image: url('/generalPictures/loginBG.jpg');
  background-position: right bottom;
  background-repeat: none;
  background-size: cover;
  height: 100%;
}
.custom-width {
  width: 50%;
  text-align: center;
}
@media screen and (max-width: 1225px) {
  .custom-width {
    width: 100%;
    text-align: left;
  }
}
@media screen and (max-width: 960px) {
  .custom-width {
    text-align: center;
  }
}
</style>
