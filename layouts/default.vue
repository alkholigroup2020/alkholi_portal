<template>
  <v-app>
    <v-navigation-drawer
      v-if="$vuetify.breakpoint.mdAndDown"
      v-model="drawer"
      class="primary"
      app
    >
      <div class="d-flex justify-center" style="height: 60px">
        <v-btn color="white" depressed text tile height="100%" :ripple="false">
          <!-- <span class="px-2 pt-1 text-capitalize">Dark</span> -->
          <v-icon>mdi-theme-light-dark</v-icon>
          <!-- <span class="px-2 pt-1 text-capitalize">Light</span> -->
        </v-btn>

        <v-btn color="white" depressed text tile height="100%" :ripple="false">
          <v-icon>mdi-exit-to-app</v-icon>
          <!-- <span class="px-2 pt-1 text-capitalize">Logout</span> -->
        </v-btn>
        <v-btn
          color="white "
          depressed
          text
          tile
          height="100%"
          :ripple="false"
          nuxt
        >
          <v-icon class="px-2" size="18">mdi-web</v-icon>
          <div class="pt-1">
            <nuxt-link
              v-for="locale in availableLocales"
              :key="locale.code"
              class="white--text text-decoration-none text-capitalize"
              :to="switchLocalePath(locale.code)"
              >{{ locale.name }}
            </nuxt-link>
          </div>
        </v-btn>
      </div>
      <v-divider class="py-0 mt-n1 white"></v-divider>
      <div class="d-flex justify-center py-5">
        <!-- <v-avatar size="100">
          <v-img
            :src="`${profilePicPath}`"
            alt="Profile Image"
            position="top center"
          ></v-img>
        </v-avatar> -->
      </div>
      <div class="text-subtitle-1 white--text text-center">
        <p class="mb-0">userFullName</p>
      </div>
      <div class="text-subtitle-1 white--text text-center">
        <p class="mb-0">employeeFileNumber</p>
      </div>
      <!-- <div v-if="qrFileName" class="d-flex justify-center pb-5 pt-2">
        <v-img
          :src="`${$config.baseURL}portal-administrations/business-cards/${qrFileName}`"
          max-width="70"
          contain
        ></v-img>
      </div> -->
      <v-divider></v-divider>
      <!-- <v-dialog v-model="dialog" width="500">
        <template #activator="{ on, attrs }">
          <div class="d-flex flex-column align-center py-6">
            <v-btn
              v-bind="attrs"
              elevation="0"
              class="text-subtitle-2 text-capitalize"
              color="primary_8"
              small
              v-on="on"
              @click="dialog = !dialog"
            >
              Edit Your Profile
            </v-btn>
          </div>
        </template>
        <v-card class="pa-10">
          <v-form v-model="formIsValid" @submit.prevent="saveProfile">
            <v-file-input
              v-model="profilePic"
              :rules="profileImgRules"
              accept="image/png, image/jpeg, image/jpg"
              prepend-icon="mdi-camera"
              label="Upload a new profile image"
              @change="checkExt(profilePic)"
            ></v-file-input>
            <div class="mt-3">
              <v-btn color="primary" class="px-8 py-0" type="submit"
                >Save</v-btn
              >
            </div>
          </v-form>
        </v-card>
      </v-dialog> -->
    </v-navigation-drawer>

    <!-- portal bar -->
    <v-app-bar app color="primary" flat>
      <v-container class="py-0 fill-height">
        <!-- hamburger icon -->
        <v-app-bar-nav-icon
          v-if="$vuetify.breakpoint.smAndDown"
          class="white--text"
          @click="drawer = !drawer"
        ></v-app-bar-nav-icon>
        <!-- group logo -->
        <div
          style="height: 100%"
          class="d-flex align-center justify-center mx-n6 px-0 px-md-11"
        >
          <v-img
            contain
            max-width="180"
            max-height="66%"
            src="/generalPictures/Alkholi Group White.png"
          ></v-img>
        </div>

        <v-spacer></v-spacer>
        <!-- action buttons -->
        <v-btn
          v-if="$vuetify.breakpoint.mdAndUp"
          color="white"
          depressed
          text
          tile
          height="100%"
          :ripple="false"
        >
          <span class="px-2 pt-1 text-capitalize">{{
            $t('portalPage.appBar.light')
          }}</span>
          <v-icon>mdi-theme-light-dark</v-icon>
          <span class="px-2 pt-1 text-capitalize">{{
            $t('portalPage.appBar.dark')
          }}</span>
        </v-btn>

        <v-btn
          v-if="$vuetify.breakpoint.mdAndUp"
          color="white"
          depressed
          text
          tile
          height="100%"
          :ripple="false"
        >
          <v-icon>mdi-exit-to-app</v-icon>
          <span class="px-2 pt-1 text-capitalize">{{
            $t('portalPage.appBar.logout')
          }}</span>
        </v-btn>

        <v-btn
          v-if="$vuetify.breakpoint.mdAndUp"
          color="white "
          depressed
          text
          tile
          height="100%"
          :ripple="false"
          nuxt
        >
          <v-icon class="px-2" size="18">mdi-web</v-icon>
          <div class="pt-1">
            <nuxt-link
              v-for="locale in availableLocales"
              :key="locale.code"
              class="white--text text-decoration-none text-capitalize"
              :to="switchLocalePath(locale.code)"
              >{{ locale.name }}
            </nuxt-link>
          </div>
        </v-btn>
      </v-container>
    </v-app-bar>

    <v-main>
      <Nuxt />
    </v-main>
  </v-app>
</template>

<script>
export default {
  data() {
    return {
      drawer: false,
    }
  },
  computed: {
    availableLocales() {
      return this.$i18n.locales.filter((i) => i.code !== this.$i18n.locale)
    },
  },
  created() {
    // watch the lang changes, then change the page direction
    this.$watch(
      '$i18n.locale',
      (newLocale) => {
        if (newLocale === 'ar') {
          this.$vuetify.rtl = true
        } else {
          this.$vuetify.rtl = false
        }
      },
      { immediate: true }
    )
  },
}
</script>

