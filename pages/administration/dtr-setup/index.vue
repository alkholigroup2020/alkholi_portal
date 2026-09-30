<template>
  <div>
    <v-overlay :value="overlay">
      <v-progress-circular indeterminate size="60"></v-progress-circular>
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
          cols="12"
          md="6"
          lg="5"
          xl="3"
          class="py-5"
        >
          <v-card
            elevation="1"
            color="whiteColor"
            min-height="80"
            outlined
            @click="getBranches"
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
        <v-col
          v-for="(branch, i) in branches"
          :key="i"
          cols="12"
          md="6"
          lg="5"
          xl="3"
        >
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
            height="180"
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
      this.companies = await this.$store.dispatch(
        'administration/dtrSetup/getOrganization',
        { kind: 'companies' }
      )
      if (this.companies.length > 0) {
        await this.getBranches()
      }
      this.overlay = false
    },
    async getBranches() {
      this.branches = await this.$store.dispatch(
        'administration/dtrSetup/getOrganization',
        { kind: 'branches' }
      )
    },
  },
}
</script>
