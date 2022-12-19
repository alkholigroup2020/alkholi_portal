<template>
  <div>
    <v-data-table
      :headers="headers"
      :items="allEmployeesResult"
      :items-per-page="10"
      class="elevation-1"
    >
      <template #[`item.employee_picture`]="{ item }">
        <v-avatar
          v-if="item.employee_picture"
          style="border: 0.5px #000046 solid"
          size="40"
        >
          <v-img
            :src="`https://hr.alkholi.com/MenaITech/application/hrms/MenaImages/Employees_Pictures/${item.employee_picture}`"
            alt="Profile Image"
          ></v-img>
        </v-avatar>
        <v-avatar v-else style="border: 0.5px #000046 solid" size="40">
          <v-img
            :src="`/generalPictures/profile.png`"
            alt="Profile Image"
          ></v-img>
        </v-avatar>
      </template>
    </v-data-table>
  </div>
</template>

<script>
export default {
  props: {
    allEmployeesResult: {
      type: Array,
      default: () => {
        return []
      },
    },
  },
  data() {
    return {
      headers: [
        { text: 'Profile Picture', value: 'employee_picture' },
        { text: 'Employee Code', value: 'employee_code' },
        { text: 'English Name', value: 'employee_name_eng' },
        { text: 'Arabic Name', value: 'employee_name_a' },
        // { text: 'Manager Code', value: 'Manager_Code' },
        { text: 'Email', value: 'Email' },
      ],
    }
  },
}
</script>

<style>
</style>