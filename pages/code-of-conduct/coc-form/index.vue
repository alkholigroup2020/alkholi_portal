<template>
  <v-container fluid class="pt-5 px-5 px-md-16">
    <v-overlay :value="overlay">
      <v-progress-circular indeterminate size="60"></v-progress-circular>
    </v-overlay>

    <!-- toolbar -->
    <v-row class="py-3">
      <div class="px-5 d-flex justify-space-between" style="width: 100%">
        <div>
          <h3 class="text-h6 text-md-h5 primaryText--text font-weight-bold">
            {{ $t('codeOfConduct.cocForm.title') }}
          </h3>
        </div>

        <div v-if="showContent" class="d-flex align-center justify-center">
          <div v-if="formApproved">
            <p class="text-subtitle1 success--text mx-3 mb-0">
              {{ $t('codeOfConduct.cocForm.alreadySigned') }}
            </p>
          </div>
          <div v-if="formPending">
            <p class="text-subtitle1 error--text mx-3 mb-0">
              {{ $t('codeOfConduct.cocForm.pendingApproval') }}
            </p>
          </div>
          <div>
            <v-btn
              color="success"
              class="text-capitalize"
              large
              :disabled="formApproved || formPending || noDocument"
              @click="showForm = true"
            >
              {{ $t('codeOfConduct.cocForm.acknowledgmentForm') }}
            </v-btn>
          </div>
        </div>
      </div>
    </v-row>

    <hr class="mt-3 mb-3" />

    <div v-if="showContent === true">
      <!-- subtitle -->
      <v-row>
        <v-col cols="12">
          <!-- <div class="text-subtitle1 primaryText--text px-3">
            <p class="mb-0 py-3">
              {{ $t('codeOfConduct.cocForm.formIntro') }}
            </p>
          </div> -->
          <div class="text-subtitle-1 error--text font-weight-medium px-3">
            <p class="mb-0 pt-3 pb-1">
              {{ $t('codeOfConduct.cocForm.formWarning') }}
            </p>
          </div>
        </v-col>
      </v-row>

      <!-- the actual coc document -->
      <v-row>
        <v-col cols="12">
          <div class="w-full d-flex justify-center">
            <div
              v-if="currentCoC"
              class="px-3 pdf-container"
              @contextmenu.prevent
            >
              <div class="app-header">
                <template v-if="isLoading">Loading...</template>

                <template v-else>
                  <div class="d-flex justify-space-between">
                    <div>
                      <label>
                        <input v-model="showAllPages" type="checkbox" />
                        <span v-if="$vuetify.breakpoint.lgAndUp">
                          {{ $t('codeOfConduct.cocForm.showAllPagesLG') }}
                        </span>
                        <span v-else>{{
                          $t('codeOfConduct.cocForm.showAllPagesSM')
                        }}</span>
                      </label>
                    </div>

                    <div>
                      <span v-if="showAllPages"> {{ pageCount }} page(s) </span>
                      <span v-else>
                        <button :disabled="page <= 1" @click="page--">❮</button>

                        <span class="mx-2">{{ page }} / {{ pageCount }}</span>

                        <button :disabled="page >= pageCount" @click="page++">
                          ❯
                        </button>
                      </span>
                    </div>
                  </div>
                </template>
              </div>

              <div class="app-content">
                <client-only>
                  <PdfEmbed
                    ref="pdfRef"
                    dir="ltr"
                    :page="page"
                    :source="`${$config.baseURL}/coc-api/coc-versions/${currentCoC.file_path}`"
                    @rendered="handleDocumentRender"
                  >
                  </PdfEmbed>
                </client-only>
              </div>
            </div>
          </div>
        </v-col>
      </v-row>

      <!-- Acknowledgment Form Dialog -->
      <v-dialog
        v-model="showForm"
        persistent
        max-width="1000px"
        overlay-opacity="1"
        overlay-color="primary"
      >
        <v-card dir="ltr" rounded="0" class="white">
          <v-card-title
            class="text-h6 text-md-h5 font-weight-bold text-center d-flex justify-center"
          >
            <p class="mb-1 py-3 primary--text">
              {{ $t('codeOfConduct.cocForm.formTitle') }}
            </p>
          </v-card-title>

          <hr class="mb-5" />

          <v-card-text>
            <v-container>
              <v-row>
                <v-col
                  cols="12"
                  md="6"
                  class="py-0 primary--text text-subtitle-1"
                >
                  <div>
                    <p class="mb-1">
                      <span class="font-weight-bold">Name:</span>
                      {{ formData.name_eng }}
                    </p>
                  </div>
                  <div>
                    <p class="mb-1">
                      <span class="font-weight-bold">Title:</span>
                      {{ formData.title_e }}
                    </p>
                  </div>
                  <div>
                    <p class="mb-1">
                      <span class="font-weight-bold">ID:</span>
                      {{ formData.employee_id }}
                    </p>
                  </div>
                </v-col>
              </v-row>

              <!-- Acknowledgement Details Section -->
              <v-row>
                <v-col cols="12" class="text-subtitle-1 primary--text">
                  <div>
                    <p>
                      {{ $t('codeOfConduct.cocForm.acknowledgementDetails1') }}
                    </p>
                  </div>
                  <div>
                    <p>
                      {{ $t('codeOfConduct.cocForm.acknowledgementDetails2') }}
                    </p>
                  </div>
                  <div>
                    <p class="mb-0">
                      {{ $t('codeOfConduct.cocForm.acknowledgementDetails3') }}
                    </p>
                  </div>
                </v-col>
              </v-row>

              <!-- Acknowledgement Stepper -->
              <v-row>
                <v-col cols="12">
                  <div>
                    <p
                      class="text-subtitle-1 font-weight-bold mb-0 primary--text"
                    >
                      {{
                        $t('codeOfConduct.cocForm.acknowledgmentPreSignTitle')
                      }}
                    </p>
                  </div>
                </v-col>
                <v-col cols="12" class="pb-8 pt-3">
                  <!-- :class="$vuetify.theme.dark ? 'secondaryBG outlined' : ''" -->
                  <v-stepper
                    v-model="signatureStepper"
                    class="primary--text"
                    light
                  >
                    <v-stepper-header>
                      <v-stepper-step :complete="signatureStepper > 1" step="1">
                        <span class="px-2">{{
                          $t('codeOfConduct.cocForm.formStepper.print')
                        }}</span>
                      </v-stepper-step>

                      <v-divider></v-divider>

                      <v-stepper-step :complete="signatureStepper > 2" step="2">
                        <span class="px-2">{{
                          $t(
                            'codeOfConduct.cocForm.formStepper.uploadAndSubmit'
                          )
                        }}</span>
                      </v-stepper-step>

                      <v-divider></v-divider>

                      <v-stepper-step step="3">
                        <span class="px-2">{{
                          $t('codeOfConduct.cocForm.formStepper.result')
                        }}</span>
                      </v-stepper-step>
                    </v-stepper-header>

                    <v-stepper-items>
                      <!-- step #1 -->
                      <v-stepper-content step="1" dir="auto">
                        <div>
                          <p class="text-subtitle-1 py-5">
                            {{
                              $t('codeOfConduct.cocForm.formStepper.step1msg')
                            }}
                          </p>
                        </div>
                        <div class="d-flex align-center pb-2">
                          <div>
                            <v-btn
                              class="text-capitalize px-5"
                              color="primary"
                              :loading="generatingForm"
                              @click="generateAndPrint"
                            >
                              <v-icon class="mx-2" left>mdi-printer</v-icon>
                              {{
                                $t(
                                  'codeOfConduct.cocForm.formStepper.step1print'
                                )
                              }}
                            </v-btn>
                          </div>
                          <div class="mx-3">
                            <v-btn
                              class="text-capitalize"
                              color="primary"
                              :loading="downloadingForm"
                              @click="generateAndDownload"
                            >
                              <v-icon class="mx-2" left>mdi-download</v-icon>
                              {{
                                $t(
                                  'codeOfConduct.cocForm.formStepper.step1download'
                                )
                              }}
                            </v-btn>
                          </div>
                          <div>
                            <v-btn
                              class="text-capitalize px-8"
                              color="primary"
                              @click="signatureStepper = 2"
                            >
                              {{
                                $t(
                                  'codeOfConduct.cocForm.formStepper.step1next'
                                )
                              }}
                            </v-btn>
                          </div>
                          <div>
                            <v-btn
                              class="text-capitalize px-8 mx-3"
                              color="error"
                              @click="showForm = false"
                            >
                              {{ $t('generals.cancel') }}
                            </v-btn>
                          </div>
                        </div>
                      </v-stepper-content>

                      <!-- step #2 -->
                      <v-stepper-content step="2" dir="auto">
                        <div>
                          <p class="text-subtitle-1 mb-2">
                            {{
                              $t(
                                'codeOfConduct.cocForm.formStepper.uploadLabel'
                              )
                            }}
                          </p>
                        </div>
                        <div>
                          <ValidationObserver v-slot="valid">
                            <v-form @submit.prevent="saveUploadedDocument">
                              <ValidationProvider
                                v-slot="{ errors, validate }"
                                rules="ext:pdf|size:5120|required"
                              >
                                <v-file-input
                                  v-model="uploadedDocument"
                                  show-size
                                  type="file"
                                  class="py-5"
                                  :color="
                                    $vuetify.theme.dark ? 'white' : 'primary'
                                  "
                                  :error-messages="errors[0]"
                                  accept="application/pdf"
                                  prepend-icon="mdi-file-document"
                                  :label="
                                    $t('codeOfConduct.cocForm.uploadLabel')
                                  "
                                  @input="validate"
                                ></v-file-input>

                                <div class="d-flex align-center py-3">
                                  <!-- back btn -->
                                  <v-btn
                                    class="text-capitalize mx-3 px-8"
                                    color="primary"
                                    @click="signatureStepper = 1"
                                  >
                                    {{
                                      $t(
                                        'codeOfConduct.cocForm.formStepper.step2back'
                                      )
                                    }}
                                  </v-btn>
                                  <!-- submit btn -->
                                  <v-btn
                                    :disabled="valid.invalid"
                                    color="success"
                                    class="px-5 py-0 text-capitalize"
                                    type="submit"
                                    @click="signatureStepper = 3"
                                    >{{
                                      $t('codeOfConduct.cocForm.submitBTN')
                                    }}</v-btn
                                  >
                                  <v-btn
                                    class="text-capitalize px-8 mx-3"
                                    color="error"
                                    @click="showForm = false"
                                  >
                                    {{ $t('generals.cancel') }}
                                  </v-btn>
                                </div>
                              </ValidationProvider>
                            </v-form>
                          </ValidationObserver>
                        </div>
                      </v-stepper-content>

                      <!-- step #3 -->
                      <v-stepper-content step="3" dir="auto">
                        <div>
                          <p
                            v-if="showSuccessMessage"
                            class="text-subtitle-1 success--text"
                          >
                            {{ $t('codeOfConduct.cocForm.successMessage') }}
                          </p>
                          <p v-else class="text-subtitle-1 primary--text">
                            {{ $t('codeOfConduct.cocForm.uploading') }}
                          </p>
                        </div>
                        <div class="d-flex align-center pb-2">
                          <div>
                            <v-btn
                              class="text-capitalize px-8 py-1"
                              color="primary"
                              :disabled="!showSuccessMessage"
                              :loading="!showSuccessMessage"
                              @click="showForm = false"
                            >
                              {{
                                $t(
                                  'codeOfConduct.cocForm.formStepper.step3close'
                                )
                              }}
                            </v-btn>
                          </div>
                        </div>
                      </v-stepper-content>
                    </v-stepper-items>
                  </v-stepper>
                </v-col>
              </v-row>
            </v-container>
          </v-card-text>
        </v-card>
      </v-dialog>
    </div>
    <div v-if="showContent === false">
      <!-- subtitle -->
      <v-row>
        <v-col cols="12">
          <div class="error--text px-3">
            <p class="mb-0 py-3 text-subtitle-1">
              {{ $t('codeOfConduct.cocForm.noPermission') }}
            </p>
          </div>
        </v-col>
      </v-row>
    </div>
  </v-container>
