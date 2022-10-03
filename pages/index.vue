<template>
  <v-container class="px-xl-16">
    <v-row class="pt-1 pt-md-3 px-2">
      <v-col v-if="$vuetify.breakpoint.mdAndUp" cols="12" md="4" lg="3" xl="2">
        <!-- profile section -->
        <v-sheet class="secondaryBG" rounded="lg">
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
                class="d-flex justify-center py-3 py-md-5 animateItem"
              >
                <otherApps :data="card" />
              </v-col>

              <!-- citrix -->
              <v-dialog
                v-model="citrixDialog"
                width="500"
                overlay-opacity="0.9"
              >
                <template #activator="{ on, attrs }">
                  <v-col
                    v-bind="attrs"
                    cols="6"
                    sm="4"
                    lg="3"
                    xl="2"
                    class="d-flex justify-center py-3 py-md-5 animateItem"
                    v-on="on"
                    @click="citrixDialog = !citrixDialog"
                  >
                    <div class="d-flex flex-column align-center">
                      <v-avatar
                        :size="$vuetify.breakpoint.mdAndUp ? '110' : '90'"
                        class="mb-2 main-div"
                        color="white"
                      >
                        <div
                          v-if="$vuetify.theme.dark"
                          class="the-overlay"
                        ></div>
                        <div class="the-image">
                          <v-img
                            alt="app-image"
                            src="/websiteImages/citrix.png"
                          ></v-img>
                        </div>
                      </v-avatar>
                      <h5 class="text-body-2 text-md-body-1 text-center">
                        {{ $t('portalPage.shortcuts.citrix') }}
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
                            class="mb-2 main-div"
                            color="white"
                          >
                            <div
                              v-if="$vuetify.theme.dark"
                              class="the-overlay"
                            ></div>
                            <div class="the-image">
                              <v-img
                                alt="app-image"
                                src="/websiteImages/citrix.png"
                              ></v-img>
                            </div>
                          </v-avatar>
                        </a>
                        <h5 class="text-body-2 text-md-body-1 text-center">
                          {{
                            $t('portalPage.shortcuts.citrixShortcuts.internal')
                          }}
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
                            class="mb-2 main-div"
                            color="white"
                          >
                            <div
                              v-if="$vuetify.theme.dark"
                              class="the-overlay"
                            ></div>
                            <div class="the-image">
                              <v-img
                                alt="app-image"
                                src="/websiteImages/citrix.png"
                              ></v-img>
                            </div>
                          </v-avatar>
                        </a>
                        <h5 class="text-body-2 text-md-body-1 text-center">
                          {{
                            $t('portalPage.shortcuts.citrixShortcuts.external')
                          }}
                        </h5>
                      </div>
                    </v-col>
                  </v-row>
                </v-card>
              </v-dialog>

              <!-- sharePoint -->
              <v-dialog v-model="spDialog" width="800" overlay-opacity="0.9">
                <template #activator="{ on, attrs }">
                  <v-col
                    v-bind="attrs"
                    cols="6"
                    sm="4"
                    lg="3"
                    xl="2"
                    class="d-flex justify-center py-3 py-md-5 animateItem"
                    v-on="on"
                    @click="spDialog = !spDialog"
                  >
                    <div class="d-flex flex-column align-center">
                      <!-- style="border: 0.5px solid black !important" -->
                      <v-avatar
                        :size="$vuetify.breakpoint.mdAndUp ? '110' : '90'"
                        class="mb-2 main-div"
                        color="white"
                      >
                        <div
                          v-if="$vuetify.theme.dark"
                          class="the-overlay"
                        ></div>
                        <div class="the-image">
                          <v-img
                            alt="app-image"
                            src="/websiteImages/sharepoint.png"
                          ></v-img>
                        </div>
                      </v-avatar>
                      <h5 class="text-body-2 text-md-body-1 text-center">
                        {{ $t('portalPage.shortcuts.sharePoint') }}
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

              <!-- portalApps -->
              <v-col
                v-if="isBusinessCardsAdmin"
                cols="6"
                sm="4"
                lg="3"
                xl="2"
                class="d-flex justify-center py-3 py-md-5 animateItem"
              >
                <div class="d-flex flex-column align-center">
                  <nuxt-link
                    :to="`${localePath('/business-cards/card-generator')}`"
                    class="text-decoration-none"
                  >
                    <v-avatar
                      :size="$vuetify.breakpoint.mdAndUp ? '110' : '90'"
                      class="mb-2 main-div"
                    >
                      <div v-if="$vuetify.theme.dark" class="the-overlay"></div>
                      <div class="the-image">
                        <v-img
                          alt="app-image"
                          src="/websiteImages/Online Business Card.png"
                        ></v-img>
                      </div>
                    </v-avatar>
                  </nuxt-link>
                  <h5 class="text-body-2 text-md-body-1 text-center">
                    {{ $t('portalPage.shortcuts.bCards') }}
                  </h5>
                </div>
              </v-col>

              <v-col
                v-if="isElevatorsSurveysUser"
                cols="6"
                sm="4"
                lg="3"
                xl="2"
                class="d-flex justify-center py-3 py-md-5 animateItem"
              >
                <div class="d-flex flex-column align-center">
                  <nuxt-link
                    :to="`${localePath('/elevators-survey/send-survey')}`"
                    class="text-decoration-none"
                  >
                    <v-avatar
                      :size="$vuetify.breakpoint.mdAndUp ? '110' : '90'"
                      class="mb-2 main-div"
                    >
                      <div v-if="$vuetify.theme.dark" class="the-overlay"></div>
                      <div class="the-image">
                        <v-img
                          alt="app-image"
                          src="/websiteImages/Elevators_Surveys.png"
                        ></v-img>
                      </div>
                    </v-avatar>
                  </nuxt-link>
                  <h5 class="text-body-2 text-md-body-1 text-center">
                    {{ $t('portalPage.shortcuts.elevatorsSurvey') }}
                  </h5>
                </div>
              </v-col>

              <v-col
                v-if="isHRSurveysUser"
                cols="6"
                sm="4"
                lg="3"
                xl="2"
                class="d-flex justify-center py-3 py-md-5 animateItem"
              >
                <div class="d-flex flex-column align-center">
                  <nuxt-link
                    :to="`${localePath('/hr-survey/surveys-data')}`"
                    class="text-decoration-none"
                  >
                    <v-avatar
                      :size="$vuetify.breakpoint.mdAndUp ? '110' : '90'"
                      class="mb-2 main-div"
                    >
                      <div v-if="$vuetify.theme.dark" class="the-overlay"></div>
                      <div class="the-image">
                        <v-img
                          alt="app-image"
                          src="/websiteImages/survey_background.png"
                        ></v-img>
                      </div>
                    </v-avatar>
                  </nuxt-link>
                  <h5 class="text-body-2 text-md-body-1 text-center">
                    {{ $t('portalPage.shortcuts.hrSurvey') }}
                  </h5>
                </div>
              </v-col>

              <v-col
                v-if="isDTRUser"
                cols="6"
                sm="4"
                lg="3"
                xl="2"
                class="d-flex justify-center py-3 py-md-5 animateItem"
              >
                <div class="d-flex flex-column align-center">
                  <nuxt-link
                    :to="`${localePath('/dtr/dtr-table')}`"
                    class="text-decoration-none"
                  >
                    <v-avatar
                      :size="$vuetify.breakpoint.mdAndUp ? '110' : '90'"
                      class="mb-2 main-div"
                    >
                      <div v-if="$vuetify.theme.dark" class="the-overlay"></div>
                      <div class="the-image">
                        <v-img
                          alt="app-image"
                          contain
                          src="/websiteImages/dtr_App.jpg"
                        ></v-img>
                      </div>
                    </v-avatar>
                  </nuxt-link>
                  <h5 class="text-body-2 text-md-body-1 text-center">
                    {{ $t('portalPage.shortcuts.dtrApp') }}
                  </h5>
                </div>
              </v-col>

              <v-col
                v-if="isPortalAdmin"
                cols="6"
                sm="4"
                lg="3"
                xl="2"
                class="d-flex justify-center py-3 py-md-5 animateItem"
              >
                <div class="d-flex flex-column align-center">
                  <nuxt-link
                    :to="`${localePath('/administration')}`"
                    class="text-decoration-none"
                  >
                    <v-avatar
                      :size="$vuetify.breakpoint.mdAndUp ? '110' : '90'"
                      class="mb-2 main-div"
                    >
                      <div v-if="$vuetify.theme.dark" class="the-overlay"></div>
                      <div class="the-image">
                        <v-img
                          alt="app-image"
                          src="/websiteImages/administration.png"
                        ></v-img>
                      </div>
                    </v-avatar>
                  </nuxt-link>
                  <h5 class="text-body-2 text-md-body-1 text-center">
                    {{ $t('portalPage.shortcuts.administration') }}
                  </h5>
                </div>
              </v-col>
            </v-row>
          </v-container>
        </v-sheet>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { mapState } from 'vuex'

