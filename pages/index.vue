<template>
  <v-container>
    <v-row class="pt-1 pt-md-3">
      <v-col v-if="$vuetify.breakpoint.mdAndUp" cols="12" md="4" lg="3" xl="2">
        <!-- profile section -->
        <v-sheet class="secondaryBG" min-height="50vh" rounded="lg"></v-sheet>
      </v-col>
      <v-col cols="12" md="8" lg="9" xl="10">
        <!-- shortcuts section -->
        <v-sheet class="secondaryBG" min-height="80vh" rounded="lg">
          <h1 class="pa-5">Alkholi Portal</h1>
        </v-sheet>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {}
</script>




