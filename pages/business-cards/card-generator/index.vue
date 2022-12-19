<template>
  <v-container fluid class="pt-5 px-5 px-md-16">
    <!-- title -->
    <v-row>
      <v-col>
        <h3 class="text-h5 primaryText--text">
          {{ $t('businessCards.cardGenerator.title') }}
        </h3>
        <hr
          class="mt-3 mb-8"
          :style="$vuetify.breakpoint.mdAndUp ? 'width: 91.5%' : ''"
        />
      </v-col>
    </v-row>
    <!-- form -->
    <ValidationObserver v-slot="{ handleSubmit }" ref="theForm">
      <v-form @submit.prevent="handleSubmit(generateCard)">
        <v-row>
          <v-col class="py-2" cols="12" md="5">
            <ValidationProvider>
              <v-text-field
                v-model="employeeID"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                outlined
                autocomplete
                :label="$t('businessCards.cardGenerator.empID')"
                dense
              ></v-text-field>
            </ValidationProvider>
          </v-col>
          <v-col class="py-2" cols="12" md="5" offset-md="1">
            <ValidationProvider v-slot="{ errors }" rules="required">
              <v-autocomplete
                v-model="company"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                :items="companies"
                :error-messages="errors[0]"
                :label="$t('businessCards.cardGenerator.company')"
                outlined
                dense
              ></v-autocomplete>
            </ValidationProvider>
          </v-col>
        </v-row>

        <v-row>
          <v-col class="py-2" cols="12" md="5">
            <ValidationProvider v-slot="{ errors }" rules="required|email">
              <v-text-field
                v-model="employeeMailAddress"
                :label="$t('businessCards.cardGenerator.empEmail')"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                outlined
                :error-messages="errors[0]"
                type="email"
                required
                dense
              ></v-text-field>
            </ValidationProvider>
          </v-col>
          <v-col class="py-2" cols="12" md="5" offset-md="1">
            <ValidationProvider
              v-slot="{ errors, validate }"
              rules="image|size:5120"
            >
              <v-file-input
                v-model="employeePicture"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                dense
                :error-messages="errors[0]"
                type="file"
                accept="image/png, image/jpeg, image/jpg"
                prepend-icon="mdi-camera"
                :label="$t('businessCards.cardGenerator.empPicture')"
                @change="validate"
              ></v-file-input>
            </ValidationProvider>
          </v-col>
        </v-row>

        <v-row>
          <v-col class="py-2" cols="12" md="5">
            <ValidationProvider
              v-slot="{ errors, validate }"
              rules="image|size:5120"
            >
              <v-file-input
                v-model="companyLogo"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                dense
                accept="image/png, image/jpeg, image/jpg"
                prepend-icon="mdi-camera"
                :label="$t('businessCards.cardGenerator.companyLogo')"
                :error-messages="errors[0]"
                type="file"
                @change="validate"
              ></v-file-input>
            </ValidationProvider>
          </v-col>
          <v-col class="py-2" cols="12" md="5" offset-md="1">
            <ValidationProvider
              v-slot="{ errors, validate }"
              rules="image|size:5120"
            >
              <v-file-input
                v-model="qrLogo"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                dense
                accept="image/png, image/jpeg, image/jpg"
                prepend-icon="mdi-camera"
                :label="$t('businessCards.cardGenerator.qrLogo')"
                :error-messages="errors[0]"
                type="file"
                @change="validate"
              ></v-file-input>
            </ValidationProvider>
          </v-col>
        </v-row>

        <v-row>
          <v-col class="py-2" cols="12" md="5">
            <ValidationProvider v-slot="{ errors }" rules="required">
              <v-text-field
                v-model="employeeEnglishName"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                :label="$t('businessCards.cardGenerator.empEnName')"
                dense
                :error-messages="errors[0]"
              ></v-text-field>
            </ValidationProvider>
          </v-col>
          <v-col class="py-2" cols="12" md="5" offset-md="1">
            <ValidationProvider v-slot="{ errors }" rules="required">
              <v-text-field
                v-model="employeeArabicName"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                :label="$t('businessCards.cardGenerator.empArName')"
                dense
                dir="rtl"
                :error-messages="errors[0]"
              ></v-text-field>
            </ValidationProvider>
          </v-col>
        </v-row>

        <v-row>
          <v-col class="py-2" cols="12" md="5">
            <ValidationProvider v-slot="{ errors }" rules="required">
              <v-text-field
                v-model="employeeEnglishTitle"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                :label="$t('businessCards.cardGenerator.empEnTitle')"
                dense
                :error-messages="errors[0]"
              ></v-text-field>
            </ValidationProvider>
          </v-col>
          <v-col class="py-2" cols="12" md="5" offset-md="1">
            <ValidationProvider v-slot="{ errors }" rules="required">
              <v-text-field
                v-model="employeeArabicTitle"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                :label="$t('businessCards.cardGenerator.empArTitle')"
                dense
                dir="rtl"
                :error-messages="errors[0]"
              ></v-text-field>
            </ValidationProvider>
          </v-col>
        </v-row>

        <v-row>
          <v-col class="py-2" cols="12" md="5">
            <ValidationProvider
              v-slot="{ errors, validate }"
              rules="required|numeric|length:9"
            >
              <v-text-field
                v-model="employeeMobileNumber"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                :label="$t('businessCards.cardGenerator.empMobile')"
                prefix="+966 "
                :error-messages="errors[0]"
                dense
                @change="validate"
              ></v-text-field>
            </ValidationProvider>
          </v-col>
          <v-col class="py-2" cols="12" md="5" offset-md="1">
            <ValidationProvider v-slot="{ errors }" rules="required">
              <v-text-field
                v-model="employeeWebSite"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                :label="$t('businessCards.cardGenerator.empWebsite')"
                :error-messages="errors[0]"
                dense
              ></v-text-field>
            </ValidationProvider>
          </v-col>
        </v-row>

        <v-row>
          <v-col class="py-2" cols="12" md="5">
            <ValidationProvider v-slot="{ errors }">
              <div v-if="company === 'BTECO'" class="pb-2">
                <p class="pa-0 ma-0 text-subtitle-2 primaryText--text">
                  {{ $t('businessCards.cardGenerator.empLandlinesMsgBTECO') }}
                </p>
              </div>
              <div v-else class="pb-2">
                <p class="pa-0 ma-0 text-subtitle-2 primaryText--text">
                  {{ $t('businessCards.cardGenerator.empLandlinesMsg') }}
                </p>
              </div>
              <v-text-field
                v-model="employeeLandLines"
                :label="$t('businessCards.cardGenerator.empLandlines')"
                prefix="+966 "
                dense
                :error-messages="errors[0]"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
              ></v-text-field>
            </ValidationProvider>
          </v-col>
          <v-col class="py-2" cols="12" md="5" offset-md="1">
            <ValidationProvider v-slot="{ errors }">
              <div class="pb-2">
                <p class="pa-0 ma-0 text-subtitle-2 primaryText--text">
                  {{ $t('businessCards.cardGenerator.empFaxMsg') }}
                </p>
              </div>
              <v-text-field
                v-model="employeeFaxLine"
                :label="$t('businessCards.cardGenerator.empFax')"
                prefix="+966 "
                dense
                :error-messages="errors[0]"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
              >
              </v-text-field>
            </ValidationProvider>
          </v-col>
        </v-row>

        <v-row>
          <v-col class="py-3" cols="12" md="5">
            <v-dialog v-model="frColorDialog" width="300" persistent>
              <template #activator="{ on, attrs }">
                <div class="d-flex align-center mb-3">
                  <v-btn
                    :color="frColor"
                    v-bind="attrs"
                    small
                    fab
                    elevation="3"
                    v-on="on"
                  >
                  </v-btn>
                  <div>
                    <span class="px-3 text-subtitle-2 primaryText--text">{{
                      $t('businessCards.cardGenerator.foregroundColor')
                    }}</span>
                  </div>
                </div>
              </template>
              <v-card>
                <v-color-picker
                  v-model="frColor"
                  dot-size="15"
                  swatches-max-height="200"
                  width="300"
                  mode="rgba"
                ></v-color-picker>
                <v-divider class="mb-2"></v-divider>
                <div class="d-flex justify-space-around pb-2">
                  <v-btn color="success" text @click="frColorDialog = false">
                    {{ $t('generals.save') }}
                  </v-btn>
                  <v-btn
                    color="warning"
                    text
                    @click=";(frColorDialog = false), (frColor = '#07074eFF')"
                  >
                    {{ $t('generals.cancel') }}
                  </v-btn>
                </div>
              </v-card>
            </v-dialog>
            <v-dialog v-model="bgColorDialog" width="300" persistent>
              <template #activator="{ on, attrs }">
                <div class="d-flex align-center">
                  <v-btn
                    :color="bgColor"
                    v-bind="attrs"
                    small
                    fab
                    elevation="3"
                    v-on="on"
                  >
                  </v-btn>
                  <div>
                    <span class="px-3 text-subtitle-2 primaryText--text">{{
                      $t('businessCards.cardGenerator.backgroundColor')
                    }}</span>
                  </div>
                </div>
              </template>
              <v-card>
                <v-color-picker
                  v-model="bgColor"
                  dot-size="15"
                  swatches-max-height="200"
                  width="300"
                  mode="rgba"
                ></v-color-picker>
                <v-divider class="mb-2"></v-divider>
                <div class="d-flex justify-space-around pb-2">
                  <v-btn color="success" text @click="bgColorDialog = false">
                    {{ $t('generals.save') }}
                  </v-btn>
                  <v-btn
                    color="warning"
                    text
                    @click=";(bgColorDialog = false), (bgColor = '#FFF')"
                  >
                    {{ $t('generals.cancel') }}
                  </v-btn>
                </div>
              </v-card>
            </v-dialog>
          </v-col>
          <v-col class="py-3" cols="12" md="5" offset-md="1">
            <ValidationProvider v-slot="{ errors, validate }" rules="numeric">
              <v-text-field
                v-model="qrSize"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                :label="$t('businessCards.cardGenerator.qrWidth')"
                suffix="pixels"
                dense
                :error-messages="errors[0]"
                @change="validate"
              ></v-text-field>
            </ValidationProvider>
          </v-col>
        </v-row>

        <!-- submit btn -->
        <v-row class="pt-5">
          <v-col class="py-1" cols="12" md="5"></v-col>
          <v-col class="py-1" cols="12" md="5" offset-md="1">
            <div class="d-flex justify-end">
              <v-btn
                :color="
                  $vuetify.theme.dark ? 'orange darken-4' : 'yellow darken-3'
                "
                type="reset"
                class="
                  py-3 py-md-5
                  px-16
                  text-subtitle-1 text-capitalize
                  white--text
                  mx-3
                "
                @click="resetValues"
              >
                {{ $t('generals.reset') }}
              </v-btn>
              <!-- v-if="!invalid" -->
              <v-btn
                :color="
                  $vuetify.theme.dark ? 'green darken-4' : 'green darken-1'
                "
                type="submit"
                class="
                  py-3 py-md-5
                  px-16
                  text-subtitle-1 text-capitalize
                  white--text
                "
              >
                {{ $t('generals.submit') }}
              </v-btn>
            </div>
          </v-col>
        </v-row>
      </v-form>
    </ValidationObserver>
  </v-container>
