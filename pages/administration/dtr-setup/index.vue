<template>
  <div>
    <v-overlay :value="overlay">
      <v-progress-circular
        indeterminate
        size="80"
        color=""
      ></v-progress-circular>
    </v-overlay>

    <v-container class="px-3 px-md-8">
      <!-- first title -->
      <v-row>
        <v-col class="pt-5 pb-0" cols="12">
          <div>
            <p class="text-h5 mb-0">
              {{ $t('adminPage.dtrApp.setup.mainCompanies') }}
            </p>
          </div>
        </v-col>
      </v-row>

      <!-- main companies -->
      <v-row>
        <v-col
          v-for="(company, index) in companies"
          :key="index"
          cols="6"
          md="3"
          class="py-5"
        >
          <v-card
            elevation="1"
            color="whiteColor"
            min-height="80"
            outlined
            @click="getBranches(company.company_code)"
          >
            <v-list-item three-line>
              <v-list-item-content>
                <div class="text-h6 mb-3">{{ company.company_code }}</div>
                <v-list-item-subtitle>{{
                  company.company_desc_e
                }}</v-list-item-subtitle>
                <v-list-item-subtitle>{{
                  company.company_desc_a
                }}</v-list-item-subtitle>
              </v-list-item-content>

              <v-list-item-avatar tile size="120" color="whiteColor">
                <v-img
                  contain
                  :src="`https://hr.alkholi.com/MenaITech/application/hrms/MenaImages/Branch_Logos/${company.comp_logo}`"
                ></v-img>
              </v-list-item-avatar>
            </v-list-item>
          </v-card>
        </v-col>
      </v-row>

      <hr class="mt-5" />
      <hr />

      <!-- second title -->
      <v-row>
        <v-col class="pt-5 pb-0" cols="12">
          <div>
            <p class="text-h5 py-3 mb-0">
              {{ $t('adminPage.dtrApp.setup.branches') }}
            </p>
          </div>
        </v-col>
      </v-row>

      <!-- branches -->
      <v-row>
        <v-col v-for="(branch, i) in branches" :key="i" cols="12" md="6" lg="3">
          <v-card
            elevation="1"
            color="whiteColor"
            outlined
            nuxt
            :to="
              localePath(
                `/administration/dtr-setup/divisions/${branch.branch_code}`
              )
            "
          >
            <v-list-item three-line>
              <v-list-item-content>
                <div class="text-h6 mb-4">{{ branch.branch_code }}</div>
                <v-list-item-subtitle>{{
                  branch.branch_name_e
                }}</v-list-item-subtitle>
                <v-list-item-subtitle>{{
                  branch.branch_name_a
                }}</v-list-item-subtitle>
              </v-list-item-content>

              <v-list-item-avatar tile size="120" color="whiteColor">
                <v-img
                  contain
                  :src="`https://hr.alkholi.com/MenaITech/application/hrms/MenaImages/Branch_Logos/${branch.logo}`"
                ></v-img>
              </v-list-item-avatar>
            </v-list-item>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script>
export default {
  layout: 'adminPage',
  data() {
    return {
      companies: [],
      branches: [],
      overlay: false,
    }
  },
  created() {
    this.getGroupBranches()
  },

  methods: {
    async getGroupBranches() {
      this.overlay = true
      try {
        const companies = await this.$axios.post(
          `${this.$config.baseURL}/administration-api/hr-sql-call`,
          {
            query:
              'SELECT [company_code],[company_desc_a],[company_desc_e],comp_logo FROM [dbo].[adm_company]',
          }
        )
        if (companies.status === 200) {
          this.companies = companies.data
          if (this.companies.length > 0) {
            await this.getBranches(this.companies[0].company_code)
          }
          this.overlay = false
        }
      } catch (e) {
        this.overlay = false
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
    async getBranches(company) {
      try {
        const branches = await this.$axios.post(
          `${this.$config.baseURL}/administration-api/hr-sql-call`,
          {
            query:
              'SELECT branch_code, branch_name_a, branch_name_e, logo, logo_a, design_logo_a, design_logo_e FROM [dbo].[adm_branch]',
          }
        )
        if (branches.status === 200) {
          this.branches = branches.data
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

