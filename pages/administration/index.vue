<template>
  <v-container>
    <v-row>
      <v-col class="py-3 py-md-5">
        <div>
          <div>
            <p class="text-body-1 mb-2 px-1 font-weight-medium">
              {{ $t('adminPage.choices.title') }}
            </p>
          </div>
          <div>
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

              <v-list>
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
          </div>
        </div>
      </v-col>
    </v-row>

    <hr class="mt-2 mb-5" />

    <v-row>
      <v-col cols="12">
        <p v-if="selectedApp === $t('adminPage.choices.app1')">
          <portalAdmins />
        </p>
        <p v-if="selectedApp === $t('adminPage.choices.app2')">
          <businessCardsAdmins />
        </p>
        <p v-if="selectedApp === $t('adminPage.choices.app3')">
          <hrSurveysAdmins />
        </p>
        <p v-if="selectedApp === $t('adminPage.choices.app4')">
          <elevatorsAdmins />
        </p>
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
      ],
      selectedApp: `${this.$t('adminPage.choices.app1')}`,
    }
  },
}
</script>
