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
          <v-img alt="app-image" contain :src="sp_data.imgURL"></v-img>
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

