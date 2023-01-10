<template>
  <v-dialog v-model="dialog" persistent max-width="950">
    <v-card>
      <v-overlay :value="overlay">
        <v-progress-circular indeterminate size="50"></v-progress-circular>
      </v-overlay>
      <v-card-title class="text-h6 text-center">
        {{ $t('adminPage.dtrApp.setup.assignmentTitle') }}
      </v-card-title>

      <!-- <hr />
      <div class="d-flex">
        <v-spacer></v-spacer>
        <p class="mb-0">{{ brach }}</p>
        <v-spacer></v-spacer>
        <p class="mb-0">{{ division }}</p>
        <v-spacer></v-spacer>
        <p class="mb-0">{{ department }}</p>
        <v-spacer></v-spacer>
        <p class="mb-0">{{ section }}</p>
        <v-spacer></v-spacer>
        <p class="mb-0">{{ subsection }}</p>
        <v-spacer></v-spacer>

        <p class="mb-0">{{ memberPicturePath }}</p>
        <v-spacer></v-spacer>
        <p class="mb-0">{{ hrPicture }}</p>
        <v-spacer></v-spacer>
        <p class="mb-0">{{ portalPicture }}</p>
        <v-spacer></v-spacer>
      </div> -->

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
  props: {
    brach: {
      type: String,
      default: undefined,
    },
    division: {
      type: String,
      default: undefined,
    },
    department: {
      type: Array,
      default: undefined,
    },
    section: {
      type: Array,
      default: undefined,
    },
    subsection: {
      type: String,
      default: undefined,
    },
  },
  data() {
    return {
      dialog: true,
      overlay: false,
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
      memberPicturePath: '',
      hrPicture: false,
      portalPicture: false,
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

    async getEmployeeInfo() {
      try {
        this.overlay = true

        const A = this.adminCode.trim()
        if (A !== '') {
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
            this.memberPicturePath = this.employeeInfo.memberPicturePath
            this.hrPicture = this.employeeInfo.hrPicture
            this.portalPicture = this.employeeInfo.portalPicture
            this.optionsEnabled = false
          }
        }
        this.overlay = false
      } catch (e) {
        this.overlay = false

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

    async saveDTRAdmin() {
      try {
        if (
          !this.isAdmin &&
          !this.isApprover &&
          !this.isManpowerAdmin &&
          !this.isMigrator &&
          !this.isReportsAdmin
        ) {
          throw new Error('At least one role should be selected!')
        }

        console.log('🚀 brach ==>', this.brach)
        console.log('🚀 division ==>', this.division)
        console.log('🚀 department ==>', this.department)
        console.log('🚀 section ==>', this.section)
        console.log('🚀 subsection ==>', this.subsection)

        this.overlay = true

        // if both arrays are empty
        if (this.department === undefined && this.section === undefined) {
          // check if the admin is already exist in the same path
          const check = await this.$axios.post(
            `${this.$config.baseURL}/business-cards-api/sql-call`,
            {
              query: `
            SELECT COUNT(employeeCode) as employee
            FROM [alkholiPortal].[dtr].[adminAssignment]
            WHERE employeeCode='${this.adminCode}'
            AND branchName='${this.brach}' 
            AND divisionCode='${this.division}' 
            AND departmentCode='${this.department}'
            AND sectionCode ='${this.section}'
            AND subsectionCode='${this.subsection}'
            `,
            }
          )
          if (check.data[0].employee >= 1) {
            // error
            this.overlay = false
            this.$emit('resetPopupValue')
            this.dialog = false
            throw new Error('Admin Already Exist!')
          }

          console.log(`Saving from section 001`)

          await this.$axios.post(
            `${this.$config.baseURL}/business-cards-api/sql-call`,
            {
              query: `exec [dtr].[adminAssignment_addData] '${
                this.adminCode
              }', '${this.employeeName}', '${this.employeeEmail}', '${
                this.branchCode
              }', '${this.memberPicturePath}',
              ${this.hrPicture ? 1 : 0},
              ${this.portalPicture ? 1 : 0}, ${this.isAdmin ? 1 : 0},
              ${this.isApprover ? 1 : 0}, ${this.isManpowerAdmin ? 1 : 0}, ${
                this.isMigrator ? 1 : 0
              }, ${this.isReportsAdmin ? 1 : 0},
                '${this.brach}', 
                '${this.division}', '${this.department}', '${this.section}', '${
                this.subsection
              }'
            `,
            }
          )
          this.overlay = false
          this.$emit('resetPopupValue')
          this.dialog = false
          return
        }

        // only one of departments or section arrays will have length more than 1
        // check one of them first, if more than one will loop through it
        // if not, then will loop through the other one
        // the else close will match even when both arrays has a length of 1 or even 0

        if (this.department.length > 1) {
          for await (const element of this.department) {
            // check if the admin is already exist in the same path
            const check = await this.$axios.post(
              `${this.$config.baseURL}/business-cards-api/sql-call`,
              {
                query: `
                  SELECT COUNT(employeeCode) as employee
                  FROM [alkholiPortal].[dtr].[adminAssignment]
                  WHERE employeeCode='${this.adminCode}'
                  AND branchName='${this.brach}' 
                  AND divisionCode='${this.division}' 
                  AND departmentCode='${element}'
                  AND sectionCode ='${this.section}'
                  AND subsectionCode='${this.subsection}'
                `,
              }
            )
            if (check.data[0].employee >= 1) {
              // error
              this.overlay = false
              this.$emit('resetPopupValue')
              this.dialog = false
              throw new Error('Admin Already Exist!')
            }

            console.log(`Saving from section 002`)

            await this.$axios.post(
              `${this.$config.baseURL}/business-cards-api/sql-call`,
              {
                query: `exec [dtr].[adminAssignment_addData] '${
                  this.adminCode
                }', '${this.employeeName}', '${this.employeeEmail}', '${
                  this.branchCode
                }', '${this.memberPicturePath}',
                  ${this.hrPicture ? 1 : 0},
                  ${this.portalPicture ? 1 : 0}, ${this.isAdmin ? 1 : 0},
                  ${this.isApprover ? 1 : 0}, ${
                  this.isManpowerAdmin ? 1 : 0
                }, ${this.isMigrator ? 1 : 0}, ${this.isReportsAdmin ? 1 : 0},
                  '${this.brach}', '${this.division}', '${element}', '${
                  this.section
                }', '${this.subsection}'
                    `,
              }
            )
          }
        } else if (this.department.length === 1 && this.section === undefined) {
          // check if the admin is already exist in the same path
          const check = await this.$axios.post(
            `${this.$config.baseURL}/business-cards-api/sql-call`,
            {
              query: `
                  SELECT COUNT(employeeCode) as employee
                  FROM [alkholiPortal].[dtr].[adminAssignment]
                  WHERE employeeCode='${this.adminCode}'
                  AND branchName='${this.brach}' 
                  AND divisionCode='${this.division}' 
                  AND departmentCode='${this.department[0]}'
                  AND sectionCode ='${this.section}'
                  AND subsectionCode='${this.subsection}'
                `,
            }
          )
          if (check.data[0].employee >= 1) {
            // error
            this.overlay = false
            this.$emit('resetPopupValue')
            this.dialog = false
            throw new Error('Admin Already Exist!')
          }

          console.log(`Saving from section 003`)

          await this.$axios.post(
            `${this.$config.baseURL}/business-cards-api/sql-call`,
            {
              query: `exec [dtr].[adminAssignment_addData] '${
                this.adminCode
              }', '${this.employeeName}', '${this.employeeEmail}', '${
                this.branchCode
              }', '${this.memberPicturePath}',
                  ${this.hrPicture ? 1 : 0},
                  ${this.portalPicture ? 1 : 0}, ${this.isAdmin ? 1 : 0},
                  ${this.isApprover ? 1 : 0}, ${
                this.isManpowerAdmin ? 1 : 0
              }, ${this.isMigrator ? 1 : 0}, ${this.isReportsAdmin ? 1 : 0},
                  '${this.brach}', '${this.division}', '${
                this.department[0]
              }', '${this.section}', '${this.subsection}'
                    `,
            }
          )
        } else {
          for await (const element of this.section) {
            // check if the admin is already exist in the same path
            const check = await this.$axios.post(
              `${this.$config.baseURL}/business-cards-api/sql-call`,
              {
                query: `
                  SELECT COUNT(employeeCode) as employee
                  FROM [alkholiPortal].[dtr].[adminAssignment]
                  WHERE employeeCode='${this.adminCode}'
                  AND branchName='${this.brach}' 
                  AND divisionCode='${this.division}' 
                  AND departmentCode='${this.department}'
                  AND sectionCode ='${element}'
                  AND subsectionCode='${this.subsection}'
                `,
              }
            )
            if (check.data[0].employee) {
              // error
              this.overlay = false
              this.$emit('resetPopupValue')
              this.dialog = false
              throw new Error('Admin Already Exist!')
            }
            console.log(`Saving from section 004`)
            await this.$axios.post(
              `${this.$config.baseURL}/business-cards-api/sql-call`,
              {
                query: `exec [dtr].[adminAssignment_addData] '${
                  this.adminCode
                }', '${this.employeeName}', '${this.employeeEmail}', '${
                  this.branchCode
                }', '${this.memberPicturePath}',
                ${this.hrPicture ? 1 : 0},
                ${this.portalPicture ? 1 : 0}, ${this.isAdmin ? 1 : 0},
                ${this.isApprover ? 1 : 0}, ${this.isManpowerAdmin ? 1 : 0}, ${
                  this.isMigrator ? 1 : 0
                }, ${this.isReportsAdmin ? 1 : 0},
                '${this.brach}', '${this.division}', '${
                  this.department
                }', '${element}', '${this.subsection}'
                  `,
              }
            )
          }
        }

        this.overlay = false
        this.$emit('resetPopupValue')
        this.dialog = false
      } catch (e) {
        this.overlay = false
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
