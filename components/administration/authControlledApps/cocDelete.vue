<template>
  <v-dialog v-model="dialog" width="500" persistent>
    <template #activator="{ on, attrs }">
      <v-btn text fab small v-bind="attrs" v-on="on" @click="dialog = true">
        <v-icon small color="error">mdi-delete</v-icon>
      </v-btn>
    </template>

    <v-card>
      <v-card-title class="text-subtitle-1 primary_5">
        {{ $t('adminPage.coc.confirmationTitle') }}
      </v-card-title>

      <v-card-text class="pb-0">
        <p
          class="text-subtitle-1 font-weight-medium pt-3 pb-8 mb-0 text-center"
        >
          {{ $t('adminPage.coc.confirmationMessage') }}
        </p>
      </v-card-text>

      <v-card-actions class="pb-10">
        <v-spacer></v-spacer>

        <v-btn
          outlined
          class="px-8 mx-2 text-capitalize"
          color="success darken-1 "
          text
          @click="deleteCOCAdmin()"
        >
          {{ $t('generals.yes') }}
        </v-btn>
        <v-btn
          outlined
          class="px-8 text-capitalize"
          color="error darken-1 "
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
  },
  data() {
    return {
      dialog: false,
    }
  },
  methods: {
    async deleteCOCAdmin() {
      try {
        this.dialog = false
        this.$nextTick(async () => {
          this.$nuxt.$loading.start()
          await this.$store.dispatch(
            'administration/cocAdmins/deleteCOCAdmin',
            { code: this.employee }
          )
          await this.$store.dispatch('administration/cocAdmins/getCOCAdmins')
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
