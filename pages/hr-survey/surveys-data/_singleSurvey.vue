<template>
  <div v-if="show">
    <v-toolbar class="d-print-none" color="mainBG" height="50" flat>
      <div
        class="d-flex align-center px-xl-16"
        style="width: 100%; height: 50px"
        :class="$i18n.locale === 'ar' ? 'flex-row-reverse' : ''"
      >
        <nuxt-link
          class="text-decoration-none"
          style="height: 50px"
          :to="localePath('/hr-survey/surveys-data')"
        >
          <v-btn
            tile
            depressed
            height="100%"
            color="transparent"
            class="text-subtitle-1 text-capitalize primaryText--text"
          >
            <div
              :class="$i18n.locale === 'ar' ? 'd-flex flex-row-reverse' : ''"
            >
              <v-icon class="mr-2">mdi-keyboard-backspace</v-icon>
              <span>{{ $t('generals.back') }}</span>
            </div>
          </v-btn>
        </nuxt-link>

        <v-spacer></v-spacer>

        <!-- <v-btn
          tile
          depressed
          height="100%"
          color="transparent"
          class="text-subtitle-1 text-capitalize primaryText--text"
          @click="doPrint = !doPrint"
        >
          <span class="px-1">{{ $t('generals.print') }}</span>
          <v-icon class="ml-2">mdi-printer-outline</v-icon>
        </v-btn> -->
      </div>
    </v-toolbar>

    <v-container>
      <v-row class="pt-3 pt-md-5 px-sm-5 px-xl-12 d-print-none">
        <v-col cols="12" md="6">
          <v-card tile elevation="0" class="pa-3">
            <div class="d-flex py-2">
              <v-avatar
                style="border: 2px black solid"
                rounded
                :size="$vuetify.breakpoint.mdAndUp ? '175' : '100'"
                class="mr-3"
              >
                <v-img :src="profilePic"></v-img>
              </v-avatar>
              <div class="px-3 d-flex flex-column justify-center">
                <div>
                  <p class="primaryText--text text-subtitle-1 mb-1">
                    Employee Name:
                    {{ employeeName }}
                  </p>
                  <p class="primaryText--text text-subtitle-1 mb-1">
                    Company: {{ surveyData.answers.formData.company }}
                  </p>
                  <p class="primaryText--text text-subtitle-1 mb-1">
                    Department: {{ surveyData.answers.formData.department }}
                  </p>
                  <p class="primaryText--text text-subtitle-1 mb-1">
                    Age Group: {{ surveyData.answers.formData.ageGroup }}
                  </p>
                  <p class="primaryText--text text-subtitle-1 mb-1">
                    Service Period:
                    {{ surveyData.answers.formData.servicePeriod }}
                  </p>
                </div>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <v-row class="py-0 pt-3 pt-md-5 px-sm-5 px-xl-12 d-print-none">
        <v-col v-for="(Q, index) in filteredData" :key="index" cols="12">
          <v-divider class="mb-3 primaryText--text"></v-divider>

          <div class="d-flex flex-column align-center py-1 py-md-3">
            <p class="text-h6">{{ Q[0] }}</p>
            <v-simple-table style="width: fit-content">
              <template #default>
                <tbody>
                  <tr
                    v-for="(A, i) in Object.entries(Q[1])"
                    :key="i"
                    :class="isItArabic(A[0]) ? 'text-right' : 'text-left'"
                  >
                    <td class="text-subtitle-1 px-3 px-md-10">
                      {{
                        `${A[isItArabic(A[0]) ? '1' : '0'].replace('.', '')}`
                      }}
                    </td>
                    <td class="text-subtitle-1 px-3 px-md-10">
                      {{
                        `${A[isItArabic(A[0]) ? '0' : '1'].replace('.', '')}`
                      }}
                    </td>
                  </tr>
                </tbody>
              </template>
            </v-simple-table>
          </div>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script>
export default {
  layout: 'hrSurvey',

  asyncData({ params }) {
    const id = params.singleSurvey
    return { id }
  },

  data() {
    return {
      surveyData: {},
      show: false,
      filteredData: [],
      profilePic: '',
      employeeName: '',
    }
  },
  created() {
    this.$nextTick(async () => {
      this.$nuxt.$loading.start()
      await this.getSurveyData()
      this.show = true
      this.$nuxt.$loading.finish()
    })
  },

  methods: {
    isItArabic: (s) =>
      !/[^\u0600-\u06FF\u0020-\u0040\u005B-\u0060\u007B-\u007E]/.test(s),

    async getSurveyData() {
      try {
        const reqBody = { id: this.id }
        const request = await this.$axios.post(
          `${this.$config.baseURL}/hr-surveys-api/get-single-hr-survey`,
          reqBody
        )

        if (request.status === 200) {
          this.surveyData = request.data
          const customSurveyData = request.data.answers

          const entries = Object.entries(customSurveyData)

          entries.forEach((element) => {
            if (element[0] !== 'formData') {
              this.filteredData.push(element)
            }
          })

          if (request.data.answers.formData.employeeCode !== '') {
            const getMoreEmployeeInfo = async () => {
              try {
                const AA = {
                  code: request.data.answers.formData.employeeCode,
                }
                const moreInfo = await this.$axios.post(
                  `${this.$config.baseURL}/hr-surveys-api/get-survey-employee-data`,
                  AA
                )
                if (moreInfo.status === 200) {
                  if (
                    moreInfo.data.memberPicturePath ===
                    'anonymousProfilePicture.jpeg'
                  ) {
                    this.profilePic = `/generalPictures/anonymousProfilePicture.jpeg`
                  } else if (moreInfo.data.portalPicture) {
                    this.profilePic = `${this.$config.baseURL}portal/profile-data/${moreInfo.data.memberPicturePath}`
                  } else {
                    this.profilePic = `https://hr.alkholi.com/MenaITech/application/hrms/MenaImages/Employees_Pictures/${moreInfo.data.memberPicturePath}`
                  }

                  this.employeeName = moreInfo.data.memberInfo.employee_name_eng
                } else if (moreInfo.status === 205) {
                  this.profilePic =
                    '/generalPictures/anonymousProfilePicture.jpeg'
                  this.employeeName = 'Anonymous'
                }
              } catch (error) {
                this.profilePic =
                  '/generalPictures/anonymousProfilePicture.jpeg'
                this.employeeName = 'Anonymous'
              }
            }
            await getMoreEmployeeInfo()
          } else {
            this.profilePic = '/generalPictures/anonymousProfilePicture.jpeg'
            this.employeeName = 'Anonymous'
          }
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
