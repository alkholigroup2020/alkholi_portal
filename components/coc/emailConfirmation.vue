<template>
  <v-dialog v-model="emailDialog" width="500" persistent>
    <template #activator="{ on, attrs }">
      <v-btn
        v-bind="attrs"
        rounded
        fab
        small
        text
        class="mx-1 py-0 px-0 text-capitalize cursor-pointer"
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
          class="px-8 mx-2 text-capitalize cursor-pointer"
          color="success darken-1"
          @click.prevent="sendEmail()"
        >
          {{ $t('generals.yes') }}
        </v-btn>
        <v-btn
          outlined
          class="px-8 text-capitalize cursor-pointer"
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
import { securityMessage } from '~/utils/security-error'
export default {
  layout: 'adminPage',
  props: {
    employeeCode: {
      type: String,
      required: true,
    },
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
    async sendEmail() {
      try {
        // notify that the sending process starts
        this.$emit('sending')
        this.emailDialog = false
        const response = await this.$axios.post(
          `${this.$config.baseURL}/coc-api/send-single-email`,
          {
            employeeCode: this.employeeCode,
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
          message: securityMessage(error, (key) => this.$t(key)),
        })
      }
    },
  },
}
</script>

<style></style>
