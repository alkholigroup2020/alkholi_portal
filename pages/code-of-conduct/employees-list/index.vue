<template>
  <v-container fluid class="pt-5 px-5 px-md-16">
    <v-overlay :value="overlay">
      <v-progress-circular indeterminate size="60"></v-progress-circular>
    </v-overlay>

    <!-- toolbar -->
    <v-row>
      <v-col>
        <div class="w-full d-md-flex justify-space-between">
          <!-- title -->
          <h3
            class="text-h6 text-lg-h5 primaryText--text my-2 font-weight-bold"
          >
            {{ $t('codeOfConduct.employeesList.pageTitle') }}
          </h3>
          <!-- utilities -->
          <div class="w-full d-flex justify-md-end align-center flex-wrap">
            <!-- search bar -->
            <div class="mx-md-4 my-2">
              <v-text-field
                v-model="searchTerm"
                height="38"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                append-icon="mdi-magnify"
                :label="$t('codeOfConduct.employeesList.search')"
                single-line
                hide-details
                outlined
                dense
              ></v-text-field>
            </div>
            <!-- report generation -->
            <div
              class="my-2"
              :class="$vuetify.$i18n === 'en' ? 'ml-3 ml-md-0' : 'mr-3 mr-md-0'"
            >
              <!-- Export Report button -->
              <v-btn
                outlined
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                class="text-capitalize"
                height="38"
                @click="reportDialog = true"
              >
                <v-icon left>mdi-file-export</v-icon>
                <span class="text-caption text-sm-body-2">{{
                  $t('codeOfConduct.employeesList.exportButton')
                }}</span>
              </v-btn>
            </div>
          </div>
        </div>
        <hr class="mt-3 mb-1" />
      </v-col>
    </v-row>

    <!-- table -->
    <v-row>
      <v-col cols="12" class="py-0">
        <v-simple-table
          fixed-header
          height="80vh"
          :class="$vuetify.theme.dark ? 'primary' : ''"
          class="pb-5 primaryText--text responsive-table"
        >
          <template #default>
            <thead>
              <tr>
                <th class="text-caption text-sm-body-2 primaryText--text"></th>
                <th class="text-caption text-sm-body-2 primaryText--text"></th>
                <th class="text-caption text-sm-body-2 primaryText--text">
                  {{ $t('codeOfConduct.submissionsHistory.employeeID') }}
                </th>
                <th class="text-caption text-sm-body-2 primaryText--text">
                  {{ $t('codeOfConduct.submissionsHistory.employeeName') }}
                </th>
                <th class="text-caption text-sm-body-2 primaryText--text">
                  {{ $t('codeOfConduct.submissionsHistory.title') }}
                </th>
                <th class="text-caption text-sm-body-2 primaryText--text">
                  {{ $t('codeOfConduct.submissionsHistory.email') }}
                </th>
                <th class="text-caption text-sm-body-2 primaryText--text">
                  {{ $t('codeOfConduct.submissionsHistory.company') }}
                </th>
                <th class="text-caption text-sm-body-2 primaryText--text">
                  {{ $t('codeOfConduct.submissionsHistory.status') }}
                </th>
                <th class="text-caption text-sm-body-2 primaryText--text">
                  {{ $t('codeOfConduct.submissionsHistory.notification') }}
                </th>
                <th class="text-caption text-sm-body-2 primaryText--text">
                  {{ $t('codeOfConduct.submissionsHistory.documentLink') }}
                </th>
                <th class="text-caption text-sm-body-2 primaryText--text">
                  {{ $t('codeOfConduct.submissionsHistory.version') }}
                </th>
                <th class="text-caption text-sm-body-2 primaryText--text">
                  {{ $t('codeOfConduct.submissionsHistory.approval') }}
                </th>
              </tr>
            </thead>
            <tbody class="text-caption text-sm-body-2">
              <tr
                v-for="(employee, index) in filteredEmployeesData"
                :key="index"
              >
                <td>{{ index + 1 }}</td>

                <!-- picture -->
                <td>
                  <v-avatar
                    v-if="employee.employee_picture"
                    style="border: 0.5px #000046 solid"
                    size="40"
                  >
                    <v-img
                      :src="`https://hr.alkholi.com/MenaITech/application/hrms/MenaImages/Employees_Pictures/${employee.employee_picture}`"
                      alt="Profile Image"
                    ></v-img>
                  </v-avatar>
                  <v-avatar
                    v-else
                    style="border: 0.5px #000046 solid"
                    size="40"
                  >
                    <v-img
                      :src="`${$config.baseURL}/portal-api/profile-data/profile.png`"
                      alt="Profile Image"
                    ></v-img>
                  </v-avatar>
                </td>

                <!-- employee id -->
                <td>{{ employee.employee_id }}</td>

                <!-- name -->
                <td>
                  {{
                    $i18n.locale === 'en' ? employee.name_eng : employee.name_a
                  }}
                </td>

                <!-- employee title -->
                <td>
                  {{
                    $i18n.locale === 'en' ? employee.title_e : employee.title_a
                  }}
                </td>

                <!-- email -->
                <td>
                  {{
                    /^[A-Za-z]+\.[A-Za-z]+@[A-Za-z0-9-]+\.[A-Za-z0-9-]+$/.test(
                      employee.email
                    )
                      ? employee.email
                      : 'N/A'
                  }}
                </td>

                <!-- company -->
                <td>{{ employee.branch_code }}</td>

                <!-- Compliance Status -->
                <td class="w-full text-center">
                  <!-- rejected -->
                  <v-chip
                    small
                    :color="
                      employee.status === 'approved'
                        ? 'success'
                        : employee.status === 'rejected'
                        ? 'error'
                        : employee.status === 'pending'
                        ? 'warning'
                        : 'cyan accent-4'
                    "
                  >
                    {{
                      employee.status === 'approved'
                        ? 'Approved'
                        : employee.status === 'rejected'
                        ? 'Rejected'
                        : employee.status === 'pending'
                        ? 'Pending Approval'
                        : employee.status === null
                        ? 'No Action'
                        : ''
                    }}
                  </v-chip>
                </td>

                <!-- send notification -->

                <td>
                  <div
                    v-if="
                      (employee.status === null &&
                        /^[A-Za-z]+\.[A-Za-z]+@[A-Za-z0-9-]+\.[A-Za-z0-9-]+$/.test(
                          employee.email
                        )) ||
                      (employee.status === 'rejected' &&
                        /^[A-Za-z]+\.[A-Za-z]+@[A-ZaZ0-9-]+\.[A-Za-z0-9-]+$/.test(
                          employee.email
                        ))
                    "
                  >
                    <EmailConfirmation
                      :email="employee.email"
                      :name="employee.name_eng.split(' ')[0]"
                      @sending="overlay = true"
                      @sent="overlay = false"
                      @error="overlay = false"
                    />
                  </div>
                </td>

                <!-- last_signed_at -->
                <!-- <td>
                  {{
                    employee.last_signed_at
                      ? formattedDate(employee.last_signed_at)
                      : ''
                  }}
                </td> -->

                <!-- signed_document_path -->
                <td>
                  <div
                    v-if="employee.signed_document_path"
                    class="w-full d-flex justify-center align-center"
                  >
                    <v-btn
                      rounded
                      fab
                      small
                      text
                      class="mx-1 py-0 px-0 text-capitalize"
                      @click.prevent="openPdf(employee.signed_document_path)"
                      ><v-icon>mdi-file-document</v-icon></v-btn
                    >
                  </div>
                </td>

                <!-- version_number -->
                <td class="w-full text-center">
                  <span>{{ employee.version_number }}</span>
                </td>

                <!-- approve_signature -->
                <td>
                  <div
                    v-if="employee.status === 'pending'"
                    class="w-full d-flex pa-5"
                  >
                    <!-- accept btn -->
                    <div>
                      <v-dialog v-model="acceptDialog" width="500" persistent>
                        <template #activator="{ on, attrs }">
                          <v-btn
                            outlined
                            v-bind="attrs"
                            rounded
                            color="success"
                            class="mx-2 text-subtitle-1 py-0 px-5"
                            v-on="on"
                            @click="acceptDialog = true"
                          >
                            <v-icon>mdi-check</v-icon>
                          </v-btn>
                        </template>

                        <v-card :class="$vuetify.theme.dark ? 'primary' : ''">
                          <v-card-title class="text-subtitle-1 primary_5">
                            {{
                              $t('codeOfConduct.employeesList.approvalTitle')
                            }}
                          </v-card-title>
                          <v-divider></v-divider>
                          <v-card-text class="pb-0">
                            <p
                              class="text-subtitle-1 font-weight-medium py-8 mb-0 text-center"
                            >
                              {{
                                $t(
                                  'codeOfConduct.employeesList.approvalMessage'
                                )
                              }}
                            </p>
                          </v-card-text>

                          <v-card-actions class="pb-10">
                            <v-spacer></v-spacer>

                            <v-btn
                              outlined
                              class="px-8 mx-2 text-capitalize"
                              color="success darken-1"
                              :loading="approving"
                              @click.prevent="
                                approveSignature(employee.signature_id)
                              "
                            >
                              {{ $t('generals.yes') }}
                            </v-btn>
                            <v-btn
                              outlined
                              :disabled="approving"
                              class="px-8 text-capitalize"
                              color="error darken-1"
                              @click="acceptDialog = false"
                            >
                              {{ $t('generals.no') }}
                            </v-btn>
                            <v-spacer></v-spacer>
                          </v-card-actions>
                        </v-card>
                      </v-dialog>
                    </div>
                    <!-- reject btn -->
                    <div>
                      <v-dialog v-model="rejectDialog" width="500" persistent>
                        <template #activator="{ on, attrs }">
                          <v-btn
                            outlined
                            v-bind="attrs"
                            rounded
                            color="error"
                            class="mx-2 text-subtitle-1 py-0 px-5"
                            v-on="on"
                            @click="rejectDialog = true"
                          >
                            <v-icon>mdi-close</v-icon>
                          </v-btn>
                        </template>

                        <v-card :class="$vuetify.theme.dark ? 'primary' : ''">
                          <v-card-title class="text-subtitle-1 primary_5">
                            {{ $t('codeOfConduct.employeesList.rejectTitle') }}
                          </v-card-title>
                          <v-divider></v-divider>
                          <v-card-text class="pb-0">
                            <p
                              class="text-subtitle-1 font-weight-medium py-8 mb-0 text-center"
                            >
                              {{
                                $t('codeOfConduct.employeesList.rejectMessage')
                              }}
                            </p>
                          </v-card-text>

                          <v-card-actions class="pb-10">
                            <v-spacer></v-spacer>

                            <v-btn
                              outlined
                              class="px-8 mx-2 text-capitalize"
                              color="success darken-1"
                              :loading="rejecting"
                              @click.prevent="
                                rejectSignature(employee.signature_id)
                              "
                            >
                              {{ $t('generals.yes') }}
                            </v-btn>
                            <v-btn
                              outlined
                              class="px-8 text-capitalize"
                              color="error darken-1"
                              :disabled="rejecting"
                              @click="rejectDialog = false"
                            >
                              {{ $t('generals.no') }}
                            </v-btn>
                            <v-spacer></v-spacer>
                          </v-card-actions>
                        </v-card>
                      </v-dialog>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </template>
        </v-simple-table>
      </v-col>
    </v-row>

    <!-- employee's submitted form -->
    <v-dialog v-model="pdfDialog" max-width="900">
      <v-card :class="$vuetify.theme.dark ? 'primary' : ''">
        <v-card-title
          class="d-flex justify-space-between text-body-2 text-sm-body-1"
        >
          <span>{{ $t('codeOfConduct.employeesList.pdfViewer') }}</span>
          <v-btn icon @click="pdfDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <iframe
            :src="selectedPdfUrl"
            width="100%"
            height="800"
            style="border: none"
          ></iframe>
        </v-card-text>
        <v-divider></v-divider>
      </v-card>
    </v-dialog>

    <!--  Report Export Dialog -->
    <v-dialog v-model="reportDialog" max-width="500" persistent>
      <v-card :class="$vuetify.theme.dark ? 'primary' : ''">
        <v-card-title
          class="text-subtitle-2 text-sm-subtitle-1 primaryText--text"
        >
          {{ $t('codeOfConduct.employeesList.exportMessage') }}
        </v-card-title>
        <v-divider></v-divider>
        <v-card-text class="pb-0 text-body-2 text-sm-body-1">
          <!-- Report Type Selection -->
          <v-radio-group v-model="reportType">
            <v-radio
              :color="$vuetify.theme.dark ? 'white' : 'primary'"
              :label="$t('codeOfConduct.employeesList.reportSignedEmployees')"
              value="signed"
            >
            </v-radio>
            <v-radio
              :color="$vuetify.theme.dark ? 'white' : 'primary'"
              :label="$t('codeOfConduct.employeesList.reportUnsignedEmployees')"
              value="unsigned"
            ></v-radio>
          </v-radio-group>

          <!-- Format Selection -->
          <!-- menu-props="{color: 'primary'}" -->
          <v-select
            v-model="exportFormat"
            :items="formats"
            :label="$t('codeOfConduct.employeesList.reportFormat')"
            outlined
            :item-color="$vuetify.theme.dark ? 'white' : 'primary'"
            dense
          ></v-select>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-actions class="py-5">
          <v-btn
            outlined
            color="error"
            class="text-capitalize mx-3"
            @click="reportDialog = false"
          >
            {{ $t('codeOfConduct.employeesList.reportCancel') }}
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn
            outlined
            color="success"
            class="text-capitalize mx-3"
            :loading="generating"
            @click="generateReport"
          >
            {{ $t('codeOfConduct.employeesList.reportGenerate') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
import { mapState } from 'vuex'
export default {
  layout: 'codeOfConduct',
  data() {
    return {
      overlay: false,
      syncLoading: false,
      searchTerm: '',
      statusIcon: undefined,
      pdfDialog: false,
      acceptDialog: false,
      sendingEmails: false,
      sendingEmail: false,
      rejectDialog: false,
      selectedPdfUrl: null,
      sendEmailsDialog: false,
      rejecting: false,
      emailDialog: false,
      approving: false,
      employeesData: [],
      reportDialog: false,
      reportType: 'signed',
      generating: false,
      exportFormat: 'csv',
      formats: ['csv', 'xlsx', 'pdf'],
    }
  },

  computed: {
    ...mapState({
      isCOCAdmin: (state) => state.portal.isCOCAdmin,
    }),

    filteredEmployeesData() {
      return this.employeesData.filter((employee) => {
        return (
          employee.name_eng
            .toLowerCase()
            .match(this.searchTerm.toLowerCase()) ||
          employee.employee_id
            .toLowerCase()
            .match(this.searchTerm.toLowerCase()) ||
          employee.branch_code
            .toLowerCase()
            .match(this.searchTerm.toLowerCase())
        )
      })
    },
  },

  created() {
    // check authorization
    if (!this.isCOCAdmin) {
      this.$router.push(this.localePath('/code-of-conduct/coc-form'))
    }
  },

  mounted() {
    this.syncEmployees()
  },

  methods: {
    formattedDate(dateString) {
      const options = {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        // hour: '2-digit',
        // minute: '2-digit',
        // hour12: true,
        timeZone: 'Asia/Riyadh', // Set to Saudi Arabia timezone (UTC+3)
      }

      const formatter = new Intl.DateTimeFormat('en-US', options)

      // Convert database UTC date to local Saudi time
      const date = new Date(dateString)
      return formatter.format(date)
    },

    // syncEmployees
    async syncEmployees() {
      try {
        this.overlay = true
        const employees = await this.$store.dispatch('coc/fetchEmployeesData')
        this.overlay = false
        this.employeesData = employees
      } catch (error) {
        this.$store.dispatch('appNotifications/addNotification', {
          type: 'error',
          message: error.response?.data?.message || 'Employees Sync Failed!',
        })
      }
    },

    showApproved() {
      //
    },

    async sendEmails() {
      //
    },

    async sendEmail(email, name) {
      try {
        this.emailDialog = false
        this.sendingEmail = true
        this.overlay = true
        const response = await this.$axios.post(
          `${this.$config.baseURL}/coc-api/send-single-email`,
          {
            email,
            name,
          }
        )
        if (response.status === 200) {
          this.$store.dispatch('appNotifications/addNotification', {
            type: 'success',
            message: 'Email sent successfully',
          })
        }
      } catch (error) {
        this.$store.dispatch('appNotifications/addNotification', {
          type: 'error',
          message: error.response?.data?.message || 'Email sending failed',
        })
      } finally {
        this.sendingEmail = false
        this.overlay = false
      }
    },

    openPdf(filePath) {
      this.selectedPdfUrl = `${this.$config.baseURL}/coc-api/signed-coc-documents/${filePath}`
      this.pdfDialog = true
    },

    // Approve a signature
    async approveSignature(signatureId) {
      try {
        this.approving = true
        const adminId = localStorage.getItem('employeeCode')

        const response = await this.$axios.post(
          `${this.$config.baseURL}/coc-api/approve-signature`,
          {
            signatureId,
            adminId,
          }
        )
        if (response.status === 200) {
          this.$store.dispatch('appNotifications/addNotification', {
            type: 'success',
            message: 'Signature approved successfully',
          })
          this.pdfDialog = false
          await this.syncEmployees()
          this.approving = false
        }
      } catch (error) {
        this.$store.dispatch('appNotifications/addNotification', {
          type: 'error',
          message: error.response?.data?.message || 'Approval failed',
        })
      }
    },

    // Reject a signature
    async rejectSignature(signatureId) {
      try {
        this.rejecting = true
        const response = await this.$axios.post(
          `${this.$config.baseURL}/coc-api/reject-signature`,
          {
            signatureId,
          }
        )
        if (response.status === 200) {
          this.$store.dispatch('appNotifications/addNotification', {
            type: 'success',
            message: 'Signature rejected successfully',
          })
          this.pdfDialog = false
          await this.syncEmployees()
          this.rejecting = false
        }
      } catch (error) {
        this.$store.dispatch('appNotifications/addNotification', {
          type: 'error',
          message: error.response?.data?.message || 'Rejection failed',
        })
      }
    },

    async generateReport() {
      this.generating = true
      this.overlay = true
      try {
        const format = this.exportFormat
        const type = this.reportType
        const response = await this.$axios.get(
          `${this.$config.baseURL}/coc-api/export-report?type=${type}&format=${format}`,
          {
            responseType: 'blob',
          }
        )

        let fileExtension = format
        let mimeType = ''
        if (format === 'csv') {
          mimeType = 'text/csv'
        } else if (format === 'xlsx') {
          mimeType =
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          fileExtension = 'xlsx'
        } else if (format === 'pdf') {
          mimeType = 'application/pdf'
        }

        const url = window.URL.createObjectURL(
          new Blob([response.data], { type: mimeType })
        )
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `${type}_employees.${fileExtension}`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)

        this.$store.dispatch('appNotifications/addNotification', {
          type: 'success',
          message: `Report (${type}) in ${format.toUpperCase()} format generated successfully`,
        })

        this.reportDialog = false
      } catch (error) {
        this.$store.dispatch('appNotifications/addNotification', {
          type: 'error',
          message: 'Failed to generate report',
        })
      } finally {
        this.generating = false
        this.overlay = false
      }
    },
  },
}
</script>

<style>
.v-list-item--highlighted {
  color: #f0f0f0 !important;
}

/* Responsive table text */
.responsive-table {
  font-size: 12px;
}

@media (min-width: 600px) {
  .responsive-table {
    font-size: 14px;
  }
}

@media (min-width: 960px) {
  .responsive-table {
    font-size: 16px;
  }
}

/* Ensure buttons have readable text on mobile */
.v-btn {
  white-space: normal;
  height: auto;
  min-height: 36px;
}
</style>
