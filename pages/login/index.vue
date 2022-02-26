<template>
  <v-container fluid style="height: 100%">
    <v-row
      align="center"
      class="pt-10 pt-md-0"
      :style="$vuetify.breakpoint.mdAndUp ? 'height: 100%' : ''"
    >
      <v-col cols="12" md="6" order="2" order-md="1">
        <div class="d-flex flex-column align-center">
          <LoginForm />
        </div>
      </v-col>
      <v-col cols="12" md="6" class="green" order="1" order-md="2">
        <div class="red d-flex flex-column align-center">
          <h1>Alkholi Group</h1>
          <p>Employees Portal</p>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  layout: 'login',
}
</script>

<style>
</style>