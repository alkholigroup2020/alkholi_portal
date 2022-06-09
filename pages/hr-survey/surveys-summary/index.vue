<template>
  <div>
    <v-toolbar class="d-print-none" color="mainBG" height="50" flat>
      <div
        class="d-flex align-center px-xl-16"
        style="width: 100%; height: 50px"
      >
        <v-spacer></v-spacer>
        <v-btn
          id="no-background-hover"
          tile
          depressed
          height="100%"
          color="transparent"
          class="text-subtitle-1 text-capitalize primaryText--text"
          @click="constructExportedData"
        >
          <span class="px-1">{{ $t('generals.export') }}</span>
          <v-icon color="primary" class="ml-2">mdi-export</v-icon>
        </v-btn>
      </div>
      <!-- <v-btn
        id="no-background-hover"
        tile
        depressed
        height="100%"
        color="transparent"
        class="text-subtitle-1 text-capitalize primaryText--text"
        @click="printResults"
      >
        <span>Print</span>
        <v-icon color="primary" class="ml-2">mdi-printer-outline</v-icon>
      </v-btn> -->
    </v-toolbar>

    <div class="pb-3 pb-md-5 px-3 px-sm-5 px-xl-12 py-0">
      <div v-for="(Q, index) in filteredData" :key="index">
        <v-divider v-if="index != 0" class="mb-1 primary noPrint"></v-divider>
        <v-divider v-if="index != 0" class="mb-3 primary noPrint"></v-divider>

        <div class="d-flex flex-column py-1 py-md-3 singlePage">
          <p class="text-h5 mt-3 text-decoration-underline">{{ Q[0] }}</p>

          <div
            v-for="(A, i) in Object.entries(Q[1])"
            :key="i"
            class="d-flex flex-column"
          >
            <hr v-if="i !== 0" class="mt-5" />

            <p class="pt-10 text-subtitle-1 text-md-body-2">{{ A[0] }}</p>

            <div
              :style="
                $vuetify.breakpoint.mdAndDown ? 'width: 100%' : 'width: 66%'
              "
            >
              <dataChart :title="A[0]" :chart-values="getChartValues(A[0])" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div hidden>
      <a
        ref="fileDownload"
        download
        :href="`${$config.baseURL}/hr-surveys-api/exported-csv-data/results-summary.csv`"
        >File Download</a
      >
    </div>
  </div>
</template>

