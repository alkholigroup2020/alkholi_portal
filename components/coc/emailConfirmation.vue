<template>
  <v-dialog v-model="emailDialog" width="500" persistent>
    <template #activator="{ on, attrs }">
      <v-btn
        v-bind="attrs"
        rounded
        fab
        small
        text
        class="mx-1 py-0 px-0 text-capitalize"
        v-on="on"
        @click.prevent="emailDialog = true"
      >
        <v-icon>mdi-email-arrow-left</v-icon>
      </v-btn>
    </template>

    <v-card :class="$vuetify.theme.dark ? 'primary' : ''">
      <v-card-title class="text-subtitle-1 primary_5">
        {{ $t('codeOfConduct.employeesList.emailConfirmationTitle') }}
      </v-card-title>
      <v-divider></v-divider>
      <v-card-text class="pb-0">
        <p class="text-subtitle-1 font-weight-medium py-8 mb-0 text-center">
          {{ $t('codeOfConduct.employeesList.emailConfirmationMessage') }}
        </p>
      </v-card-text>

      <v-card-actions class="pb-10">
        <v-spacer></v-spacer>

        <v-btn
          outlined
          class="px-8 mx-2 text-capitalize"
          color="success darken-1"
          @click.prevent="sendEmail(email, name)"
        >
          {{ $t('generals.yes') }}
        </v-btn>
        <v-btn
          outlined
          class="px-8 text-capitalize"
          color="error darken-1"
          @click="emailDialog = false"
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
    email: {
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
      emailDialog: false,
    }
  },
  methods: {
    async sendEmail(email, name) {
      try {
        // notify that the sending process starts
        this.$emit('sending')
        this.emailDialog = false
        const response = await this.$axios.post(
          `${this.$config.baseURL}/coc-api/send-single-email`,
          {
            email,
            name,
          }
        )
        if (response.status === 200) {
          // notify that the sending process ends
          this.$emit('sent')
          this.$store.dispatch('appNotifications/addNotification', {
            type: 'success',
            message: 'Email sent successfully',
          })
        }
      } catch (error) {
        // notify that the sending process didn't go well
        this.$emit('error')
        this.$store.dispatch('appNotifications/addNotification', {
          type: 'error',
          message: error.response?.data?.message || 'Email sending failed',
        })
      }
    },
  },
}
</script>

<style></style>
