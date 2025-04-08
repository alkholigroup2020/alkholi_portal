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

        <div>
          <v-btn
            color="success"
            class="text-capitalize"
            large
            @click="showForm = true"
          >
            {{ $t('codeOfConduct.cocForm.acknowledgmentForm') }}
          </v-btn>
        </div>
      </div>
    </v-row>

    <hr class="mt-3 mb-3" />

    <!-- subtitle -->
    <v-row>
      <v-col cols="12">
        <div class="subtitle-1 primaryText--text px-3">
          <p class="mb-0 py-1">
            {{ $t('codeOfConduct.cocForm.formIntro') }}
          </p>
        </div>
      </v-col>
    </v-row>

    <!-- the actual coc document -->
    <v-row>
      <div class="pdf-container px-3">
        <embed
          v-if="currentCoC"
          :src="`${$config.baseURL}/coc-api/coc-documents/${currentCoC.file_path}`"
          type="application/pdf"
          class="pdf-viewer"
        />
      </div>
    </v-row>

    <!-- Acknowledgment Form Dialog -->
    <v-dialog
      v-model="showForm"
      max-width="1000px"
      overlay-opacity="1"
      overlay-color="primary"
    >
      <v-card class="secondaryBG" dir="ltr" rounded="0">
        <v-card-title
          class="text-h6 text-md-h5 primaryText--text font-weight-bold text-center d-flex justify-center"
        >
          <p class="mb-1 py-3">
            {{ $t('codeOfConduct.cocForm.formTitle') }}
          </p>
        </v-card-title>

        <v-divider></v-divider>

        <v-card-text>
          <v-container>
            <!-- Employee Information Section -->
            <v-row>
              <v-col
                cols="12"
                class="text-subtitle-1 primaryText--text font-weight-bold"
              >
                {{ $t('codeOfConduct.cocForm.employeeInfo') }}
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" md="6" class="py-0">
                <v-text-field
                  v-model="formData.name"
                  disabled
                  dense
                ></v-text-field>
                <v-text-field
                  v-model="formData.position"
                  disabled
                  dense
                ></v-text-field>
                <v-text-field
                  v-model="formData.employeeID"
                  disabled
                  dense
                ></v-text-field>
              </v-col>
            </v-row>

            <!-- Acknowledgement Details Section -->
            <v-row>
              <v-col cols="12" class="text-subtitle-1 primaryText--text">
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

            <v-row>
              <v-col cols="12">
                <div>
                  <p
                    class="text-subtitle-1 primaryText--text font-weight-bold mb-0"
                  >
                    {{ $t('codeOfConduct.cocForm.acknowledgmentPreSignTitle') }}
                  </p>
                </div>
              </v-col>
              <v-col cols="12" class="pt-0 pb-5">
                <v-stepper v-model="signatureStepper">
                  <v-stepper-header>
                    <v-stepper-step :complete="signatureStepper > 1" step="1">
                      Print
                    </v-stepper-step>

                    <v-divider></v-divider>

                    <v-stepper-step :complete="signatureStepper > 2" step="2">
                      Upload
                    </v-stepper-step>

                    <v-divider></v-divider>

                    <v-stepper-step step="3">Submit</v-stepper-step>
                  </v-stepper-header>

                  <v-stepper-items>
                    <!-- step #1 -->
                    <v-stepper-content step="1">
                      <div>
                        <p class="text-subtitle-1 primaryText--text">
                          Please click the print button below, print the
                          document, sign it, then click next.
                        </p>
                      </div>
                      <div class="d-flex align-center pb-2">
                        <div>
                          <v-btn
                            class="text-capitalize"
                            color="primary"
                            :loading="generatingForm"
                            @click="generateAndPrint"
                          >
                            <v-icon left>mdi-printer</v-icon>
                            Print Form
                          </v-btn>
                        </div>
                        <div class="mx-3">
                          <v-btn
                            class="text-capitalize"
                            color="primary"
                            @click="signatureStepper = 2"
                          >
                            Next
                          </v-btn>
                        </div>
                      </div>
                    </v-stepper-content>

                    <!-- step #2 -->
                    <v-stepper-content step="2">
                      <div>
                        <p class="text-subtitle-1 primaryText--text">
                          Upload the signed form here.
                        </p>
                      </div>
                      <div class="d-flex align-center pb-2">
                        <div>
                          <v-btn
                            class="text-capitalize"
                            color="primary"
                            @click="signatureStepper = 3"
                          >
                            Next
                          </v-btn>
                        </div>
                      </div>
                    </v-stepper-content>

                    <!-- step #3 -->
                    <v-stepper-content step="3">
                      <!--  -->
                    </v-stepper-content>
                  </v-stepper-items>
                </v-stepper>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>

        <v-divider></v-divider>
        <!-- <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="showForm = false">
            {{ $t('codeOfConduct.cocForm.cancel') }}
          </v-btn>
          <v-btn color="primary" :disabled="!formValid" @click="submitForm">
            {{ $t('codeOfConduct.cocForm.submit') }}
          </v-btn>
        </v-card-actions> -->
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
export default {
  layout: 'codeOfConduct',
  data() {
    return {
      overlay: false,
      currentCoC: null,
      generatingForm: false,
      showForm: false,
      formData: {
        name: 'Fawzy Mohamed', // Will be populated from HR sync later
        position: 'Senior Full Stack Web Developer', // Will be populated from HR sync later
        employeeID: 'B11088', // Will be populated from HR sync later

        date: new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),

        // signature: '',
      },
      signatureStepper: 1,
    }
  },
  computed: {
    formValid() {
      // Basic validation for future implementation
      return this.formData.signature.trim() !== ''
    },
  },

  async mounted() {
    await this.loadDocument()
  },
  methods: {
    async loadDocument() {
      try {
        this.overlay = true
        const versions = await this.$store.dispatch('coc/fetchCoCVersions')
        this.currentCoC = versions.find((v) => v.active_flag)
        this.overlay = false
        if (!this.currentCoC) throw new Error('No active CoC found!')
      } catch (error) {
        this.overlay = false
        this.$store.dispatch('appNotifications/addNotification', {
          type: 'error',
          message: 'No active Code of Conduct document found!',
        })
      }
    },

    async generateAndPrint() {
      this.generatingForm = true
      try {
        // Call server to generate PDF
        const response = await this.$axios.post(
          '/coc-api/generate-print-form',
          {
            employeeID: 'B11088',
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
    submitForm() {
      try {
        // Future implementation for form submission
        this.showForm = false
        this.$store.dispatch('appNotifications/addNotification', {
          type: 'success',
          message: 'Acknowledgement received successfully!',
        })
      } catch (error) {
        this.$store.dispatch('appNotifications/addNotification', {
          type: 'error',
          message: 'Submission failed. Please try again.',
        })
      }
    },
  },
}
</script>

<style scoped>
.pdf-container {
  height: 75vh;
  width: 100%;
}

.pdf-viewer {
  width: 100%;
  height: 100%;
  border-radius: 10px;
}
</style>
