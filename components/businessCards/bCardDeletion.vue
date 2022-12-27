<template>
  <v-dialog v-model="dialog" width="500" persistent>
    <template #activator="{ on, attrs }">
      <v-btn text fab small v-bind="attrs" v-on="on" @click="dialog = true">
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
          class="px-8 mx-2 text-capitalize"
          color="success darken-1"
          text
          @click="deleteBusinessCard()"
        >
          {{ $t('generals.yes') }}
        </v-btn>
        <v-btn
          outlined
          class="px-8 text-capitalize"
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
  layout: 'adminPage',
  props: {
    employee: {
      type: String,
      default: '',
    },
    file: {
      type: String,
      default: '',
    },
    name: {
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
      try {
        this.dialog = false
        this.$nextTick(async () => {
          this.$nuxt.$loading.start()
          await this.$store.dispatch('businessCards/deleteBusinessCard', {
            code: this.employee,
            file: this.file,
            name: this.name,
          })
          // notify the parent to update the generated cards list
          this.$emit('updateCards')
          this.$nuxt.$loading.finish()
        })
      } catch (e) {
        const error = e.toString()
        const newErrorString = error.replaceAll('Error: ', '')
        const notification = {
          type: 'error',
          message: newErrorString,
        }
        await this.$store.dispatch(
          'appNotifications/addNotification',
          notification
        )
      }
    },
  },
}
</script>

<style>
</style>