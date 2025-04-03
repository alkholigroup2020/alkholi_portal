<template>
  <v-container fluid class="pt-5 px-5 px-md-16">
    <v-overlay :value="overlay">
      <v-progress-circular indeterminate size="60"></v-progress-circular>
    </v-overlay>

    <!-- title -->
    <v-row>
      <v-col>
        <h3 class="text-h5 primaryText--text">Employees List</h3>
        <hr class="mt-3 mb-1" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  layout: 'codeOfConduct',
  data() {
    return {
      overlay: false,
    }
  },
}
</script>
