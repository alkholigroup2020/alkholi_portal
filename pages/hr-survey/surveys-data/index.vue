<template>
  <div>
    <v-toolbar class="d-print-none" color="mainBG" height="50" flat>
      <div
        class="d-flex align-center px-xl-16"
        style="width: 100%; height: 50px"
      >
        <p
          v-if="$vuetify.breakpoint.mdAndUp"
          class="text-subtitle-1 primaryText--text mb-0 pl-2"
        >
          {{ $t('hrSurvey.completedSurveys.toolbar1') }}
          <span class="text-h6">&nbsp;{{ surveysCount }}&nbsp;</span>
          {{ $t('hrSurvey.completedSurveys.toolbar2') }}
        </p>

        <v-spacer></v-spacer>

        <!-- <v-btn
          tile
          depressed
          height="100%"
          color="transparent"
          class="text-subtitle-1 text-capitalize primaryText--text"
          @click="doPrint = true"
        >
          <span class="px-1">{{ $t('generals.print') }}</span>
          <v-icon class="ml-2">mdi-printer-outline</v-icon>
        </v-btn> -->
      </div>
    </v-toolbar>

    <v-container class="d-print-none">
      <v-row class="py-3 py-md-5 px-xl-8">
        <v-col
          v-for="survey in surveysData"
          :key="survey._id"
          cols="12"
          sm="6"
          md="4"
          xl="3"
        >
          <v-card
            outlined
            elevation="1"
            class="pa-3"
            height="150"
            :to="`surveys-data/${survey._id}`"
          >
            <div class="d-flex py-2">
              <v-avatar rounded size="80">
                <v-img
                  max-height="100"
                  :src="survey.picturePath"
                  alt="John"
                ></v-img>
              </v-avatar>
              <div class="px-3 d-flex flex-column justify-center">
                <div>
                  <p class="primaryText--text text-subtitle-1 mb-1">
                    {{ survey.employeeName }}
                  </p>
                  <p class="text-subtitle-2">{{ survey.employeeTitle }}</p>
                </div>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script>
export default {
  layout: 'hrSurvey',
  data() {
    return {
      surveysCount: 0,
      surveysData: [],
    }
  },

  created() {
    this.$nextTick(async () => {
      this.$nuxt.$loading.start()
      await this.getSurveysData()
      const interval = setInterval(() => {
        if (this.surveysCount === this.surveysData.length) {
          clearInterval(interval)
          this.$nuxt.$loading.finish()
        }
      }, 500)
    })
  },

  methods: {
    async getSurveysData() {
      try {
        const request = await this.$axios.get(
          `${this.$config.baseURL}/hr-surveys-api/get-hr-survey-data`
        )

        if (request.status === 200) {
          this.surveysCount = request.data.length
          request.data.forEach((element) => {
            // if the employee was anonymous
            if (element.answers.formData.employeeCode === '') {
              element.picturePath =
                '/generalPictures/anonymousProfilePicture.jpeg'
              element.employeeName = this.$t(
                'hrSurvey.completedSurveys.anonymous'
              )
              this.surveysData.push(element)
            }
            // if the employee was not anonymous
            else {
              const getMoreEmployeeInfo = async () => {
                try {
                  const request = {
                    code: element.answers.formData.employeeCode,
                  }
                  const moreInfo = await this.$axios.post(
                    `${this.$config.baseURL}/hr-surveys-api/get-survey-employee-data`,
                    request
                  )
                  if (moreInfo.status === 200) {
                    if (
                      moreInfo.data.memberPicturePath ===
                      'anonymousProfilePicture.jpeg'
                    ) {
                      element.picturePath = `/generalPictures/anonymousProfilePicture.jpeg`
                    } else if (moreInfo.data.portalPicture) {
                      element.picturePath = `${this.$config.baseURL}portal/profile-data/${moreInfo.data.memberPicturePath}`
                    } else {
                      element.picturePath = `https://hr.alkholi.com/MenaITech/application/hrms/MenaImages/Employees_Pictures/${moreInfo.data.memberPicturePath}`
                    }

                    element.employeeName =
                      moreInfo.data.memberInfo.employee_name_eng
                    element.employeeTitle =
                      moreInfo.data.titleInfo.system_desp_e
                    this.surveysData.push(element)
                  } else if (moreInfo.status === 205) {
                    element.picturePath =
                      '/generalPictures/anonymousProfilePicture.jpeg'
                    element.employeeName = this.$t(
                      'hrSurvey.completedSurveys.anonymous'
                    )
                    this.surveysData.push(element)
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
              }
              getMoreEmployeeInfo()
            }
          })
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
