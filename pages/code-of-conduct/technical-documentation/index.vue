<template>
  <v-container fluid class="pt-5 px-5 px-md-16">
    <v-row class="py-3">
      <div class="px-5 d-flex justify-space-between" style="width: 100%">
        <div>
          <h3
            class="text-h6 text-lg-h5 primaryText--text my-2 font-weight-bold"
          >
            Technical Documentation
          </h3>
        </div>
      </div>
    </v-row>

    <hr class="mt-3 mb-3" />

    <v-row>
      <v-col cols="12">
        <v-card outlined>
          <v-card-title>
            <h4 class="text-subtitle-1 text-md-h6 font-weight-bold">
              System Overview
            </h4>
          </v-card-title>
          <v-card-text class="text-body-2 text-md-body-1">
            <p>
              The Code of Conduct application is a comprehensive system for
              managing employee acknowledgments of company policies. It
              features:
            </p>
            <ul>
              <li>Document version management by HR administrators</li>
              <li>Secure employee acknowledgment process</li>
              <li>Automated notifications and reminders</li>
              <li>Real-time status tracking and reporting</li>
              <li>Multi-language support (English & Arabic)</li>
            </ul>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-card outlined class="mt-3">
          <v-card-title>
            <h4 class="text-subtitle-1 text-md-h6 font-weight-bold">
              Workflow Diagrams
            </h4>
          </v-card-title>
          <v-card-text class="text-body-2 text-md-body-1">
            <p class="mb-4">Employee Acknowledgment Process:</p>
            <pre class="mermaid">
              graph TD
                  A[Employee Logs In] --> B[Views CoC Document]
                  B --> C[Downloads/Prints Form]
                  C --> D[Signs Form]
                  D --> E[Uploads Signed Form]
                  E --> F[System Processes Form]
                  F --> G{HR Admin Review}
                  G -->|Approved| H[Update Status & Notify Employee]
                  G -->|Rejected| I[Request Resubmission]
                  I --> B
            </pre>

            <p class="mt-8 mb-4">Document Version Management:</p>
            <pre class="mermaid">
              graph TD
                  A[HR Admin Uploads New Version] --> B[System Validates Document]
                  B --> C{Version Check}
                  C -->|Unique Version| D[Save Document]
                  C -->|Duplicate Version| E[Show Error]
                  D --> F[Update Active Version]
                  F --> G[Notify Employees]
                  G --> H[Track Acknowledgments]
            </pre>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-card outlined class="mt-3">
          <v-card-title>
            <h4 class="text-subtitle-1 text-md-h6 font-weight-bold">
              API Endpoints
            </h4>
          </v-card-title>
          <v-card-text>
            <v-expansion-panels>
              <v-expansion-panel>
                <v-expansion-panel-header class="text-body-2 text-md-body-1">
                  Document Management Endpoints
                </v-expansion-panel-header>
                <v-expansion-panel-content>
                  <ul class="text-body-2 text-md-body-1">
                    <li>
                      <code>POST /coc-api/save-coc-document</code>
                      <p>
                        Saves a new CoC version. Requires PDF file, version
                        number, and admin details. Validates uniqueness and file
                        type.
                      </p>
                    </li>
                    <li>
                      <code>GET /coc-api/get-coc-versions</code>
                      <p>
                        Retrieves all CoC versions ordered by creation date.
                      </p>
                    </li>
                    <li>
                      <code>DELETE /coc-api/delete-version/:id</code>
                      <p>
                        Deletes a specific CoC version. Handles both file and
                        database record deletion.
                      </p>
                    </li>
                  </ul>
                </v-expansion-panel-content>
              </v-expansion-panel>

              <v-expansion-panel>
                <v-expansion-panel-header
                  >Employee Form Management</v-expansion-panel-header
                >
                <v-expansion-panel-content>
                  <ul>
                    <li>
                      <code>POST /coc-api/upload-signed-form</code>
                      <p>Handles signed form uploads. Process:</p>
                      <ol>
                        <li>Validates file (PDF, max 5MB)</li>
                        <li>Appends signature to CoC document</li>
                        <li>Stores metadata</li>
                        <li>Notifies HR admins</li>
                        <li>Creates submission history record</li>
                      </ol>
                    </li>
                    <li>
                      <code>POST /coc-api/generate-print-form</code>
                      <p>
                        Generates a printable acknowledgment form with employee
                        details.
                      </p>
                    </li>
                  </ul>
                </v-expansion-panel-content>
              </v-expansion-panel>

              <v-expansion-panel>
                <v-expansion-panel-header
                  >Admin Actions</v-expansion-panel-header
                >
                <v-expansion-panel-content>
                  <ul>
                    <li>
                      <code>POST /coc-api/approve-signature</code>
                      <p>Approves a pending submission:</p>
                      <ul>
                        <li>Updates signature status</li>
                        <li>Records approval metadata</li>
                        <li>Sends confirmation email to employee</li>
                      </ul>
                    </li>
                    <li>
                      <code>POST /coc-api/reject-signature</code>
                      <p>Rejects a submission:</p>
                      <ul>
                        <li>Updates signature status</li>
                        <li>
                          Sends rejection notification with resubmission
                          instructions
                        </li>
                        <li>
                          Maintains rejection record in submission history
                        </li>
                      </ul>
                    </li>
                    <li>
                      <code>GET /coc-api/get-submissions-history</code>
                      <p>
                        Retrieves submission history with filtering options.
                      </p>
                    </li>
                    <li>
                      <code>GET /coc-api/export-report</code>
                      <p>
                        Generates reports in multiple formats (CSV, XLSX, PDF)
                        for signed/unsigned employees.
                      </p>
                    </li>
                  </ul>
                </v-expansion-panel-content>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-card outlined class="mt-3">
          <v-card-title>
            <h4 class="text-subtitle-1 text-md-h6 font-weight-bold">
              Database Schema
            </h4>
          </v-card-title>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-card outlined class="mt-3">
          <v-card-title>
            <h4 class="text-subtitle-1 text-md-h6 font-weight-bold">
              Error Handling
            </h4>
          </v-card-title>
          <v-card-text class="text-body-2 text-md-body-1">
            <ul>
              <li>
                <strong>Document Upload Errors:</strong>
                <ul>
                  <li>File type validation (PDF only)</li>
                  <li>Size limits (5MB max)</li>
                  <li>Version number uniqueness</li>
                </ul>
              </li>
              <li>
                <strong>Submission Status Changes:</strong>
                <ul>
                  <li>Invalid state transitions</li>
                  <li>Missing required fields</li>
                  <li>Authentication/Authorization failures</li>
                </ul>
              </li>
              <li>
                <strong>Email Notifications:</strong>
                <ul>
                  <li>Failed delivery handling</li>
                  <li>Invalid email addresses</li>
                  <li>SMTP server issues</li>
                </ul>
              </li>
            </ul>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-card outlined class="mt-3">
          <v-card-title>
            <h4 class="text-subtitle-1 text-md-h6 font-weight-bold">
              Security Measures
            </h4>
          </v-card-title>
          <v-card-text class="text-body-2 text-md-body-1">
            <ul>
              <li>
                <strong>Authentication:</strong> Uses JWT tokens for API
                authorization
              </li>
              <li>
                <strong>File Security:</strong>
                <ul>
                  <li>PDF watermarking with employee ID</li>
                  <li>Secure file storage paths</li>
                  <li>Access control on document downloads</li>
                </ul>
              </li>
              <li>
                <strong>Admin Actions:</strong> Role-based access control for HR
                administrators
              </li>
              <li>
                <strong>Data Privacy:</strong> Encrypted storage of sensitive
                information
              </li>
            </ul>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  layout: 'codeOfConduct',
  data() {
    return {
      mermaidLoaded: false,
    }
  },
  head() {
    return {
      script: [
        {
          src: 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js',
        },
      ],
    }
  },
  mounted() {
    this.loadMermaid()
  },
  methods: {
    async loadMermaid() {
      // Wait for Mermaid to be available
      while (!window.mermaid) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      if (!this.mermaidLoaded) {
        this.mermaidLoaded = true
        window.mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          themeVariables: {
            primaryColor: '#1976d2',
            primaryTextColor: '#fff',
            primaryBorderColor: '#1976d2',
            lineColor: '#1976d2',
            secondaryColor: '#90caf9',
          },
        })

        // Find all Mermaid diagrams and render them sequentially
        const elements = document.getElementsByClassName('mermaid')
        for (const element of elements) {
          try {
            const graphDefinition = element.textContent.trim()
            const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
            element.innerHTML = '' // Clear existing content
            const { svg } = await window.mermaid.render(id, graphDefinition)
            await new Promise((resolve) => setTimeout(resolve, 100)) // Add small delay between renders
            element.innerHTML = svg
          } catch (error) {
            this.$store.dispatch('appNotifications/addNotification', {
              type: 'error',
              message: 'Failed to render Mermaid diagram',
            })
          }
        }
      }
    },
  },
}
</script>

<style scoped>
.primaryText--text {
  color: #1976d2;
}
.mermaid {
  background-color: #fff;
  padding: 20px;
  border-radius: 4px;
  width: 100%;
  display: flex;
  justify-content: center;
  font-size: 14px;
}
@media (min-width: 960px) {
  .mermaid {
    font-size: 16px;
  }
}
::v-deep svg {
  max-width: 100%;
  height: auto;
}
</style>