export default {
  data() {
    return {
      otherAppsData: [
        {
          imgURL: '/websiteImages/owa.png',
          title: this.$t('portalPage.shortcuts.owa'),
          url: this.owaURL(),
        },
        {
          imgURL: '/websiteImages/mena-me.jpg',
          title: this.$t('portalPage.shortcuts.menaMe'),
          url: 'https://hr.alkholi.com/MenaITech/application/hrms/mename/index.php',
        },
        {
          imgURL: '/websiteImages/KAP+.jpg',
          title: this.$t('portalPage.shortcuts.kap'),
          url: 'https://kap.alkholi.com/',
        },
        {
          imgURL: '/websiteImages/etas.png',
          title: this.$t('portalPage.shortcuts.oldAttendance'),
          url: 'http://attendance.alkholi.com/eTAS/eTas.aspx',
        },
        {
          imgURL: '/websiteImages/hrms.png',
          title: this.$t('portalPage.shortcuts.hrSystem'),
          url: 'https://hr.alkholi.com/MenaITech/application/hrms/index.php',
        },
      ],
      sharepoint: [
        {
          title: this.$t('portalPage.shortcuts.sharePointShortcuts.public'),
          imgURL: '/websiteImages/SP_Public.png',
          url: 'https://alkholi.sharepoint.com/public/SitePages/Home.aspx',
        },
        {
          title: this.$t('portalPage.shortcuts.sharePointShortcuts.chairman'),
          imgURL: '/websiteImages/SP_Chairman.png',
          url: 'https://alkholi.sharepoint.com/chairmanoffice',
        },
        {
          title: this.$t(
            'portalPage.shortcuts.sharePointShortcuts.construction'
          ),
          imgURL: '/websiteImages/SP_Construction.png',
          url: 'https://alkholi.sharepoint.com/construction',
        },
        {
          title: this.$t('portalPage.shortcuts.sharePointShortcuts.elevators'),
          imgURL: '/websiteImages/SP_Elevators.png',
          url: 'https://alkholi.sharepoint.com/elevators',
        },
        {
          title: this.$t('portalPage.shortcuts.sharePointShortcuts.finance'),
          imgURL: '/websiteImages/SP_Finance.png',
          url: 'https://alkholi.sharepoint.com/finance',
        },
        {
          title: this.$t('portalPage.shortcuts.sharePointShortcuts.haktco'),
          imgURL: '/websiteImages/SP_Haktco.png',
          url: 'https://alkholi.sharepoint.com/haktco',
        },
        {
          title: this.$t('portalPage.shortcuts.sharePointShortcuts.hr'),
          imgURL: '/websiteImages/SP_HR.png',
          url: 'https://alkholi.sharepoint.com/hr',
        },
        {
          title: this.$t(
            'portalPage.shortcuts.sharePointShortcuts.procurement'
          ),
          imgURL: '/websiteImages/SP_Procurement.png',
          url: 'https://alkholi.sharepoint.com/procurement',
        },
      ],
      citrixDialog: false,
      spDialog: false,
    }
  },

  computed: {
    ...mapState({
      isPortalAdmin: (state) => state.portal.isPortalAdmin,
      isBusinessCardsAdmin: (state) => state.portal.isBusinessCardsAdmin,
      isElevatorsSurveysUser: (state) => state.portal.isElevatorsSurveysUser,
      isHRSurveysUser: (state) => state.portal.isHRSurveysUser,
      isDTRUser: (state) => state.portal.isDTRUser,
    }),
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


