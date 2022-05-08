<template>
  <div class="d-flex flex-column align-center">
    <a :href="sp_data.url" target="_blank" class="text-decoration-none">
      <v-avatar
        :size="$vuetify.breakpoint.mdAndUp ? '120' : '90'"
        class="mb-2 main-div"
        color="white"
      >
        <div v-if="$vuetify.theme.dark" class="the-overlay"></div>
        <div class="the-image">
          <v-img alt="app-image" :src="sp_data.imgURL"></v-img>
        </div>
      </v-avatar>
    </a>
    <h5 class="text-body-2 text-md-body-1 text-center">{{ sp_data.title }}</h5>
  </div>
</template>

<script>
export default {
  props: {
    // eslint-disable-next-line vue/prop-name-casing
    sp_data: {
      type: Object,
      default: () => {
        return {}
      },
    },
  },
}
</script>


<style lang="scss" scoped>
.main-div {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 1;
  .the-overlay {
    width: 100%;
    height: 100%;
    position: absolute;
    background-color: black;
    opacity: 0.1;
    z-index: 10;
  }
  .the-image {
    width: 100%;
    height: 100%;
    position: absolute;
    z-index: 5;
  }
}
</style>
