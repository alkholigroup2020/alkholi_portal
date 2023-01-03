<template>
  <v-dialog v-model="dialog" persistent max-width="950">
    <v-card>
      <v-card-title class="text-h6 text-center">
        {{ $t('adminPage.dtrApp.setup.assignmentTitle') }}
      </v-card-title>

      <hr />

      <ValidationObserver v-slot="{ handleSubmit }" ref="theForm">
        <v-form @submit.prevent="handleSubmit(saveDTRAdmin)">
          <v-container class="px-md-13 pt-8">
            <v-row class="ma-0">
              <v-col cols="12" md="6">
                <div class="d-flex">
                  <v-text-field
                    v-model="adminCode"
                    :disabled="!optionsEnabled"
                    :color="$vuetify.theme.dark ? 'white' : 'primary'"
                    outlined
                    dense
                    :placeholder="$t('adminPage.dtrApp.formInput')"
                  ></v-text-field>
                  <v-btn
                    small
                    fab
                    elevation="0"
                    color="primary"
                    class="mx-3"
                    @click="getEmployeeInfo"
                  >
                    <v-icon color="white">mdi-plus</v-icon>
                  </v-btn>
                </div>
              </v-col>
            </v-row>
            <v-row class="ma-0">
              <v-col cols="12" md="6" class="py-0">
                <v-text-field
                  v-model="employeeName"
                  disabled
                  :label="$t('adminPage.dtrApp.setup.employeeName')"
                  :color="$vuetify.theme.dark ? 'white' : 'primary'"
                  outlined
                  dense
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6" class="py-0">
                <v-text-field
                  v-model="employeeTitle"
                  disabled
                  :label="$t('adminPage.dtrApp.setup.employeeTitle')"
                  :color="$vuetify.theme.dark ? 'white' : 'primary'"
                  outlined
                  dense
                ></v-text-field>
              </v-col>
            </v-row>
            <v-row class="ma-0">
              <v-col cols="12" md="6" class="py-0">
                <v-text-field
                  v-model="employeeEmail"
                  disabled
                  :label="$t('adminPage.dtrApp.setup.employeeEmail')"
                  :color="$vuetify.theme.dark ? 'white' : 'primary'"
                  outlined
                  dense
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6" class="py-0">
                <v-text-field
                  v-model="branchCode"
                  disabled
                  :label="$t('adminPage.dtrApp.setup.branchCode')"
                  :color="$vuetify.theme.dark ? 'white' : 'primary'"
                  outlined
                  dense
                ></v-text-field>
              </v-col>
            </v-row>
            <!-- roles -->
            <v-row class="ma-0 px-1">
              <v-col cols="12" sm="2">
                <v-checkbox
                  v-model="isAdmin"
                  :disabled="optionsEnabled"
                  label="DTR Admin"
                ></v-checkbox>
              </v-col>
              <v-col cols="12" sm="2">
                <v-checkbox
                  v-model="isApprover"
                  :disabled="optionsEnabled"
                  label="Approver"
                ></v-checkbox>
              </v-col>
              <v-col cols="12" sm="2">
                <v-checkbox
                  v-model="isManpowerAdmin"
                  :disabled="optionsEnabled"
                  label="Manpower"
                ></v-checkbox>
              </v-col>
              <v-col cols="12" sm="2">
                <v-checkbox
                  v-model="isMigrator"
                  :disabled="optionsEnabled"
                  label="Migrator"
                ></v-checkbox>
              </v-col>
              <v-col cols="12" sm="2">
                <v-checkbox
                  v-model="isReportsAdmin"
                  :disabled="optionsEnabled"
                  label="Reports"
                ></v-checkbox>
              </v-col>
            </v-row>
          </v-container>

          <hr />

          <v-card-actions class="px-7 px-md-16 py-3">
            <v-spacer></v-spacer>
            <v-btn
              class="text-capitalize px-5 mx-3"
              outlined
              color="red darken-1"
              text
              @click="dialogClosed"
            >
              {{ $t('generals.cancel') }}
            </v-btn>
            <v-btn
              class="text-capitalize px-5"
              outlined
              :disabled="optionsEnabled"
              color="green darken-1"
              type="submit"
              text
              >{{ $t('generals.save') }}</v-btn
            >
          </v-card-actions>
        </v-form>
      </ValidationObserver>
    </v-card>
  </v-dialog>
</template>

<script>
import { mapState } from 'vuex'
import { extend, localize } from 'vee-validate'
import { required } from 'vee-validate/dist/rules'

extend('required', {
  ...required,
})

localize({
  en: {
    messages: {
      required: 'This field is required!',
    },
  },
  ar: {
    messages: {
      required: 'هــذا حــقل مطــلوب!',
    },
  },
})
export default {
  data() {
    return {
      dialog: true,
      isAdmin: false,
      isApprover: false,
      isManpowerAdmin: false,
      isMigrator: false,
      isReportsAdmin: false,
      optionsEnabled: true,
      adminCode: '',
      employeeName: '',
      employeeTitle: '',
      employeeEmail: '',
      branchCode: '',
    }
  },
  computed: {
    ...mapState({
      employeeInfo: (state) => state.administration.dtrSetup.employeeInfo,
    }),
  },
  methods: {
    dialogClosed() {
      this.$emit('resetPopupValue')
      this.dialog = false
    },
    saveDTRAdmin() {
      this.$emit('resetPopupValue')
      this.dialog = false
      //
    },
    async getEmployeeInfo() {
      try {
        const A = this.adminCode.trim()
        if (A !== '') {
          this.$nextTick(async () => {
            this.$nuxt.$loading.start()
            const employeeCode = {
              code: A,
            }
            await this.$store.dispatch(
              'administration/dtrSetup/getEmployeeInfo',
              employeeCode
            )

            if (Object.keys(this.employeeInfo).length > 0) {
              this.employeeName = this.employeeInfo.memberInfo.employee_name_eng
              this.employeeEmail = this.employeeInfo.memberInfo.Email
              this.employeeTitle = this.employeeInfo.titleInfo.system_desp_e
              this.branchCode = this.employeeInfo.memberInfo.branch_code
              this.optionsEnabled = false
            }

            this.$nuxt.$loading.finish()
          })
        }
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
