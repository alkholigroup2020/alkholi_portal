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
      <div class="upDecoration">
        <div class="text-center">
          <v-avatar tile width="225" size="150" class="mt-n5">
            <v-img
              :src="
                result.companyLogo !== 'undefined'
                  ? `${$config.baseURL}/business-cards-api/business-cards/${result.companyLogo}`
                  : '/bcard-logos/AlKholiHolding-White.png'
              "
              alt="Company Logo!"
              position="center"
              contain
              eager
            ></v-img>
          </v-avatar>
        </div>
      </div>
      <div class="content py-5 mt-n11">
        <v-row class="mt-n16">
          <v-col cols="12" class="d-flex justify-center">
            <v-avatar style="border: 3px #00ce7c solid" size="150" class="mx-5">
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
          <v-col cols="12" class="mt-n3 py-0">
            <div class="mt-n14 text-right mr-3">
              <v-btn
                elevation="3"
                fab
                color="transparent"
                small
                :ripple="false"
                :href="`${$config.baseURL}/business-cards-api/vcard/?employeeID=${result.employeeID}`"
              >
                <v-icon size="20" color="primary"
                  >mdi-content-save-all-outline</v-icon
                >
              </v-btn>
            </div>
          </v-col>
          <v-col cols="12" class="d-flex justify-center pb-0">
            <p
              class="primary--text text-center mb-1 mt-n5"
              style="font-size: 35px; font-weight: 600"
            >
              {{ result.fullName_a }}
            </p>
          </v-col>
          <v-col cols="12" class="d-flex justify-center">
            <p
              class="primary--text text-center mb-1 mt-n5"
              style="font-size: 35px; font-weight: 600"
            >
              {{ result.fullName_e }}
            </p>
          </v-col>
          <v-col cols="12" class="mt-n5 d-flex justify-center">
            <p
              class="primary--text text-center mb-2"
              style="font-size: 17px; font-weight: 400"
            >
              {{ result.arabicTitle }}
            </p>
          </v-col>
          <v-col cols="12" class="mt-n8 d-flex justify-center">
            <p
              class="primary--text text-center mb-2"
              style="font-size: 17px; font-weight: 400"
            >
              {{ result.title }}
            </p>
          </v-col>
        </v-row>
        <v-row style="font-size: 20px" class="pb-4">
          <v-col cols="12" class="d-flex justify-center pb-1">
            <a :href="`tel:00966${result.mobileNumber}`" class="textColor">
              <p class="mb-0">
                <span class="font-weight-bold">M.&nbsp;</span> +966
                {{ result.mobileNumber }}
              </p>
            </a>
          </v-col>
          <v-col
            v-if="firstLandLineCode != 'undefined'"
            cols="12"
            class="d-flex justify-center pb-1"
          >
            <a
              :href="`tel:00966${firstLandLineCode}${firstLandLineNumber}`"
              class="textColor"
            >
              <p class="mb-0">
                <span class="font-weight-bold">T.&nbsp;</span> +966
                {{ `${firstLandLineCode} ${firstLandLineNumber}` }}
              </p>
            </a>
            <span v-if="secondLandLineNumber" class="textColor"
              >&nbsp;{{ `-` }}&nbsp;</span
            >
            <a
              v-if="secondLandLineNumber"
              :href="`tel:00966${secondLandLineCode}${secondLandLineNumber}`"
              class="textColor"
            >
              <p class="mb-0">
                {{ `${secondLandLineCode} ${secondLandLineNumber}` }}
              </p>
            </a>
          </v-col>
          <v-col
            v-if="firstFaxLineCode != 'undefined'"
            cols="12"
            class="d-flex justify-center pb-1"
          >
            <a
              :href="`tel:00966${firstFaxLineCode}${firstFaxLineNumber}`"
              class="textColor"
            >
              <p class="mb-0">
                <span class="font-weight-bold">F.&nbsp;</span> +966
                {{ `${firstFaxLineCode} ${firstFaxLineNumber}` }}
              </p>
            </a>
            <span v-if="secondFaxLineNumber" class="textColor"
              >&nbsp;{{ `-` }}&nbsp;</span
            >
            <a
              v-if="secondFaxLineNumber"
              :href="`tel:00966${secondFaxLineCode}${secondFaxLineNumber}`"
              class="textColor"
            >
              <p class="mb-0">
                {{ `${secondFaxLineCode} ${secondFaxLineNumber}` }}
              </p>
            </a>
          </v-col>
          <v-col cols="12" class="d-flex justify-center pb-1">
            <a :href="`mailto:${result.mailAddress}`" class="textColor">
              <p class="mb-0">
                <span class="font-weight-bold">E.&nbsp;</span>
                {{ result.mailAddress }}
              </p>
            </a>
          </v-col>
          <v-col cols="12" class="d-flex justify-center pb-1">
            <a :href="`${result.webSite}`" target="_blank" class="textColor">
              <p class="mb-0">
                <span class="font-weight-bold">W.&nbsp;</span>
                {{ result.webSite }}
              </p>
            </a>
          </v-col>
        </v-row>
        <v-row class="mt-5 px-8 primary--text">
          <v-col cols="4" class="px-0 d-flex justify-center">
            <div>
              <v-icon :small="$vuetify.breakpoint.width < 500" color="primary"
                >mdi-twitter</v-icon
              >
              <span
                :style="
                  $vuetify.breakpoint.width < 500
                    ? 'font-size: 13px'
                    : 'font-size: 17px'
                "
                >@alkholigroup</span
              >
            </div>
          </v-col>
          <v-col cols="4" class="px-0 d-flex justify-center"
            ><div>
              <v-icon :small="$vuetify.breakpoint.width < 500" color="primary"
                >mdi-instagram</v-icon
              >
              <span
                :style="
                  $vuetify.breakpoint.width < 500
                    ? 'font-size: 13px'
                    : 'font-size: 17px'
                "
                >Al Kholi Group</span
              >
            </div></v-col
          >
          <v-col cols="4" class="px-0 d-flex justify-center"
            ><div>
              <a
                class="text-decoration-none primary--text"
                href="https://www.linkedin.com/company/alkholi-group-of-companies"
                target="_blank"
              >
                <v-icon :small="$vuetify.breakpoint.width < 500" color="primary"
                  >mdi-linkedin</v-icon
                >
                <span
                  :style="
                    $vuetify.breakpoint.width < 500
                      ? 'font-size: 13px'
                      : 'font-size: 17px'
                  "
                  >@alkholigroup</span
                >
              </a>
            </div></v-col
          >
        </v-row>
        <v-row>
          <v-col cols="12" justify-center>
            <div class="text-center">
              <v-avatar tile width="200" size="100">
                <v-img
                  src="/bcard-logos/AlKholiHolding.png"
                  alt="Company Logo!"
                  position="center"
                  contain
                  eager
                ></v-img>
              </v-avatar>
            </div>
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
  background-color: #07074e;
  height: 190px;
}
.textColor {
  color: #00ce7c;
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
