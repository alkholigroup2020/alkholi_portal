<template>
  <div class="pa-0 ma-0">
    <v-card
      color="white"
      class="mx-auto pb-lg-5 d-flex flex-column business-card-font"
      height="100%"
      max-width="500"
      :tile="$vuetify.breakpoint.width < 500"
      :elevation="$vuetify.breakpoint.width > 500 ? '3' : '0'"
      :class="$vuetify.breakpoint.width > 500 ? 'mt-5' : ''"
    >
      <!-- card header -->
      <div :style="`background-color: ${result.mainColor}; `">
        <div
          class="text-center"
          style="padding-top: 50px; padding-bottom: 70px"
        >
          <v-avatar tile width="250" height="100" class="mt-n5">
            <v-img
              :src="
                result.companyLogo !== 'undefined'
                  ? `${$config.baseURL}/business-cards-api/business-cards/${result.companyLogo}`
                  : ''
              "
              alt="Company Logo!"
              position="center"
              contain
              eager
            ></v-img>
          </v-avatar>
          <div>
            <p class="white--text pt-3">
              Permanent Delegation of Grenada to UNESCO
            </p>
          </div>
        </div>
      </div>
      <div class="content py-5 mt-n11">
        <v-row class="mt-n16">
          <!-- employee image -->
          <v-col cols="12" class="d-flex justify-center">
            <v-avatar
              size="150"
              :style="` border: 5px ${result.mainColor} solid `"
              class="mx-5"
            >
              <v-img
                :src="
                  result.profilePic
                    ? `${$config.baseURL}/business-cards-api/business-cards/${result.profilePic}`
                    : `${$config.baseURL}/portal-api/profile-data/profile.png`
                "
                alt="Profile Image"
                position="top"
              ></v-img>
            </v-avatar>
          </v-col>

          <!-- save to contacts btn -->
          <v-col cols="12" class="mt-n3 py-0">
            <div class="mt-n14 text-right mr-3">
              <v-btn
                elevation="3"
                fab
                color="transparent"
                small
                :ripple="false"
                :href="`${
                  $config.baseURL
                }/business-cards-api/vcard/?employeeID=${
                  result.employeeID
                }&firstAddress=${encodeURIComponent(
                  'Maison de I\'UNESCO 1, rue Miollis'
                )}&secondAddress=${encodeURIComponent(
                  '75732 PARIS Cedex 15, France'
                )}`"
              >
                <v-icon size="20" color="primary"
                  >mdi-content-save-all-outline</v-icon
                >
              </v-btn>
            </div>
          </v-col>

          <!-- ar name -->
          <v-col
            v-if="result.fullName_a"
            cols="12"
            class="d-flex justify-center pb-0"
          >
            <p
              class="primary--text text-center mb-1 mt-n5"
              style="font-size: 35px; font-weight: 600"
            >
              {{ result.fullName_a }}
            </p>
          </v-col>

          <!-- name -->
          <v-col
            v-if="result.fullName_e"
            cols="12"
            class="d-flex justify-center"
          >
            <p
              class="primary--text text-center mb-3 mt-n1"
              style="font-size: 35px; font-weight: 600"
            >
              {{ result.fullName_e }}
            </p>
          </v-col>

          <!-- ar title -->
          <v-col
            v-if="result.arabicTitle"
            cols="12"
            class="mt-n5 d-flex justify-center"
          >
            <p
              class="primary--text text-center mb-2"
              style="font-size: 17px; font-weight: 400"
            >
              {{ result.arabicTitle }}
            </p>
          </v-col>

          <!-- en title -->
          <v-col
            v-if="result.title"
            cols="12"
            class="mt-n9 d-flex justify-center"
          >
            <div style="max-width: 80%">
              <p
                class="primary--text text-center mb-2"
                style="font-size: 17px; font-weight: 400"
              >
                {{ result.title }}
              </p>
            </div>
          </v-col>
        </v-row>

        <v-row style="font-size: 20px" class="pb-0">
          <!-- mobile number -->
          <v-col
            v-if="result.mobileNumber"
            cols="12"
            class="d-flex justify-center pb-3"
          >
            <a :href="`tel:${result.mobileNumber}`" class="textColor">
              <p class="mb-0">
                <span class="font-weight-bold">Mobile:&nbsp;</span>
                {{ result.mobileNumber }}
              </p>
            </a>
          </v-col>

          <!-- firstLandLineCode -->
          <v-col
            v-if="firstLandLineCode != 'undefined'"
            cols="12"
            class="d-flex justify-center pt-0 pb-3"
          >
            <a :href="`tel:${firstLandLineCode}`" class="textColor">
              <p class="mb-0">
                <span class="font-weight-bold">Tel.:&nbsp;</span
                >{{ `${firstLandLineCode}` }}
              </p>
            </a>
          </v-col>

          <!-- mailAddress -->
          <v-col
            v-if="result.mailAddress"
            cols="12"
            class="d-flex justify-center pb-2"
          >
            <a :href="`mailto:${result.mailAddress}`" class="textColor">
              <p class="mb-0 text-center">
                <span class="font-weight-bold">Email:&nbsp;</span>
                {{ result.mailAddress }}
              </p>
            </a>
          </v-col>

          <!-- private mailAddress -->
          <v-col cols="12" class="d-flex justify-center pt-0">
            <a :href="`mailto:hbkholi@gmail.com`" class="textColor">
              <p class="mb-0 text-center">
                <span class="font-weight-bold">Private email:&nbsp;</span>
                hbkholi@gmail.com
              </p>
            </a>
          </v-col>

          <!-- Addresses -->
          <v-col cols="12" class="d-flex justify-center pt-4">
            <p class="mb-0" style="font-size: 17px">
              Maison de I'UNESCO 1, rue Miollis
            </p>
          </v-col>
          <v-col cols="12" class="d-flex justify-center pt-0 mt-n2 pb-8">
            <p class="mb-0" style="font-size: 17px">
              75732 PARIS Cedex 15, France
            </p>
          </v-col>
        </v-row>
      </div>
    </v-card>

    <div v-if="justGenerated" class="backButton">
      <v-btn large icon color="transparent" @click="$router.go(-1)">
        <v-icon size="55" color="secondary">mdi-arrow-left-circle</v-icon>
      </v-btn>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    result: {
      type: Object,
      default() {
        return {}
      },
    },
  },
  data() {
    return {
      landLineToCall: '',
      firstLandLineCode: null,
      firstLandLineNumber: null,
      secondLandLineCode: null,
      secondLandLineNumber: null,
      firstFaxLineCode: null,
      firstFaxLineNumber: null,
      secondFaxLineCode: null,
      secondFaxLineNumber: null,
      justGenerated: false,
    }
  },
  mounted() {
    if (this.$nuxt.context.from) {
      if (this.$nuxt.context.from.path.includes('card-generator')) {
        this.justGenerated = true
      }
    }

    if (this.result.landLines) {
      this.splitLandLines()
    }

    if (this.result.faxLine) {
      this.splitFaxLines()
    }
  },
  methods: {
    splitLandLines() {
      const A = this.result.landLines.split(' ')
      this.firstLandLineCode = A[0]
      this.firstLandLineNumber = A[1]
      this.secondLandLineCode = A[3]
      this.secondLandLineNumber = A[4]
    },
    splitFaxLines() {
      const A = this.result.faxLine.split(' ')
      this.firstFaxLineCode = A[0]
      this.firstFaxLineNumber = A[1]
      this.secondFaxLineCode = A[3]
      this.secondFaxLineNumber = A[4]
    },
  },
}
</script>

<style lang="scss" scoped>
.upDecoration {
  // background-color: #07074e;
  // height: 190px;
}
.textColor {
  color: #000;
  text-decoration: none;
}
.backButton {
  position: fixed;
  top: 33px;
  left: 30%;
}
@media screen and (max-width: 1650px) {
  .backButton {
    left: 25%;
  }
}
@media screen and (max-width: 1320px) {
  .backButton {
    left: 15%;
  }
}
@media screen and (max-width: 950px) {
  .backButton {
    left: 3%;
  }
}
</style>