<script>
export default {
  layout: 'hrSurvey',
  data() {
    return {
      filteredData: [],
      completeData: [],
      exportingData: [],
    }
  },
  created() {
    this.$nextTick(async () => {
      this.$nuxt.$loading.start()
      await this.getSurveysData()
      this.$nuxt.$loading.finish()
    })
  },
  methods: {
    async constructExportedData() {
      try {
        this.exportingData = []
        for (let index = 0; index < this.filteredData.length; index++) {
          const Q = this.filteredData[index]
          const R = Object.entries(Q[1])
          R.forEach((element) => {
            const O = {}
            const T = this.getChartValues(element[0])
            O[`${element[0]}`] = T
            this.exportingData.push(O)
          })
        }
        const payload = this.exportingData
        const request = await this.$axios.post(
          `${this.$config.baseURL}/hr-surveys-api/export-csv-data`,
          payload
        )
        if (request.status === 200) {
          this.$refs.fileDownload.click()
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
    async getSurveysData() {
      try {
        const request = await this.$axios.get(
          `${this.$config.baseURL}/hr-surveys-api/get-hr-survey-data`
        )

        if (request.status === 200) {
          this.completeData = request.data

          // get an english version from the survey results
          for (let index = 0; index < request.data.length; index++) {
            const element = request.data[index]
            if (element.answers.Communication) {
              const customSurveyData = element.answers

              const entries = Object.entries(customSurveyData)

              entries.forEach((element) => {
                if (element[0] !== 'formData') {
                  this.filteredData.push(element)
                }
              })
              break
            }
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
    getChartValues(data) {
      let arData
      if (data === "Alkholi Group's goals and objectives are clear.") {
        arData = `لدي فهم واضح لأهداف وطموحات مجموعة شركات الخولي.`
      } else if (
        data === 'Alkholi group leadership provides a clear sense of direction.'
      ) {
        arData = `تُقدم الإدارة التنفيذية لمجموعة الخولي حسًا توجيهيًا واضحًا.`
      } else if (
        data ===
        "The executive management are achieving Alkholi group's goals in change management."
      ) {
        arData = `الإدارة التنفيذية تعمل على تحقيق أهداف مجموعة الخولي في إدارة التغيير.`
      } else if (
        data ===
        'Alkholi group executive management generally understands the problems we face on our jobs.'
      ) {
        arData = `تتفهم الإدارة التنفيذية لمجموعة الخولي بشكل عام المشاكل والتحديات التي نواجهها في عملنا اليومي.`
      } else if (
        data ===
        "Alkholi group's commitment to quality is apparent in what we do on a day-to-day basis."
      ) {
        arData = `يتجلى التزام مجموعة الخولي بتحقيق الجودة في ما نقوم به من أعمال على أساس يومي.`
      } else if (
        data ===
        'Our internal processes helps in providing the best service to our external customers.'
      ) {
        arData = `تتيح لنا العمليات والإجراءات الإدارية الداخلية تقديم أفضل خدمة ممكنة لعملائنا الخارجيين.`
      } else if (
        data ===
        'Communication at Alkholi group is a two-way street, where the management speaks to the workers and listens to them efficiently.'
      ) {
        arData = `التواصل في مجموعة الخولي يتم في اتجاهين، حيث تتواصل الإدارة التنفيذية مع الموظفين وتستمع إليهم بكل كفاءة.`
      } else if (
        data ===
        "I am regularly informed of Alkholi group's Plans and achievements."
      ) {
        arData = `أنا مطلّع بشكل دائم على تحديثات خطط وأهداف مجموعة الخولي.`
      } else if (
        data === 'Morale & Engagement in Alkholi group is generally high.'
      ) {
        arData = `بشكل عام، الروح المعنوية والإنتماء للشركة يعتبر عالي في مجموعة الخولي.`
      } else if (data === 'I am treated with respect by my colleagues.') {
        arData = `الاحترام هو أساس ا لمعاملة بين الزملاء.`
      } else if (data === 'Alkholi group energizes me to go the extra mile.') {
        arData = ' أجد التشجيع المناسب لتقديم الأفضل في عملي.'
      } else if (
        data ===
        'I have the equipment/tools/resources I need to do my job effectively.'
      ) {
        arData = `لدي المعدات/الأدوات/الموارد التي أحتاج إليها للقيام بعملي بفعالية.`
      } else if (data === 'I work with a cooperative and hardworking team.') {
        arData = `أنتمي إلى فريق عمل متعاون ومتفاني.`
      } else if (data === 'My department operates efficiently.') {
        arData = `الإدارة التي اعمل فيها تُدار بفعالية.`
      } else if (data === 'I feel involved in decisions that affect my work.') {
        arData = `أنا راضٍ عن مدى إشراكي في اتخاذ القرارات التي تؤثر على عملي.`
      } else if (data === 'My job responsibilities are clear.') {
        arData = `لدي المعرفة التامة بمسؤولياتي الوظيفية.`
      } else if (
        data ===
        "My Salary is considered fair compared to the job I'm assigned to."
      ) {
        arData = `الراتب الذي أستلمه مناسب للوظيفة التي أعمل بها.`
      } else if (
        data ===
        'I think Alkholi group is doing a good job of integrating new colleagues into the company.'
      ) {
        arData = `أعتقد أن مجموعة الخولي تعمل على اندماج الزملاء الجدد بشكل جيد.`
      } else if (
        data === 'People in my work group have the skills we need to succeed.'
      ) {
        arData = `يتمتع زملائي في مجموعة العمل بالمهارات التي نحتاج إليها لتحقيق النجاح.`
      } else if (
        data ===
        'Performance reviews are conducted on a regular basis in Alkholi group.'
      ) {
        arData = `يتم إجراء تقييم الأداء على أساس منتظم ووفق جدول زمني محدد في مجموعة الخولي.`
      } else if (
        data === 'I think my performance on the job is evaluated fairly.'
      ) {
        arData = `أعتقد أنه يتم تقييم أدائي في العمل بشكل عادل.`
      } else if (
        data === 'I believe that I have a long-term future with Alkholi group.'
      ) {
        arData = `أعتقد أن لدي مستقبلاً مهنيًا طويل الأمد مع مجموعة الخولي.`
      } else if (
        data ===
        'I think Alkholi group is doing a good job of retaining its most talented people.'
      ) {
        arData = `أعتقد أن مجموعة الخولي تقوم بعمل جيد فيما يتعلق بالاحتفاظ بموظفيها الأكثر موهبة.`
      } else if (
        data === 'Geographical location of Alkholi group is convenient.'
      ) {
        arData = `الموقع الجغرافي لمجموعة الخولي ملائم.`
      } else if (
        data ===
        "I'm satisfied with Alkholi group facilities (offices, workstation and space, systems and services)."
      ) {
        arData = `أنا راضٍ عن مرافق مجموعة الخولي (المكاتب ومحطات العمل والمساحات المخصصة والأنظمة والخدمات).`
      }

      const completeData = this.completeData

      let A = 0
      let B = 0
      let C = 0
      let D = 0
      let E = 0

      completeData.forEach((element) => {
        const section = Object.entries(element.answers)

        for (let index = 0; index < section.length; index++) {
          const element = section[index]
          const S = Object.entries(element[1])

          for (let i = 0; i < S.length; i++) {
            const e = S[i]

            if (e[0] === data || e[0] === arData) {
              if (e[1] === 'Strongly Agree' || e[1] === 'موافق بشدة') {
                A++
              } else if (e[1] === 'Agree' || e[1] === 'موافق') {
                B++
              } else if (
                e[1] === 'Neither Agree nor Disagree' ||
                e[1] === 'لست موافق أو غير موافق'
              ) {
                C++
              } else if (e[1] === "Don't Agree" || e[1] === 'غير موافق') {
                D++
              } else if (
                e[1] === "Strongly Don't Agree" ||
                e[1] === 'غير موافق بشدة'
              ) {
                E++
              }

              break
            }
          }
        }
      })
      return [A, B, C, D, E]
    },
  },
}
</script>

<style>
</style>