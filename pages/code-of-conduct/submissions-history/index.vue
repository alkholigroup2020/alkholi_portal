// pages/code-of-conduct/submissions-history/index.vue
<template>
  <v-container fluid class="pt-5 px-5 px-md-16">
    <!-- Overlay with loading spinner while data is being fetched -->
    <v-overlay :value="overlay">
      <v-progress-circular indeterminate size="60"></v-progress-circular>
    </v-overlay>
    <!-- Page title with flexbox layout -->
    <div class="d-flex justify-space-between align-center mb-3">
      <div>
        <h3 class="text-h6 text-md-h5 primaryText--text font-weight-bold">
          {{ $t('codeOfConduct.submissionsHistory.pageTitle') }}
        </h3>
      </div>

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
    <hr class="mt-3 mb-1" />
    <!-- Table to display submissions history -->
    <v-simple-table>
      <template #default>
        <thead>
          <tr>
            <th>
              {{ $t('codeOfConduct.submissionsHistory.employeePicture') }}
            </th>
            <th>{{ $t('codeOfConduct.submissionsHistory.employeeID') }}</th>
            <th>{{ $t('codeOfConduct.submissionsHistory.employeeName') }}</th>
            <th>{{ $t('codeOfConduct.submissionsHistory.title') }}</th>
            <th>{{ $t('codeOfConduct.submissionsHistory.company') }}</th>
            <th>{{ $t('codeOfConduct.submissionsHistory.status') }}</th>
            <!-- <th>{{ $t('codeOfConduct.submissionsHistory.recordDate') }}</th> -->
            <th>{{ $t('codeOfConduct.submissionsHistory.version') }}</th>
            <th>{{ $t('codeOfConduct.submissionsHistory.documentLink') }}</th>
          </tr>
        </thead>
        <tbody>
          <!-- Loop through submissions to populate table rows -->
          <tr
            v-for="submission in filteredSubmissionsData"
            :key="submission.id"
          >
            <td>
              <v-avatar size="40">
                <v-img
                  :src="`https://hr.alkholi.com/MenaITech/application/hrms/MenaImages/Employees_Pictures/${submission.employee_picture}`"
                  alt="Employee Picture"
                ></v-img>
              </v-avatar>
            </td>
            <td>{{ submission.employee_id }}</td>
            <td>{{ submission.name_eng }}</td>
            <td>{{ submission.title_e }}</td>
            <td>{{ submission.branch_code }}</td>
            <td>
              <!-- Status chip with conditional coloring -->
              <v-chip
                :color="submission.status === 'approved' ? 'success' : 'error'"
                small
              >
                {{ submission.status === 'approved' ? 'Approved' : 'Rejected' }}
              </v-chip>
            </td>
            <!-- <td>{{ formattedDate(submission.signed_at) }}</td> -->
            <td>v.{{ submission.version_number }}</td>
            <td>
              <!-- Button to open PDF in dialog -->
              <v-btn
                rounded
                fab
                small
                text
                @click.prevent="openPdf(submission.file_path)"
              >
                <v-icon>mdi-file-document</v-icon>
              </v-btn>
            </td>
          </tr>
        </tbody>
      </template>
    </v-simple-table>
    <!-- Dialog for viewing PDF documents -->
    <v-dialog v-model="pdfDialog" max-width="850">
      <v-card>
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
            height="600"
            style="border: none"
          ></iframe>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
import { mapState } from 'vuex'
export default {
  layout: 'codeOfConduct', // Use the same layout as other CoC pages
  data() {
    return {
      overlay: false, // Controls loading overlay visibility
      submissions: [], // Array to store fetched submissions
      pdfDialog: false, // Controls PDF dialog visibility
      selectedPdfUrl: '', // URL of the selected PDF to display
      searchTerm: '',
    }
  },
  computed: {
    // Map Vuex state to check if user is a CoC admin
    ...mapState({
      isCOCAdmin: (state) => state.portal.isCOCAdmin,
    }),

    filteredSubmissionsData() {
      return this.submissions.filter((employee) => {
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
  async mounted() {
    // Redirect non-admins to the CoC form page
    if (!this.isCOCAdmin) {
      this.$router.push(this.localePath('/code-of-conduct/coc-form'))
    }
    await this.fetchSubmissionsHistory() // Fetch data on page load
  },
  methods: {
    // Fetch submissions history from the backend
    async fetchSubmissionsHistory() {
      this.overlay = true // Show loading spinner
      try {
        const response = await this.$axios.get(
          `${this.$config.baseURL}/coc-api/get-submissions-history`
        )
        this.submissions = response.data // Store fetched data
      } catch (error) {
        // Display error notification if fetch fails
        this.$store.dispatch('appNotifications/addNotification', {
          type: 'error',
          message: 'Failed to fetch submissions history',
        })
      } finally {
        this.overlay = false // Hide loading spinner
      }
    },

    // Format date for display
    formattedDate(dateString) {
      const options = {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Riyadh',
      }
      const formatter = new Intl.DateTimeFormat('en-US', options)
      return formatter.format(new Date(dateString))
    },
    // Open PDF in dialog
    openPdf(filePath) {
      this.selectedPdfUrl = `${this.$config.baseURL}/coc-api/signed-coc-documents/${filePath}`
      this.pdfDialog = true // Show PDF dialog
    },
  },
}
</script>
