<template>
  <v-container fluid class="pt-5 px-5 px-md-16">
    <!-- toolbar -->
    <v-row class="py-3">
      <div
        class="px-5 d-flex justify-space-between flex-wrap"
        style="width: 100%"
      >
        <div>
          <h3
            class="text-h6 text-lg-h5 primaryText--text my-2 font-weight-bold"
          >
            {{ $t('codeOfConduct.appPageNames.userGuide') }}
          </h3>
        </div>
      </div>
    </v-row>

    <hr class="mt-4 mb-4" />

    <!-- Introduction -->
    <v-row>
      <v-col cols="12">
        <v-card
          class="pa-5 mt-4"
          elevation="1"
          :color="$vuetify.theme.dark ? 'primary' : 'white'"
        >
          <v-card-title class="text-h6 text-md-h5 primaryText--text pb-3">
            {{ $t('codeOfConduct.userGuideContent.introTitle') }}
          </v-card-title>
          <v-card-text class="pt-2">
            <p class="body-1 primaryText--text" style="line-height: 1.7">
              {{ $t('codeOfConduct.userGuideContent.introText') }}
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <!-- For Employees -->
    <v-row>
      <v-col cols="12">
        <v-card
          class="pa-5 mt-4"
          elevation="1"
          :color="$vuetify.theme.dark ? 'primary' : 'white'"
        >
          <v-card-title class="text-h6 text-md-h5 primaryText--text pb-3">
            {{ $t('codeOfConduct.userGuideContent.forEmployeesTitle') }}
          </v-card-title>
          <v-card-text>
            <section class="mb-4 primaryText--text">
              <h3 class="text-subtitle-1 text-md-h6 secondaryText--text mb-2">
                {{ $t('codeOfConduct.userGuideContent.accessingCoCTitle') }}
              </h3>
              <p class="body-1 mb-2">
                {{ $t('codeOfConduct.userGuideContent.accessingCoCText') }}
              </p>
              <p class="body-1 mb-2">
                <em>{{
                  $t('codeOfConduct.userGuideContent.viewingCoCWatermark')
                }}</em>
              </p>
            </section>

            <section class="mb-4 primaryText--text">
              <h3 class="text-subtitle-1 text-md-h6 secondaryText--text mb-2">
                {{ $t('codeOfConduct.userGuideContent.viewingCoCTitle') }}
              </h3>
              <p class="body-1">
                {{ $t('codeOfConduct.userGuideContent.viewingCoCText') }}
              </p>
              <v-img
                src="/coc-guide/employee-access-form.png"
                :alt="$t('codeOfConduct.userGuideContent.altAccessCoC')"
                class="my-4 elevation-2"
                width="100%"
                max-width="750"
                contain
              ></v-img>
            </section>

            <section class="mb-4 primaryText--text">
              <h3 class="text-subtitle-1 text-md-h6 secondaryText--text mb-2">
                {{
                  $t(
                    'codeOfConduct.userGuideContent.acknowledgmentProcessTitle'
                  )
                }}
              </h3>
              <div>
                <h4 class="text-subtitle-1 text-decoration-underline mt-4 mb-2">
                  {{ $t('codeOfConduct.userGuideContent.step1Title') }}
                </h4>
                <p class="body-1 mb-2">
                  {{ $t('codeOfConduct.userGuideContent.step1Text') }}
                </p>
                <ul class="mb-4">
                  <li class="body-1 mb-2">
                    {{ $t('codeOfConduct.userGuideContent.step1PrintButton') }}
                  </li>
                  <li class="body-1 mb-2">
                    {{
                      $t('codeOfConduct.userGuideContent.step1DownloadButton')
                    }}
                  </li>
                </ul>

                <v-img
                  src="/coc-guide/download_print.png"
                  :alt="$t('codeOfConduct.userGuideContent.altAccessCoC')"
                  class="my-2 elevation-2"
                  width="100%"
                  max-width="800"
                  contain
                ></v-img>

                <p class="mt-2 body-1">
                  {{ $t('codeOfConduct.userGuideContent.step1Signing') }}
                </p>
                <h4 class="text-subtitle-1 text-decoration-underline mt-4 mb-2">
                  {{ $t('codeOfConduct.userGuideContent.step2Title') }}
                </h4>
                <p class="body-1">
                  {{ $t('codeOfConduct.userGuideContent.step2Text') }}
                </p>

                <v-img
                  src="/coc-guide/upload.png"
                  :alt="$t('codeOfConduct.userGuideContent.altAccessCoC')"
                  class="my-2 elevation-2"
                  width="100%"
                  max-width="800"
                  contain
                ></v-img>

                <p class="body-1">
                  <em>{{
                    $t('codeOfConduct.userGuideContent.step2FileRequirements')
                  }}</em>
                </p>
                <h4 class="text-subtitle-1 text-decoration-underline mt-4 mb-2">
                  {{ $t('codeOfConduct.userGuideContent.step3Title') }}
                </h4>
                <p class="body-1">
                  {{ $t('codeOfConduct.userGuideContent.step3Text') }}
                </p>
                <v-img
                  src="/coc-guide/uploaded.png"
                  :alt="$t('codeOfConduct.userGuideContent.altAccessCoC')"
                  class="my-2 elevation-2"
                  width="100%"
                  max-width="800"
                  contain
                ></v-img>
              </div>
            </section>

            <section class="mb-4 primaryText--text">
              <h3 class="text-subtitle-1 text-md-h6 secondaryText--text mb-2">
                {{ $t('codeOfConduct.userGuideContent.checkingStatusTitle') }}
              </h3>
              <p class="body-1">
                {{ $t('codeOfConduct.userGuideContent.checkingStatusText') }}
              </p>
              <v-img
                src="/coc-guide/status.png"
                :alt="$t('codeOfConduct.userGuideContent.altAccessCoC')"
                class="my-2 elevation-2"
                width="100%"
                max-width="800"
                contain
              ></v-img>
            </section>

            <section class="mb-4 primaryText--text">
              <h3 class="text-subtitle-1 text-md-h6 secondaryText--text mb-2">
                {{
                  $t('codeOfConduct.userGuideContent.emailNotificationsTitle')
                }}
              </h3>
              <p class="body-1">
                {{
                  $t('codeOfConduct.userGuideContent.emailNotificationsText')
                }}
              </p>
            </section>

            <section class="mb-4 primaryText--text">
              <h3 class="text-subtitle-1 text-md-h6 secondaryText--text mb-2">
                {{ $t('codeOfConduct.userGuideContent.resubmittingTitle') }}
              </h3>
              <p class="body-1">
                {{ $t('codeOfConduct.userGuideContent.resubmittingText') }}
              </p>
            </section>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <!-- For HR Administrators -->
    <v-row>
      <v-col cols="12">
        <v-card
          class="pa-5 mt-4"
          elevation="1"
          :color="$vuetify.theme.dark ? 'primary' : 'white'"
        >
          <v-card-title class="text-h6 text-md-h5 primaryText--text pb-1">
            {{ $t('codeOfConduct.userGuideContent.forAdminsTitle') }}
          </v-card-title>
          <p class="text-subtitle-2 font-italic primaryText--text px-3 mb-3">
            {{ $t('codeOfConduct.userGuideContent.forAdminsSubText') }}
          </p>
          <v-card-text>
            <section class="mb-4 primaryText--text">
              <h3 class="text-subtitle-1 text-md-h6 secondaryText--text mb-2">
                {{ $t('codeOfConduct.userGuideContent.accessingAdminTitle') }}
              </h3>
              <p class="body-1">
                {{ $t('codeOfConduct.userGuideContent.accessingAdminText') }}
              </p>
              <v-img
                src="/coc-guide/admin-nav-links.png"
                :alt="$t('codeOfConduct.userGuideContent.altAdminNav')"
                class="my-2 elevation-2"
                width="100%"
                max-width="600"
                max-height="300"
                contain
              ></v-img>
            </section>

            <section class="mb-4 primaryText--text">
              <h3 class="text-subtitle-1 text-md-h6 secondaryText--text mb-2">
                {{ $t('codeOfConduct.userGuideContent.managingVersionsTitle') }}
              </h3>
              <p class="body-1">
                {{ $t('codeOfConduct.userGuideContent.managingVersionsText') }}
              </p>
              <div class="mb-4">
                <p class="body-1 mb-3">
                  {{
                    $t('codeOfConduct.userGuideContent.managingVersionsView')
                  }}
                </p>
                <p class="body-1 mb-3">
                  {{ $t('codeOfConduct.userGuideContent.managingVersionsAdd') }}
                </p>
              </div>

              <v-row>
                <v-col cols="12" md="6">
                  <v-img
                    src="/coc-guide/admin-coc-versions-page.png"
                    :alt="
                      $t('codeOfConduct.userGuideContent.altCoCVersionsPage')
                    "
                    class="my-2 elevation-2"
                    width="100%"
                    max-height="300"
                    contain
                  ></v-img>
                </v-col>
                <v-col cols="12" md="6">
                  <v-img
                    src="/coc-guide/admin-add-version-dialog.png"
                    :alt="
                      $t('codeOfConduct.userGuideContent.altAddVersionDialog')
                    "
                    class="my-2 elevation-2"
                    width="100%"
                    max-height="300"
                    contain
                  ></v-img>
                </v-col>
              </v-row>
            </section>

            <section class="mb-4 primaryText--text">
              <h3 class="text-subtitle-1 text-md-h6 secondaryText--text mb-2">
                {{
                  $t('codeOfConduct.userGuideContent.managingSubmissionsTitle')
                }}
              </h3>
              <p class="body-1">
                {{
                  $t('codeOfConduct.userGuideContent.managingSubmissionsText')
                }}
              </p>
              <ul class="mb-4">
                <li class="body-1 mb-2">
                  {{
                    $t(
                      'codeOfConduct.userGuideContent.managingSubmissionsFilter'
                    )
                  }}
                </li>
                <li class="body-1 mb-2">
                  {{
                    $t(
                      'codeOfConduct.userGuideContent.managingSubmissionsReminders'
                    )
                  }}
                </li>
                <li class="body-1 mb-2">
                  {{
                    $t(
                      'codeOfConduct.userGuideContent.managingSubmissionsReview'
                    )
                  }}
                </li>
                <li class="body-1 mb-2">
                  {{
                    $t(
                      'codeOfConduct.userGuideContent.managingSubmissionsApprove'
                    )
                  }}
                </li>
                <li class="body-1 mb-2">
                  {{
                    $t(
                      'codeOfConduct.userGuideContent.managingSubmissionsReject'
                    )
                  }}
                </li>
              </ul>
              <v-img
                src="/coc-guide/admin-employees-list.png"
                :alt="$t('codeOfConduct.userGuideContent.altEmployeesListPage')"
                class="my-2 elevation-2"
                width="100%"
                max-width="800"
                max-height="400"
                contain
              ></v-img>
              <!-- Add more images for review/approve/reject dialogs if available -->
            </section>

            <section class="mb-4 primaryText--text">
              <h3 class="text-subtitle-1 text-md-h6 secondaryText--text mb-2">
                {{ $t('codeOfConduct.userGuideContent.viewingHistoryTitle') }}
              </h3>
              <p class="body-1">
                {{ $t('codeOfConduct.userGuideContent.viewingHistoryText') }}
              </p>
              <p class="body-1">
                <em>{{
                  $t('codeOfConduct.userGuideContent.viewingHistoryFilter')
                }}</em>
              </p>
              <v-img
                src="/coc-guide/admin-submissions-history.png"
                :alt="
                  $t('codeOfConduct.userGuideContent.altSubmissionsHistoryPage')
                "
                class="my-2 elevation-2"
                width="100%"
                max-width="800"
                max-height="350"
                contain
              ></v-img>
            </section>

            <section class="mb-4 primaryText--text">
              <h3 class="text-subtitle-1 text-md-h6 secondaryText--text mb-2">
                {{
                  $t('codeOfConduct.userGuideContent.generatingReportsTitle')
                }}
              </h3>
              <p class="body-1">
                {{ $t('codeOfConduct.userGuideContent.generatingReportsText') }}
              </p>
              <v-img
                src="/coc-guide/admin-report-generation.png"
                :alt="
                  $t('codeOfConduct.userGuideContent.altReportGenerationDialog')
                "
                class="my-2 elevation-2"
                width="100%"
                max-width="500"
                max-height="300"
                contain
              ></v-img>
            </section>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <!-- FAQ -->
    <v-row>
      <v-col cols="12">
        <v-card
          class="pa-5 mt-4"
          elevation="1"
          :color="$vuetify.theme.dark ? 'primary' : 'white'"
        >
          <v-card-title class="text-h6 text-md-h5 primaryText--text mb-5">
            {{ $t('codeOfConduct.userGuideContent.faqTitle') }}
          </v-card-title>
          <v-card-text>
            <p class="body-1 primaryText--text mb-2 font-weight-medium">
              {{ $t('codeOfConduct.userGuideContent.faqQ1') }}
            </p>
            <p class="body-1 primaryText--text mb-10">
              {{ $t('codeOfConduct.userGuideContent.faqA1') }}
            </p>

            <p class="body-1 primaryText--text mb-2 font-weight-medium">
              {{ $t('codeOfConduct.userGuideContent.faqQ2') }}
            </p>
            <p class="body-1 primaryText--text mb-10">
              {{ $t('codeOfConduct.userGuideContent.faqA2') }}
            </p>

            <p class="body-1 primaryText--text mb-2 font-weight-medium">
              {{ $t('codeOfConduct.userGuideContent.faqQ3') }}
            </p>
            <p class="body-1 primaryText--text mb-10">
              {{ $t('codeOfConduct.userGuideContent.faqA3') }}
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  layout: 'codeOfConduct',
  // head() {
  //   return {
  //     title: this.$t('codeOfConduct.appPageNames.userGuide'),
  //   }
  // },
  // created() {
  //   this.$store.dispatch(
  //     'portal/setAppBarTitle',
  //     this.$t('codeOfConduct.appPageNames.userGuide')
  //   )
  // },
}
</script>

<style scoped>
.text-h5 {
  font-weight: 500;
  margin-bottom: 1.25rem;
  line-height: 1.5;
}
.text-h6 {
  font-weight: 500;
  margin-top: 1.5rem;
  margin-bottom: 1rem;
  line-height: 1.5;
}
.body-1 {
  line-height: 1.8;
  margin-bottom: 1rem;
}
p {
  margin-bottom: 1rem;
}
section {
  margin-bottom: 2.5rem !important;
}
ul {
  padding-left: 20px;
  margin-bottom: 1.5rem;
}
li {
  margin-bottom: 0.75rem;
  line-height: 1.8;
}
.v-card-text {
  padding-top: 16px;
  padding-bottom: 24px;
}
.v-card {
  margin-bottom: 1.5rem;
}
.text-subtitle-1 {
  line-height: 1.6;
}
.text-subtitle-2 {
  line-height: 1.6;
}
/* Increase spacing for images */
.v-image {
  margin-top: 2rem !important;
  margin-bottom: 2rem !important;
}
</style>
