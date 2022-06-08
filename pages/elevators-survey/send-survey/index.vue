<template>
  <v-container>
    <v-row class="pt-2 pt-md-3 px-3 px-md-8 px-lg-15">
      <v-col cols="12">
        <p class="text-h6 mb-0 text-md-h5 primaryText--text">
          {{ $t('elevatorsSurvey.sendSurvey.title') }}
        </p>
      </v-col>
      <hr class="mt-n1 mb-8" style="width: 100%" />
    </v-row>
    <ValidationObserver v-slot="{ handleSubmit }" ref="surveyRequestForm">
      <v-form @submit.prevent="handleSubmit(sendSurvey)">
        <v-row class="px-3 px-md-8 px-lg-15">
          <v-col cols="12" sm="8" lg="6" xl="5">
            <ValidationProvider v-slot="{ errors }" rules="required">
              <v-text-field
                v-model="clientName"
                :label="$t('elevatorsSurvey.sendSurvey.clientName')"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                outlined
                :error-messages="errors[0]"
                dense
              ></v-text-field>
            </ValidationProvider>
          </v-col>
          <v-col cols="12" sm="8" lg="6" xl="5" offset-xl="1">
            <ValidationProvider v-slot="{ errors }" rules="required">
              <v-text-field
                v-model="projectName"
                :label="$t('elevatorsSurvey.sendSurvey.projectName')"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                outlined
                :error-messages="errors[0]"
                dense
              ></v-text-field>
            </ValidationProvider>
          </v-col>
        </v-row>

        <v-row class="px-3 px-md-8 px-lg-15">
          <v-col cols="12" sm="8" lg="6" xl="5">
            <ValidationProvider v-slot="{ errors }" rules="required">
              <v-text-field
                v-model="contractID"
                :label="$t('elevatorsSurvey.sendSurvey.contractID')"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                outlined
                :error-messages="errors[0]"
                dense
              ></v-text-field>
            </ValidationProvider>
          </v-col>
          <v-col cols="12" sm="8" lg="6" xl="5" offset-xl="1">
            <ValidationProvider
              v-slot="{ errors }"
              mode="lazy"
              rules="required|email"
            >
              <v-text-field
                v-model="customerEmail"
                :label="$t('elevatorsSurvey.sendSurvey.customerEmail')"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                outlined
                type="email"
                :error-messages="errors[0]"
                dense
              ></v-text-field>
            </ValidationProvider>
          </v-col>
        </v-row>

        <v-row class="px-3 px-md-8 px-lg-15">
          <v-col cols="12" sm="8" lg="6" xl="5">
            <ValidationProvider v-slot="{ errors }" rules="numeric|length:9">
              <v-text-field
                v-model="customerMobileNumber"
                :label="$t('elevatorsSurvey.sendSurvey.customerMobileNumber')"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                outlined
                type="tel"
                prefix="00966"
                :error-messages="errors[0]"
                dense
              ></v-text-field>
            </ValidationProvider>
          </v-col>
        </v-row>

        <v-row class="px-3 px-md-8 px-lg-15">
          <v-col cols="12" sm="8" lg="6" xl="5">
            <ValidationProvider v-slot="{ errors }" rules="required">
              <v-textarea
                v-model="mailBody"
                :label="$t('elevatorsSurvey.sendSurvey.mailBody')"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                no-resize
                rows="9"
                dense
                outlined
                :error-messages="errors[0]"
              ></v-textarea>
            </ValidationProvider>
          </v-col>
          <v-col cols="12" sm="8" lg="6" xl="5" offset-xl="1">
            <ValidationProvider v-slot="{ errors }" rules="required">
              <v-textarea
                v-model="arabicMessage"
                :label="$t('elevatorsSurvey.sendSurvey.arabicMessage')"
                :color="$vuetify.theme.dark ? 'white' : 'primary'"
                no-resize
                rows="9"
                dir="rtl"
                outlined
                dense
                :error-messages="errors[0]"
              ></v-textarea>
            </ValidationProvider>
          </v-col>
        </v-row>
        <!-- submit btn -->
        <v-row class="px-3 px-md-8 px-lg-15">
          <v-col class="py-1" cols="12">
            <div>
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
                {{ $t('generals.send') }}
              </v-btn>
            </div>
          </v-col>
        </v-row>
      </v-form>
    </ValidationObserver>
  </v-container>
</template>

<script>
import { extend, localize } from 'vee-validate'
import { required, email, numeric, length } from 'vee-validate/dist/rules'

extend('required', {
  ...required,
})
extend('email', {
  ...email,
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
      numeric: 'The input must have numeric values only!',
      length: 'The input length should be exactly nine numbers!',
    },
  },
  ar: {
    messages: {
      required: 'هــذا حــقل مطــلوب!',
      email: 'عنوان البريد الإلكتروني غير صالح!',
      numeric: 'إدخال أحرف أو رموز غير مسموح!',
      length: 'عدد الأرقام يجب أن يكون تسعة أرقام فقط!',
    },
  },
})

export default {
  layout: 'elevatorsSurvey',
  data() {
    return {
      clientName: '',
      projectName: null,
      contractID: null,
      customerEmail: null,
      customerMobileNumber: null,
      arabicMessage: `عميلــنا العــزيز

نرجــو أن تكون خدماتنـا قـد حــازت على رضــاك
رجــاءً، تفــضل بإكمال الإستبــيان التالــي لمساعــدتنا على تحسـين خــدماتـنا`,
    }
  },
  computed: {
    mailBody() {
      return `Dear Mr./Ms. ${this.clientName},

We hope you are enjoying your recent purchase from our company. 
Would you like to fill up a short survey to help us improve our services? It will not take too long!

Thank you in advance for your valuable insights.  Your input will be used to ensure that we continue to meet your needs.`
    },
  },

  methods: {
    sendSurvey() {
      this.$nextTick(async () => {
        try {
          this.$nuxt.$loading.start()
          const mailData = {
            clientName: this.clientName,
            projectName: this.projectName,
            contractID: this.contractID,
            customerEmail: this.customerEmail,
            customerMobileNumber: this.customerMobileNumber,
            mailBody: this.mailBody,
            arabicMessage: this.arabicMessage,
          }
          const request = await this.$axios.post(
            `${this.$config.baseURL}/elevators-surveys-api/send-survey-request`,
            mailData
          )
          if (request.status === 200) {
            this.clientName = ''
            this.projectName = null
            this.contractID = null
            this.customerEmail = null
            this.customerMobileNumber = null
            this.$refs.surveyRequestForm.reset()
            this.$nuxt.$loading.finish()
            const notification = {
              type: 'success',
              message: this.$t('elevatorsSurvey.sendSurvey.mailSent'),
            }
            await this.$store.dispatch(
              'appNotifications/addNotification',
              notification
            )
          }
        } catch (e) {
          this.$nuxt.$loading.finish()
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
      })
    },
  },
}
</script>

