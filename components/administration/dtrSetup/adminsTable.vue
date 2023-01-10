<template>
  <v-container fluid class="px-5 px-md-9 mt-3">
    <v-row>
      <v-col cols="12" class="py-0">
        <v-simple-table :class="$vuetify.theme.dark ? 'primary' : ''">
          <template #default>
            <thead>
              <tr>
                <th></th>
                <th class="text-center text-subtitle-2 primaryText--text">
                  Name
                </th>
                <th class="text-center text-subtitle-2 primaryText--text">
                  Employee ID
                </th>
                <th class="text-center text-subtitle-2 primaryText--text">
                  DTR Admin
                </th>
                <th class="text-center text-subtitle-2 primaryText--text">
                  DTR Approver
                </th>
                <th class="text-center text-subtitle-2 primaryText--text">
                  Manpower Admin
                </th>
                <th class="text-center text-subtitle-2 primaryText--text">
                  Migrator
                </th>
                <th class="text-center text-subtitle-2 primaryText--text">
                  Reports
                </th>

                <th class="text-center text-subtitle-2 primaryText--text">
                  Edit
                </th>
                <th class="text-center text-subtitle-2 primaryText--text">
                  Delete
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in admins" :key="member.id">
                <td class="text-center">
                  <v-avatar
                    v-if="member.isHrPic === 1"
                    style="border: 0.5px #000046 solid"
                    size="33"
                  >
                    <v-img
                      :src="`${$config.hrPictureURL}/${member.picPath}`"
                      alt="Profile Image"
                    ></v-img>
                  </v-avatar>
                  <v-avatar
                    v-if="member.isPortalPic === 1"
                    style="border: 0.5px #000046 solid"
                    size="33"
                  >
                    <v-img
                      :src="`${$config.baseURL}/portal-api/profile-data/${member.picPath}`"
                      alt="Profile Image"
                    ></v-img>
                  </v-avatar>
                </td>
                <td class="text-center">
                  {{ member.adminName.split(' ').slice(0, 2).join(' ') }}
                </td>
                <td class="text-center">{{ member.employeeCode }}</td>
                <td class="text-center">
                  <div class="d-flex justify-center mb-n2">
                    <v-checkbox
                      dense
                      disabled
                      :input-value="member.isDTRAdmin === 1 ? true : false"
                      value
                    ></v-checkbox>
                  </div>
                </td>
                <td class="text-center">
                  <div class="d-flex justify-center mb-n2">
                    <v-checkbox
                      dense
                      disabled
                      :input-value="member.isApprover === 1 ? true : false"
                      value
                    ></v-checkbox>
                  </div>
                </td>
                <td class="text-center">
                  <div class="d-flex justify-center mb-n2">
                    <v-checkbox
                      dense
                      disabled
                      :input-value="member.isManpowerAdmin === 1 ? true : false"
                      value
                    ></v-checkbox>
                  </div>
                </td>
                <td class="text-center">
                  <div class="d-flex justify-center mb-n2">
                    <v-checkbox
                      dense
                      disabled
                      :input-value="member.isMigrator === 1 ? true : false"
                      value
                    ></v-checkbox>
                  </div>
                </td>
                <td class="text-center">
                  <div class="d-flex justify-center mb-n2">
                    <v-checkbox
                      dense
                      disabled
                      :input-value="member.isReportAdmin === 1 ? true : false"
                      value
                    ></v-checkbox>
                  </div>
                </td>
                <td>
                  <div class="d-flex justify-center">
                    <v-btn fab text color="primaryText" x-small disabled>
                      <v-icon>mdi-credit-card-edit-outline</v-icon>
                    </v-btn>
                  </div>
                </td>
                <td>
                  <div class="d-flex justify-center">
                    <!-- <elevatorsDelete :employee="member.employeeCode" /> -->
                    <v-btn fab text color="primaryText" x-small disabled>
                      <v-icon>mdi-delete</v-icon>
                    </v-btn>
                  </div>
                </td>
              </tr>
            </tbody>
          </template>
        </v-simple-table>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  props: {
    admins: {
      type: Array,
      default: undefined,
    },
  },
  data() {
    return {}
  },
}
</script>

<style>
</style>