</template>

<script>
import { mapState } from 'vuex'
import { extend, localize } from 'vee-validate'
import {
  required,
  email,
  image,
  size,
  numeric,
  length,
} from 'vee-validate/dist/rules'

extend('required', {
  ...required,
})
extend('email', {
  ...email,
})
extend('image', {
  ...image,
})
extend('size', {
  ...size,
})
extend('numeric', {
  ...numeric,
})
extend('length', {
  ...length,
})

localize({
  en: {
    messages: {
      required: 'This field is required!',
      email: 'A valid email address is required!',
      image: 'This is not a valid image file!',
      size: 'File size exceeds the limit (5mb)',
      numeric: 'The input must have numeric values only!',
      length: 'The input length should be exactly nine numbers!',
    },
  },
  ar: {
    messages: {
      required: 'هــذا حــقل مطــلوب!',
      email: 'عنوان البريد الإلكتروني غير صالح!',
      image: 'هذا الملف غير صالح',
      size: 'حجم الملف يتخطى الحجم المسموح (5mb)',
      numeric: 'إدخال أحرف أو رموز غير مسموح!',
      length: 'عدد الأرقام يجب أن يكون تسعة أرقام فقط!',
    },
  },
})

export default {
  layout: 'businessCards',
  data() {
    return {
      result: undefined,
      employeeID: undefined,
      company: undefined,
      companies: [
        'Alkholi Group',
        'Alkholi Holding',
        'AKTEK',
        'BTECO',
        'UPMOC',
        'AMOS & SBTMC Manager',
        'AKSTRA Consulting',
        'MX Reality',
      ],
      showSnack: false,
      companyLogo: undefined,
      qrLogo: undefined,
      bgColor: '#FFFFFFFF',
      frColor: '#07074eFF',
      qrSize: undefined,
      bgColorDialog: false,
      frColorDialog: false,
      employeePicture: undefined,
      employeeArabicName: undefined,
      employeeEnglishName: undefined,
      employeeArabicTitle: undefined,
      employeeEnglishTitle: undefined,
      employeeMobileNumber: undefined,
      employeeLandLines: undefined,
      employeeMailAddress: undefined,
      employeeWebSite: undefined,
      employeeFaxLine: undefined,
    }
  },
  computed: {
    ...mapState({
      userCardID: (state) => state.businessCards.userCardID,
    }),
  },
  mounted() {
    if (this.$nuxt.context.query.id) {
      this.getEmployeeData(this.$nuxt.context.query.id)
    }
  },
  methods: {
    async generateCard() {
      try {
        this.$nextTick(async () => {
          this.$nuxt.$loading.start()
          const employeeData = {
            employeeID: this.employeeID,
            companyLogo: this.companyLogo,
            company: this.company,
            employeePicture: this.employeePicture,
            employeeArabicName: this.employeeArabicName,
            employeeEnglishName: this.employeeEnglishName,
            employeeArabicTitle: this.employeeArabicTitle,
            employeeEnglishTitle: this.employeeEnglishTitle,
            employeeMobileNumber: this.employeeMobileNumber,
            employeeLandLines: this.employeeLandLines,
            employeeMailAddress: this.employeeMailAddress,
            employeeWebSite: this.employeeWebSite,
            qrLogo: this.qrLogo,
            bgColor: this.bgColor,
            frColor: this.frColor,
            qrSize: this.qrSize,
            faxLine: this.employeeFaxLine,
          }
          await this.$store.dispatch(
            'businessCards/saveEmployeeData',
            employeeData
          )
          this.resetValues()
          this.$nuxt.$loading.finish()
          this.$router.push(`/business-card/${this.userCardID}`)
        })
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
    resetValues() {
      this.employeeID =
        this.company =
        this.employeeMailAddress =
        this.companyLogo =
        this.qrLogo =
        this.employeePicture =
        this.employeeArabicName =
        this.employeeEnglishName =
        this.employeeArabicTitle =
        this.employeeEnglishTitle =
        this.employeeMobileNumber =
        this.employeeWebSite =
        this.employeeFaxLine =
        this.qrSize =
        this.employeeLandLines =
          undefined
      this.bgColor = '#FFFFFFFF'
      this.frColor = '#07074eFF'

      this.$refs.theForm.reset()
    },
    async getEmployeeData(id) {
      try {
        const employeeData = await this.$axios.post(
          `${this.$config.baseURL}/business-cards-api/sql-call`,
          {
            query: `SELECT * FROM [businessCards].[employeeData] WHERE employeeID = '${id}'`,
          }
        )
        if (employeeData.status === 200) {
          const result = employeeData.data
          this.employeeID = result[0].employeeID
          this.company = result[0].company
          this.employeeArabicTitle = result[0].arabicTitle
          this.employeeFaxLine = result[0].faxLine
          this.employeeArabicName = result[0].fullName_a
          this.employeeEnglishName = result[0].fullName_e
          this.employeeLandLines = result[0].landLines
          this.employeeMailAddress = result[0].mailAddress
          this.employeeMobileNumber = result[0].mobileNumber
          this.employeeEnglishTitle = result[0].title
          this.employeeWebSite = result[0].webSite
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
