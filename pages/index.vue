<template>
  <v-container class="px-xl-16" fluid>
    <v-row class="pt-1 pt-md-3 px-2">
      <v-col v-if="$vuetify.breakpoint.mdAndUp" cols="12" md="4" lg="3" xl="2">
        <!-- profile section -->
        <v-sheet class="secondaryBG" min-height="50vh" rounded="lg">
          <userProfile />
        </v-sheet>
      </v-col>
      <v-col cols="12" md="8" lg="9" xl="10">
        <!-- shortcuts section -->
        <v-sheet class="secondaryBG" min-height="80vh" rounded="lg">
          <!-- portal shortcuts -->
          <div class="pa-5">
            <h3 class="text-h6 text-md-h5 primaryText--text">
              {{ $t('portalPage.shortcuts.title') }}
            </h3>
            <p class="mb-n2 text-subtitle-2 primaryText--text">
              {{ $t('portalPage.shortcuts.secondTitle') }}
            </p>
          </div>

          <v-divider></v-divider>

          <v-container>
            <v-row>
              <!-- otherApps -->
              <v-col
                v-for="(card, index) in otherAppsData"
                :key="index"
                cols="6"
                sm="4"
                lg="3"
                xl="2"
                class="d-flex justify-center py-3 py-xl-8 animateItem"
              >
                <otherApps :data="card" />
              </v-col>

              <!-- citrix -->
              <v-dialog v-model="citrixDialog" width="500">
                <template #activator="{ on, attrs }">
                  <v-col
                    v-bind="attrs"
                    cols="6"
                    sm="4"
                    lg="3"
                    xl="2"
                    class="d-flex justify-center py-3 py-xl-8 animateItem"
                    v-on="on"
                    @click="citrixDialog = !citrixDialog"
                  >
                    <div class="d-flex flex-column align-center">
                      <v-avatar
                        :size="$vuetify.breakpoint.mdAndUp ? '120' : '90'"
                        class="mb-2"
                        color="white"
                      >
                        <v-img src="/websiteImages/citrix.png"></v-img>
                      </v-avatar>
                      <h5 class="text-body-2 text-md-body-1 text-center">
                        Citrix
                      </h5>
                    </div>
                  </v-col>
                </template>
                <v-card class="pa-10" color="secondaryBG">
                  <v-row>
                    <v-col
                      cols="6"
                      class="px-2 px-md-5 px-xl-8 py-2 py-xl-3 animateItem"
                      @click="citrixDialog = !citrixDialog"
                    >
                      <div class="d-flex flex-column align-center">
                        <a
                          href="http://ctx.alkholi.com/"
                          target="_blank"
                          class="text-decoration-none"
                        >
                          <v-avatar
                            :size="$vuetify.breakpoint.mdAndUp ? '120' : '90'"
                            class="mb-2"
                            color="white"
                          >
                            <v-img src="/websiteImages/citrix.png"></v-img>
                          </v-avatar>
                        </a>
                        <h5 class="text-body-2 text-md-body-1 text-center">
                          Citrix (Internal)
                        </h5>
                      </div>
                    </v-col>
                    <v-col
                      cols="6"
                      class="px-2 px-md-5 px-xl-8 py-2 py-xl-3 animateItem"
                      @click="citrixDialog = !citrixDialog"
                    >
                      <div class="d-flex flex-column align-center">
                        <a
                          href="https://citrix.alkholi.com/"
                          target="_blank"
                          class="text-decoration-none"
                        >
                          <v-avatar
                            :size="$vuetify.breakpoint.mdAndUp ? '120' : '90'"
                            class="mb-2"
                            color="white"
                          >
                            <v-img src="/websiteImages/citrix.png"></v-img>
                          </v-avatar>
                        </a>
                        <h5 class="text-body-2 text-md-body-1 text-center">
                          Citrix (External)
                        </h5>
                      </div>
                    </v-col>
                  </v-row>
                </v-card>
              </v-dialog>

              <!-- sharePoint -->
              <v-dialog v-model="spDialog" width="800">
                <template #activator="{ on, attrs }">
                  <v-col
                    v-bind="attrs"
                    cols="6"
                    sm="4"
                    lg="3"
                    xl="2"
                    class="d-flex justify-center py-3 py-xl-8 animateItem"
                    v-on="on"
                    @click="spDialog = !spDialog"
                  >
                    <div class="d-flex flex-column align-center">
                      <v-avatar
                        :size="$vuetify.breakpoint.mdAndUp ? '120' : '90'"
                        class="mb-2"
                        color="white"
                      >
                        <v-img src="/websiteImages/sharepoint.png"></v-img>
                      </v-avatar>
                      <h5 class="text-body-2 text-md-body-1 text-center">
                        SharePoint
                      </h5>
                    </div>
                  </v-col>
                </template>
                <v-card class="pa-10" color="secondaryBG">
                  <v-row>
                    <v-col
                      v-for="(unit, index) in sharepoint"
                      :key="index"
                      cols="6"
                      sm="4"
                      lg="3"
                      class="px-2 px-md-5 px-xl-8 py-2 py-xl-3 animateItem"
                      @click="spDialog = !spDialog"
                    >
                      <sharepoint :sp_data="unit" />
                    </v-col>
                  </v-row>
                </v-card>
              </v-dialog>
            </v-row>
          </v-container>
        </v-sheet>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  data() {
    return {
      otherAppsData: [
        {
          imgURL: '/websiteImages/owa.png',
          title: 'Outlook Webapp',
          url: this.owaURL(),
        },
        {
          imgURL: '/websiteImages/mena-me.jpg',
          title: 'MenaMe',
          url: 'https://hr.alkholi.com/MenaITech/application/hrms/mename/index.php',
        },
        {
          imgURL: '/websiteImages/KAP+.png',
          title: 'KAP+ System',
          url: 'https://kap.alkholi.com/',
        },
        {
          imgURL: '/websiteImages/etas.png',
          title: 'Attendance System',
          url: 'http://attendance.alkholi.com/eTAS/eTas.aspx',
        },
        {
          imgURL: '/websiteImages/hrms.png',
          title: 'HR System',
          url: 'https://hr.alkholi.com/MenaITech/application/hrms/index.php',
        },
      ],
      sharepoint: [
        {
          title: 'Public',
          imgURL: '/websiteImages/SP_Public.png',
          url: 'https://alkholi.sharepoint.com/public/SitePages/Home.aspx',
        },
        {
          title: 'Chairman Office',
          imgURL: '/websiteImages/SP_Chairman.png',
          url: 'https://alkholi.sharepoint.com/chairmanoffice',
        },
        {
          title: 'Construction',
          imgURL: '/websiteImages/SP_Construction.png',
          url: 'https://alkholi.sharepoint.com/construction',
        },
        {
          title: 'Elevators',
          imgURL: '/websiteImages/SP_Elevators.png',
          url: 'https://alkholi.sharepoint.com/elevators',
        },
        {
          title: 'Finance',
          imgURL: '/websiteImages/SP_Finance.png',
          url: 'https://alkholi.sharepoint.com/finance',
        },
        {
          title: 'HAKTCO',
          imgURL: '/websiteImages/SP_Haktco.png',
          url: 'https://alkholi.sharepoint.com/haktco',
        },
        {
          title: 'HR',
          imgURL: '/websiteImages/SP_HR.png',
          url: 'https://alkholi.sharepoint.com/hr',
        },
        {
          title: 'Procurement',
          imgURL: '/websiteImages/SP_Procurement.png',
          url: 'https://alkholi.sharepoint.com/procurement',
        },
      ],
      citrixDialog: false,
      spDialog: false,
    }
  },
  methods: {
    owaURL() {
      const domainName = localStorage.getItem('domainName')
      if (domainName === 'amos-sa') {
        return `https://amos.amos-sa.com/owa`
      } else {
        return `https://${domainName}.${domainName}.com/owa`
      }
    },
  },
}
</script>




