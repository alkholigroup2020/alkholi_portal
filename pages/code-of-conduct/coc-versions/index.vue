<template>
  <v-container fluid class="pt-5 px-5 px-md-16">
    <v-overlay :value="overlay">
      <v-progress-circular indeterminate size="60"></v-progress-circular>
    </v-overlay>

    <div class="d-flex justify-space-between align-center mb-3">
      <div>
        <h3 class="text-h6 text-md-h5 primaryText--text font-weight-bold">
          {{ $t('codeOfConduct.appPageNames.cocVersions') }}
        </h3>
      </div>

      <!-- new coc addition popup form -->
      <div>
        <div class="text-center">
          <v-dialog v-model="dialog" width="500">
            <template #activator="{ on, attrs }">
              <v-btn small outlined v-bind="attrs" v-on="on">{{
                $t('codeOfConduct.cocVersions.addNew')
              }}</v-btn>
            </template>

            <v-card color="secondaryBG">
              <v-card-title class="text-h6">{{
                $t('codeOfConduct.cocVersions.formTitle')
              }}</v-card-title>

              <v-divider></v-divider>

              <ValidationObserver v-slot="valid">
                <v-form @submit.prevent="saveCoCDocument">
                  <ValidationProvider
                    v-slot="{ errors, validate }"
                    rules="ext:pdf|size:25600|required"
                  >
                    <v-file-input
                      v-model="cocDocument"
                      show-size
                      type="file"
                      class="pa-5"
                      :color="$vuetify.theme.dark ? 'white' : 'primary'"
                      :error-messages="errors[0]"
                      accept="application/pdf"
                      prepend-icon="mdi-file-document"
                      :label="$t('codeOfConduct.cocVersions.formLabel')"
                      @input="validate"
                    ></v-file-input>
                  </ValidationProvider>

                  <!-- version number -->
                  <div class="d-flex align-center px-5 pb-8">
                    <div>
                      <p>
                        {{ $t('codeOfConduct.cocVersions.formVersionNumber') }}
                      </p>
                    </div>
                    <div class="mx-5">
                      <ValidationProvider
                        v-slot="{ errors, validate }"
                        rules="numeric|required"
                      >
                        <v-text-field
                          v-model="versionNumber"
                          type="number"
                          :error-messages="errors[0]"
                          :color="$vuetify.theme.dark ? 'white' : 'primary'"
                          @input="validate"
                        >
                        </v-text-field>
                      </ValidationProvider>
                    </div>
                  </div>

                  <v-divider></v-divider>
                  <div class="d-flex justify-end align-center py-3 mx-5">
                    <v-btn
                      :disabled="valid.invalid"
                      color="primary"
                      class="px-5 py-0 text-capitalize"
                      type="submit"
                      >Save</v-btn
                    >
                  </div>
                </v-form>
              </ValidationObserver>
            </v-card>
          </v-dialog>
        </div>
      </div>
    </div>

    <hr class="mt-3 mb-1" />

    <!-- versions table -->
    <div>
      <!-- Add version table -->
      <v-simple-table
        :class="$vuetify.theme.dark ? 'primary' : ''"
        class="primaryText--text"
      >
        <template #default>
          <thead>
            <tr>
              <th class="text-subtitle-2 primaryText--text">
                {{ $t('codeOfConduct.cocVersions.versionNumber') }}
              </th>

              <th class="text-subtitle-2 primaryText--text">
                {{ $t('codeOfConduct.cocVersions.uploadBy') }}
              </th>
              <th class="text-subtitle-2 primaryText--text">
                {{ $t('codeOfConduct.cocVersions.status') }}
              </th>
              <th class="text-subtitle-2 primaryText--text">
                {{ $t('codeOfConduct.cocVersions.documentLink') }}
              </th>
              <th class="text-subtitle-2 primaryText--text">
                {{ $t('codeOfConduct.cocVersions.uploadAt') }}
              </th>
              <!-- delete column -->
              <!-- <th class="text-subtitle-2 primaryText--text">
                {{ $t('codeOfConduct.cocVersions.deleteDocument') }}
              </th> -->
            </tr>
          </thead>
          <tbody>
            <tr v-for="version in versions" :key="version.id">
              <td>v.{{ formatVersionNumber(version.version_number) }}</td>

              <td>{{ version.admin_name }}</td>
              <td>
                <v-icon :color="version.active_flag ? 'success' : 'error'">
                  {{
                    version.active_flag
                      ? 'mdi-check-circle'
                      : 'mdi-close-circle'
                  }}
                </v-icon>
              </td>
              <td>
                <a
                  class="primaryText--text text-decoration-underline"
                  @click.prevent="openPdf(version.file_path)"
                >
                  <v-icon>mdi-file-pdf-box</v-icon>
                  {{ $t('codeOfConduct.cocVersions.viewPDFFile') }}
                </a>
              </td>
              <td>{{ formatDate(version.created_at) }}</td>
              <!-- <td>
                <v-btn
                  icon
                  color="error"
                  @click="confirmDelete(version)"
                  v-on="on"
                >
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </td> -->
            </tr>
          </tbody>
        </template>
      </v-simple-table>
    </div>

    <!-- Add confirmation dialog -->
    <v-dialog v-model="deleteDialog" max-width="500">
      <v-card :class="$vuetify.theme.dark ? 'primary' : ''">
        <v-card-title class="text-h6">
          {{ $t('codeOfConduct.cocVersions.confirmDelete') }}
        </v-card-title>

        <v-divider></v-divider>

        <v-card-text class="py-5">
          {{ $t('codeOfConduct.cocVersions.deleteWarning') }}
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions class="py-3">
          <v-spacer></v-spacer>
          <v-btn
            class="mx-3 px-5 text-capitalize"
            @click="deleteDialog = false"
          >
            {{ $t('codeOfConduct.cocVersions.deleteCancel') }}
          </v-btn>
          <v-btn
            class="px-5 text-capitalize"
            color="error"
            @click="deleteVersion"
          >
            {{ $t('codeOfConduct.cocVersions.deleteConfirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- PDF Viewer -->
    <v-dialog v-model="pdfDialog" max-width="850">
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
            height="600"
            style="border: none"
          ></iframe>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
import { extend, localize } from 'vee-validate'
import { ext, numeric, size, required } from 'vee-validate/dist/rules'
import { mapState } from 'vuex'

// Override the default message.
extend('ext', {
  ...ext,
})
extend('size', {
  ...size,
})
extend('required', {
  ...required,
})
extend('numeric', {
  ...numeric,
})

localize({
  en: {
    messages: {
      ext: 'Should be a PDF file!',
      size: "File size shouldn't exceed 25MB!",
      required: 'This field is required!',
      numeric: 'This field should be a whole number!',
    },
  },
  ar: {
    messages: {
      ext: 'يجب أن يكون نوع الملف، PDF!',
      size: 'حجم الملف يجب أن يكون أقل من 25 ميجا بايت!',
      required: 'هــذا حــقل مطــلوب!',
      numeric: 'هذا الحقل يجب أن يحتوي على رقم صحيح!',
    },
  },
})

export default {
  layout: 'codeOfConduct',
  data() {
    return {
      overlay: false,
      dialog: false,
      cocDocument: null,
      versionNumber: null,
      versions: [],
      pdfDialog: false,
      selectedPdfUrl: '',
      deleteDialog: false,
      selectedVersion: null,
    }
  },

  computed: {
    ...mapState({
      isCOCAdmin: (state) => state.portal.isCOCAdmin,
    }),
  },

  created() {
    // check authorization
    if (!this.isCOCAdmin) {
      this.$router.push(this.localePath('/code-of-conduct/coc-form'))
    }
  },
  async mounted() {
    await this.loadVersions()
  },
  methods: {
    async saveCoCDocument() {
      this.dialog = false

      this.overlay = true

      const adminID = localStorage.getItem('employeeCode')
      const adminName = localStorage.getItem('userFullName')

      const cocDocumentData = {
        cocFile: this.cocDocument,
        adminName,
        adminID,
        versionNumber: this.versionNumber,
      }

      await this.$store.dispatch('coc/saveCoCDocument', cocDocumentData)

      this.cocDocument = null
      this.versionNumber = null
      this.overlay = false

      await this.loadVersions()
    },

    async loadVersions() {
      this.overlay = true
      this.versions = await this.$store.dispatch('coc/fetchCoCVersions')
      this.overlay = false
    },

    formatDate(dateString) {
      const options = {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Riyadh', // Set to Saudi Arabia timezone (UTC+3)
      }

      const formatter = new Intl.DateTimeFormat('en-US', options)

      // Convert database UTC date to local Saudi time
      const date = new Date(dateString)
      return formatter.format(date)
    },

    formatVersionNumber(version) {
      // Ensure version displays with at least one decimal place
      return Number(version).toFixed(1)
    },

    confirmDelete(version) {
      this.selectedVersion = version
      this.deleteDialog = true
    },

    async deleteVersion() {
      if (this.selectedVersion) {
        this.deleteDialog = false
        this.overlay = true
        await this.$store.dispatch(
          'coc/deleteCoCVersion',
          this.selectedVersion.id
        )
        this.selectedVersion = null
        this.overlay = false

        await this.loadVersions()
      }
    },

    openPdf(filePath) {
      this.selectedPdfUrl = `${this.$config.baseURL}/coc-api/coc-versions/${filePath}`
      this.pdfDialog = true
    },
  },
}
</script>