</template>

<script>
import { extend, localize } from 'vee-validate'
import { ext, size, required } from 'vee-validate/dist/rules'

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

localize({
  en: {
    messages: {
      ext: 'Should be a PDF file!',
      size: "File size shouldn't exceed 5MB!",
      required: 'This field is required!',
    },
  },
  ar: {
    messages: {
      ext: 'يجب أن يكون نوع الملف، PDF!',
      size: 'حجم الملف يجب أن يكون أقل من 5 ميجا بايت!',
      required: 'هــذا حــقل مطــلوب!',
    },
  },
})
export default {
  layout: 'codeOfConduct',

  data() {
    return {
      overlay: false,
      showContent: undefined,
      employeeId: undefined,
      currentCoC: null,
      generatingForm: false,
      downloadingForm: false,
      showForm: false,
      uploadedDocument: null,
      formData: {},
      signatureStepper: 1,
      formApproved: false,
      formPending: false,
      showSuccessMessage: false,
      noDocument: false,
      isLoading: true,
      page: 1,
      pageCount: 1,
      showAllPages: false,
      keyNavigationTimeout: null,
      keyNavigationDelay: 200, // Rate limit in millisecond
    }
  },
  computed: {
    formValid() {
      // Basic validation for future implementation
      return this.formData.signature.trim() !== ''
    },
  },
  watch: {
    showAllPages() {
      this.page = this.showAllPages ? null : 1
    },
  },

  async mounted() {
    await this.getEmployeeData()
    // Add keyboard event listener for PDF navigation
    document.addEventListener('keydown', this.handleKeyNavigation)
  },

  beforeDestroy() {
    // Clean up the event listener when component is destroyed
    document.removeEventListener('keydown', this.handleKeyNavigation)
  },

  methods: {
    // Update the keyboard navigation method with throttling
    handleKeyNavigation(event) {
      // Only navigate when PDF is loaded and not viewing all pages
      if (!this.isLoading && !this.showAllPages && this.currentCoC) {
        // If there's already a pending navigation, ignore this keypress
        if (this.keyNavigationTimeout) return

        // Navigate with left arrow key (previous page)
        if (event.key === 'ArrowLeft' && this.page > 1) {
          this.page--
          this.throttleKeyNavigation()
        }
        // Navigate with right arrow key (next page)
        else if (event.key === 'ArrowRight' && this.page < this.pageCount) {
          this.page++
          this.throttleKeyNavigation()
        }
      }
    },

    // Add this new throttling method
    throttleKeyNavigation() {
      // Set a timeout to prevent rapid navigation
      this.keyNavigationTimeout = setTimeout(() => {
        this.keyNavigationTimeout = null
      }, this.keyNavigationDelay)
    },

    async loadDocument() {
      try {
        const versions = await this.$store.dispatch('coc/fetchCoCVersions')
        this.currentCoC = versions.find((v) => v.active_flag)
        if (!this.currentCoC) throw new Error('No active CoC found!')
      } catch (error) {
        // to disable the acknowledgement button if there are no documents loaded
        this.noDocument = true
        // show the error notification
        this.$store.dispatch('appNotifications/addNotification', {
          type: 'error',
          message: 'No active Code of Conduct document found!',
        })
      }
    },

    handleDocumentRender() {
      this.isLoading = false
      this.pageCount = this.$refs.pdfRef.pageCount
    },

    async getEmployeeData() {
      try {
        this.overlay = true

        const employeeID = localStorage.getItem('employeeCode')
        const userFullName = localStorage.getItem('userFullName')
        const userMailAddress = localStorage.getItem('userMailAddress')
        const branchCode = localStorage.getItem('branchCode')
        const titleEnglish = localStorage.getItem('titleEnglish')
        const titleArabic = localStorage.getItem('titleArabic')

        this.employeeId = employeeID

        const employeeData = await this.$store.dispatch(
          'coc/fetchEmployeeData',
          {
            employeeID,
            userFullName,
            userMailAddress,
            branchCode,
            titleEnglish,
            titleArabic,
          }
        )

        this.formData = {
          ...employeeData,
          date: new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          }),
        }

        if (employeeData.employee_id) {
          await this.loadDocument()
          this.showContent = true
          if (employeeData.signature_status === 'approved') {
            this.formApproved = true
          } else if (employeeData.signature_status === 'pending') {
            this.formPending = true
          }
        } else {
          this.showContent = false
        }

        this.overlay = false
      } catch (error) {
        this.overlay = false

        this.$store.dispatch('appNotifications/addNotification', {
          type: 'error',
          message: 'Could not fetch employee data!',
        })
      }
    },

    async generateAndPrint() {
      this.generatingForm = true
      try {
        // Call server to generate PDF
        const response = await this.$axios.post(
          `${this.$config.baseURL}/coc-api/generate-print-form`,
          {
            employeeID: this.formData.employee_id,
            position: this.formData.title_e,
            name: this.formData.name_eng,
            date: this.formData.date,
          }
        )

        const pdfUrl = `${this.$config.baseURL}${response.data.url}`

        // Create an invisible iframe to handle printing
        const iframe = document.createElement('iframe')
        iframe.style.display = 'none' // Hide the iframe from the user
        document.body.appendChild(iframe) // Append it to the DOM
        iframe.src = pdfUrl // Set the iframe source to the generated PDF

        // Wait for the iframe to load the PDF, then trigger print
        iframe.onload = () => {
          iframe.contentWindow.print() // Open the browser's print dialog
          // Cleanup after printing (optional: user can close print dialog)
          // setTimeout(() => {
          //   document.body.removeChild(iframe) // Remove iframe from DOM
          //   URL.revokeObjectURL(pdfUrl) // Free up memory by revoking the Blob URL
          // }, 1000) // Delay cleanup to ensure print dialog appears
        }
      } catch (error) {
        this.$store.dispatch('appNotifications/addNotification', {
          type: 'error',
          message: 'Form generation failed. Please try again.',
        })
      } finally {
        this.generatingForm = false
      }
    },

    async generateAndDownload() {
      this.downloadingForm = true
      try {
        // Call server to generate PDF
        const response = await this.$axios.post(
          `${this.$config.baseURL}/coc-api/generate-print-form`,
          {
            employeeID: this.formData.employee_id,
            position: this.formData.title_e,
            name: this.formData.name_eng,
            date: this.formData.date,
          }
        )

        const pdfUrl = `${this.$config.baseURL}${response.data.url}`

        // Create a link element to trigger the download
        const link = document.createElement('a')
        link.href = pdfUrl
        link.download = 'Code_of_Conduct_Acknowledgment_Form.pdf'
        document.body.appendChild(link) // Append it to the DOM
        link.click() // Trigger the download
        document.body.removeChild(link) // Cleanup after download
      } catch (error) {
        this.$store.dispatch('appNotifications/addNotification', {
          type: 'error',
          message: 'Form generation failed. Please try again.',
        })
      } finally {
        this.downloadingForm = false
      }
    },

    async saveUploadedDocument() {
      try {
        const employeeID = localStorage.getItem('employeeCode')
        const employeeName = localStorage.getItem('userFullName')

        const uploadedDocData = {
          employeeID,
          employeeName,
          uploadedDocument: this.uploadedDocument,
          versionNumber: this.currentCoC.version_number,
        }

        const submit = await this.$store.dispatch(
          'coc/processSignedDocument',
          uploadedDocData
        )

        if (
          submit.message === 'Signed form uploaded and processed successfully!'
        ) {
          this.showSuccessMessage = true
          // to update the acknowledgment status right after the user submission
          await this.getEmployeeData()
        }
      } catch (error) {
        this.$store.dispatch('appNotifications/addNotification', {
          type: 'error',
          message: 'Failed to upload the signed document. Please try again.',
        })
      }
    },
  },
}
</script>

<style scoped>
/* PDF container */
.pdf-container {
  position: relative;
  width: 900px;
  max-width: 100%;
  overflow: auto;
}

@media screen and (max-width: 900px) {
  .pdf-container {
    width: 100%;
  }
}

.app-header {
  padding: 0px 12px 0px 0px;
}

.app-content {
  padding: 24px 0px;
}
</style>
