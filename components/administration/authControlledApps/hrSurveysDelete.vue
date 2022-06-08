<template>
  <v-dialog v-model="dialog" width="500" persistent>
    <template #activator="{ on, attrs }">
      <v-btn text fab small v-bind="attrs" v-on="on" @click="dialog = true">
        <v-icon small color="error">mdi-delete</v-icon>
      </v-btn>
    </template>

    <v-card>
      <v-card-title class="text-subtitle-1 primary_5">
        {{ $t('adminPage.hrSurveys.confirmationTitle') }}
      </v-card-title>

      <v-card-text class="pb-0">
        <p class="text-subtitle-1 pt-3 pb-8 mb-0 text-center">
          {{ $t('adminPage.hrSurveys.confirmationMessage') }}
        </p>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="error darken-1" text @click="dialog = false">
          {{ $t('generals.no') }}
        </v-btn>
        <v-btn color="success darken-1" text @click="deleteHRSurveyUser()">
          {{ $t('generals.yes') }}
        </v-btn>
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
  },
  data() {
    return {
      dialog: false,
    }
  },
  methods: {
    async deleteHRSurveyUser() {
      try {
        this.dialog = false
        this.$nextTick(async () => {
          this.$nuxt.$loading.start()
          await this.$store.dispatch(
            'administration/hrSurveys/deleteHRSurveyUser',
            { code: this.employee }
          )
          await this.$store.dispatch(
            'administration/hrSurveys/getHRSurveyUsers'
          )
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