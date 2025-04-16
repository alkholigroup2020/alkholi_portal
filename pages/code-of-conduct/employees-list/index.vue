<template>
  <v-container fluid class="pt-5 px-5 px-md-16">
    <v-overlay :value="overlay">
      <v-progress-circular indeterminate size="60"></v-progress-circular>
    </v-overlay>

    <!-- toolbar -->
    <v-row>
      <v-col>
        <div class="w-full d-flex justify-space-between">
          <!-- title -->
          <h3 class="text-h5 primaryText--text">Employees List</h3>
          <!-- utilities -->
          <div class="w-full d-flex justify-end align-center">
            <!-- bulk notifications emails -->
            <!-- <div class="w-full d-flex justify-center align-center">
              <div>
                <v-dialog v-model="sendEmailsDialog" width="500" persistent>
                  <template #activator="{ on, attrs }">
                    <v-btn
                      :color="$vuetify.theme.dark ? 'white' : 'primary'"
                      outlined
                      v-bind="attrs"
                      class="mx-3 text-capitalize"
                      v-on="on"
                      @click="sendEmailsDialog = true"
                      ><v-icon>mdi-email</v-icon>
                      <span class="px-3">Send notification emails</span>
                    </v-btn>
                  </template>

                  <v-card :class="$vuetify.theme.dark ? 'primary' : ''">
                    <v-card-title class="text-subtitle-1 primary_5">
                      {{ $t('codeOfConduct.employeesList.sendingEmailsTitle') }}
                    </v-card-title>
                    <v-divider></v-divider>
                    <v-card-text class="pb-0">
                      <p
                        class="text-subtitle-1 font-weight-medium py-8 mb-0 text-center"
                      >
                        {{
                          $t('codeOfConduct.employeesList.sendingEmailsMessage')
                        }}
                      </p>
                    </v-card-text>

                    <v-card-actions class="pb-10">
                      <v-spacer></v-spacer>

                      <v-btn
                        outlined
                        class="px-8 mx-2 text-capitalize"
                        color="success darken-1"
                        :loading="sendingEmails"
                        @click.prevent="sendEmails()"
                      >
                        {{ $t('generals.yes') }}
                      </v-btn>
                      <v-btn
                        outlined
                        :disabled="sendingEmails"
                        class="px-8 text-capitalize"
                        color="error darken-1"
                        @click="sendEmailsDialog = false"
                      >
                        {{ $t('generals.no') }}
                      </v-btn>
                      <v-spacer></v-spacer>
                    </v-card-actions>
                  </v-card>
                </v-dialog>
              </div>
            </div> -->
            <!-- search bar -->
            <div>
              <v-text-field
                v-model="searchTerm"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                append-icon="mdi-magnify"
                label="Search"
                single-line
                hide-details
                outlined
                dense
              ></v-text-field>
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
          class="pb-5 primaryText--text"
        >
          <template #default>
            <thead>
              <tr>
                <th class="text-subtitle-2 primaryText--text"></th>
                <th class="text-subtitle-2 primaryText--text"></th>
                <th class="text-subtitle-2 primaryText--text">Name</th>
                <th class="text-subtitle-2 primaryText--text">ID</th>
                <th class="text-subtitle-2 primaryText--text">Title</th>
                <th class="text-subtitle-2 primaryText--text">Email</th>
                <th class="text-subtitle-2 primaryText--text">Company</th>
                <th class="text-subtitle-2 primaryText--text">Signature</th>
                <th class="text-subtitle-2 primaryText--text">Version</th>
                <th class="text-subtitle-2 primaryText--text">Signed At</th>
                <th class="text-subtitle-2 primaryText--text">
                  Signed Document
                </th>
                <th class="text-subtitle-2 primaryText--text">
                  Send Notification
                </th>
                <th class="text-subtitle-2 primaryText--text">Approval</th>
              </tr>
            </thead>
            <tbody>
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

                <!-- employee id -->
                <td>
                  {{
                    $i18n.locale === 'en' ? employee.title_e : employee.title_a
                  }}
                </td>

                <!-- name -->
                <td>
                  {{
                    $i18n.locale === 'en' ? employee.name_eng : employee.name_a
                  }}
                </td>

                <!-- email -->
                <td>
                  {{
                    employee.email === 'NoEmail@admin.com'
                      ? 'N/A'
                      : employee.email
                  }}
                </td>

                <!-- company -->
                <td>{{ employee.branch_code }}</td>

                <!-- Compliance Status -->
                <td class="w-full text-center">
                  <!-- rejected -->
                  <v-chip
                    v-if="employee.signature_id"
                    :color="
                      employee.status === 'approved'
                        ? 'success'
                        : employee.status === 'rejected'
                        ? 'error'
                        : employee.status === 'pending'
                        ? 'warning'
                        : ''
                    "
                    small
                  >
                    {{
                      employee.status === 'approved'
                        ? 'Approved'
                        : employee.status === 'rejected'
                        ? 'Rejected'
                        : employee.status === 'pending'
                        ? 'Pending Approval'
                        : employee.status === 'not_signed'
                        ? 'Not Signed'
                        : ''
                    }}
                  </v-chip>
                  <!-- <v-chip v-else color="error" small>Not Signed</v-chip> -->
                </td>

                <!-- version_number -->
                <td class="w-full text-center">
                  <span>{{ employee.version_number }}</span>
                </td>

                <!-- last_signed_at -->
                <td>
                  {{
                    employee.last_signed_at
                      ? formattedDate(employee.last_signed_at)
                      : ''
                  }}
                </td>

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

                <!-- send notification -->
                <td>
                  <div class="w-full d-flex justify-center align-center">
                    <v-btn
                      v-if="
                        employee.status === 'rejected' ||
                        employee.status === null
                      "
                      rounded
                      fab
                      small
                      text
                      class="mx-1 py-0 px-0 text-capitalize"
                      :disabled="sendingEmail"
                      @click.prevent="
                        sendEmail(
                          employee.email,
                          employee.name_eng.split(' ')[0]
                        )
                      "
                      ><v-icon>mdi-email</v-icon>
                    </v-btn>
                  </div>
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
        <v-card-title class="d-flex justify-space-between">
          <span>PDF Viewer</span>
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
      pdfDialog: false,
      acceptDialog: false,
      sendingEmails: false,
      rejectDialog: false,
      selectedPdfUrl: null,
      sendEmailsDialog: false,
      rejecting: false,
      approving: false,
      employeesData: [],
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
      const employees = await this.$store.dispatch('coc/fetchEmployeesData')
      this.employeesData = employees
    },

    async sendEmails() {
      //
    },

    async sendEmail(email, name) {
      try {
        this.overlay = true
        const response = await this.$axios.post('/coc-api/send-single-email', {
          email,
          name,
        })
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

        const response = await this.$axios.post('/coc-api/approve-signature', {
          signatureId,
          adminId,
        })
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
        const response = await this.$axios.post('/coc-api/reject-signature', {
          signatureId,
        })
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
  },
}
</script>
