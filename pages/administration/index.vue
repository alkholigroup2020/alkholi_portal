<template>
  <v-container fluid>
    <v-row>
      <v-col class="py-3 py-md-5">
        <div>
          <div>
            <p class="text-body-1 mb-2 px-1 font-weight-medium">
              {{ $t('adminPage.choices.title') }}
            </p>
          </div>
          <div class="d-flex align-center">
            <v-menu offset-y open-on-hover transition="slide-x-transition">
              <template #activator="{ on, attrs }">
                <v-btn
                  outlined
                  :color="$vuetify.theme.dark ? 'white' : 'black'"
                  v-bind="attrs"
                  class="text-body-2 text-capitalize px-10 py-5"
                  v-on="on"
                >
                  {{ selectedApp }}
                </v-btn>
              </template>

              <v-list :class="$vuetify.theme.dark ? 'primary' : ''">
                <v-list-item
                  v-for="(item, i) in applications"
                  :key="i"
                  @click="selectedApp = item"
                >
                  <v-list-item-title class="text-body-2">{{
                    item
                  }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>

            <div
              v-if="selectedApp === $t('adminPage.choices.app1')"
              class="mx-5"
            >
              <v-avatar size="40" tile>
                <v-img
                  src="/websiteImages/administration.png"
                  alt="App Image"
                  style="border-radius: 5px"
                ></v-img>
              </v-avatar>
            </div>
            <div
              v-if="selectedApp === $t('adminPage.choices.app2')"
              class="mx-5"
            >
              <v-avatar size="40" tile>
                <v-img
                  src="/websiteImages/Online Business Card.png"
                  alt="App Image"
                  style="border-radius: 5px"
                ></v-img>
              </v-avatar>
            </div>
            <div
              v-if="selectedApp === $t('adminPage.choices.app3')"
              class="mx-5"
            >
              <v-avatar size="40" tile>
                <v-img
                  src="/websiteImages/survey_background.png"
                  alt="App Image"
                  style="border-radius: 5px"
                ></v-img>
              </v-avatar>
            </div>
            <div
              v-if="selectedApp === $t('adminPage.choices.app4')"
              class="mx-5"
            >
              <v-avatar size="40" tile>
                <v-img
                  src="/websiteImages/Elevators_Surveys.png"
                  alt="App Image"
                  style="border-radius: 5px"
                ></v-img>
              </v-avatar>
            </div>
            <div
              v-if="selectedApp === $t('adminPage.choices.app5')"
              class="mx-5"
            >
              <v-avatar size="40" tile>
                <v-img
                  src="/websiteImages/dtrApp.jpg"
                  alt="App Image"
                  contain
                  style="border-radius: 5px; background-color: white"
                ></v-img>
              </v-avatar>
            </div>
            <div
              v-if="selectedApp === $t('adminPage.choices.app6')"
              class="mx-5"
            >
              <v-avatar size="40" tile>
                <v-img
                  src="/websiteImages/CoC.jpg"
                  alt="App Image"
                  contain
                  style="border-radius: 5px; background-color: white"
                ></v-img>
              </v-avatar>
            </div>
          </div>
        </div>
      </v-col>
    </v-row>

    <hr class="mt-2 mb-5" />

    <v-row>
      <v-col cols="12">
        <div v-if="selectedApp === $t('adminPage.choices.app1')">
          <portalAdmins />
        </div>
        <div v-if="selectedApp === $t('adminPage.choices.app2')">
          <businessCardsAdmins />
        </div>
        <div v-if="selectedApp === $t('adminPage.choices.app3')">
          <hrSurveysAdmins />
        </div>
        <div v-if="selectedApp === $t('adminPage.choices.app4')">
          <elevatorsAdmins />
        </div>
        <div v-if="selectedApp === $t('adminPage.choices.app5')">
          <dtrUsers />
        </div>
        <div v-if="selectedApp === $t('adminPage.choices.app6')">
          <cocAdmins />
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  layout: 'adminPage',
  data() {
    return {
      applications: [
        `${this.$t('adminPage.choices.app1')}`,
        `${this.$t('adminPage.choices.app2')}`,
        `${this.$t('adminPage.choices.app3')}`,
        `${this.$t('adminPage.choices.app4')}`,
        `${this.$t('adminPage.choices.app5')}`,
        `${this.$t('adminPage.choices.app6')}`,
      ],
      selectedApp: `${this.$t('adminPage.choices.app1')}`,
    }
  },
}
</script>
