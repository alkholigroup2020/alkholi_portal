<template>
  <v-row justify="center" align="center">
    <v-col cols="12">
      <div class="text-h4">
        <nuxt-link
          v-for="locale in availableLocales"
          :key="locale.code"
          :to="switchLocalePath(locale.code)"
          >{{ locale.name }}</nuxt-link
        >
      </div>
    </v-col>
    <v-col cols="12" sm="8" md="6">
      <div>
        <h1>{{ $t('welcome') }}</h1>
      </div>
    </v-col>
  </v-row>
</template>

<script>
export default {
  computed: {
    availableLocales() {
      return this.$i18n.locales.filter((i) => i.code !== this.$i18n.locale)
    },
  },
}
</script>

<style>
</style>
