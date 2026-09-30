<template>
  <v-dialog v-model="dialog" width="500" persistent>
    <template #activator="{ on, attrs }">
      <v-btn
        text
        fab
        small
        class="cursor-pointer"
        v-bind="attrs"
        v-on="on"
        @click="dialog = true"
      >
        <v-icon small color="error">mdi-delete</v-icon>
      </v-btn>
    </template>

    <v-card>
      <v-card-title class="text-subtitle-1 primary_5">
        {{ $t('businessCards.generatedCards.confirmationTitle') }}
      </v-card-title>

      <v-card-text class="pb-0">
        <p
          class="text-subtitle-1 font-weight-medium pt-3 pb-8 mb-0 text-center"
        >
          {{ $t('businessCards.generatedCards.confirmationMessage') }}
        </p>
      </v-card-text>

      <v-card-actions class="pb-10">
        <v-spacer></v-spacer>

        <v-btn
          outlined
          class="px-8 mx-2 text-capitalize cursor-pointer"
          color="success darken-1"
          text
          @click="deleteBusinessCard()"
        >
          {{ $t('generals.yes') }}
        </v-btn>
        <v-btn
          outlined
          class="px-8 text-capitalize cursor-pointer"
          color="error darken-1"
          text
          @click="dialog = false"
        >
          {{ $t('generals.no') }}
        </v-btn>
        <v-spacer></v-spacer>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  props: {
    employee: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      dialog: false,
    }
  },
  methods: {
    async deleteBusinessCard() {
      this.dialog = false
      this.$nuxt.$loading.start()
      try {
        // The server identifies the acting administrator from the session.
        await this.$store.dispatch('businessCards/deleteBusinessCard', {
          code: this.employee,
        })
        // refresh even after a failure: the card may already be gone
        this.$emit('updateCards')
      } finally {
        this.$nuxt.$loading.finish()
      }
    },
  },
}
</script>

<style>
</style>