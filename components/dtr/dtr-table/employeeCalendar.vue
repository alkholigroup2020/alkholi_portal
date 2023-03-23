<template>
  <div>
    <v-divider></v-divider>
    <div style="width: 100%">
      <div class="d-flex">
        <h3 class="text-body-2 py-1">
          {{
            `From: ${new Date(startDate).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })} - To: ${new Date(endDate).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}`
          }}
        </h3>
        <v-spacer></v-spacer>
        <pre>{{ employeeCode }}</pre>
      </div>
    </div>
    <hr class="mb-1" />

    <table>
      <thead>
        <tr>
          <th v-for="day in days" :key="day">{{ day }}</th>
        </tr>
      </thead>
      <tbody class="text-body-2">
        <tr v-for="(week, index) in weeks" :key="index">
          <td
            v-for="day in week"
            :key="day.dayIndex"
            :class="{ empty: day.empty }"
          >
            <div v-if="!day.empty">
              <div class="date">{{ day.date | formatDate }}</div>
              <select v-model="day.type" @change="updateData">
                <option value="Normal">Normal</option>
                <option value="Vacation">Vacation</option>
                <option value="Sick Leave">Sick Leave</option>
                <option value="Annual Vacation">Annual Vacation</option>
                <option value="Absent">Absent</option>
              </select>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  filters: {
    // This function takes a value parameter and returns a formatted date string
    formatDate(value) {
      // Get the day of the month from the value parameter and store it in a variable
      const dayOfMonth = value.getDate()

      if (dayOfMonth === 1) {
        // Get the short name of the month from the value parameter and store it in a variable
        const shortMonthName = value.toLocaleDateString(undefined, {
          month: 'short',
        })

        // Get the year from the value parameter and store it in a variable
        const year = value.getFullYear()

        // Return the formatted date string, which includes the day of the month, the short name of the month, and the year
        return `${dayOfMonth} ${shortMonthName} ${year}`
      } else {
        // Return the formatted date string, which includes the day of the month, the short name of the month, and the year
        return `${dayOfMonth}`
      }
    },
  },
  props: {
    employeeCode: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
  },
  data() {
    return {
      days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      weeks: [],
    }
  },
  created() {
    // notify the parent component calender is expanded to hide the date range navigator
    this.$emit('calenderIsExpanded')
    // Calculate the number of days between the start and end dates
    const totalDays =
      Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24)) + 1 // add one day to include the end date

    // Calculate the number of days to add to the start date to align it with the first day of a week (Sunday)
    const offset = (this.startDate.getDay() + 7 - 0) % 7

    // Calculate the total number of days to display in the calendar (including empty days)
    const totalDisplayDays = totalDays + offset

    // Calculate the number of weeks to display in the calendar
    const totalWeeks = Math.ceil(totalDisplayDays / 7)

    // Create a two-dimensional array to hold the days in each week
    for (let i = 0; i < totalWeeks; i++) {
      const week = []

      for (let j = 0; j < 7; j++) {
        const dayIndex = i * 7 + j
        const date = new Date(this.startDate)
        date.setDate(date.getDate() + dayIndex - offset)

        // If the date is before the start date or after the end date, mark it as empty
        const empty =
          date < this.startDate ||
          date > this.endDate ||
          dayIndex - offset >= totalDays

        // Add the day to the current week
        week.push({
          date,
          empty,
          type: 'Normal',
          dayIndex,
        })
      }

      // Add the current week to the array of weeks
      this.weeks.push(week)
    }
  },
  methods: {
    updateData() {
      // Flatten the two-dimensional `weeks` array into a one-dimensional array.
      // Filter out any elements where the `empty` property is truthy.
      // Map the remaining elements into new objects with a `date` and `type` property.
      // Create a new object with a `date` property equal to the `date` property of the `day` object.
      // Create a `type` property equal to the `type` property of the `day` object.

      const dataArray = this.weeks
        .flat()
        .filter((day) => !day.empty)
        .map((day) => {
          return {
            date: day.date,
            type: day.type,
          }
        })

      this.$emit('dataUpdated', dataArray)
    },
  },
}
</script>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
  border-spacing: 0;
}

th,
td {
  text-align: center;
  padding: 8px;
}

th {
  background-color: #eee;
}

td {
  position: relative;
}

.empty {
  background-color: #f5f5f5;
}

.select {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px;
  font-size: 0.8rem;
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  z-index: 1;
  display: none;
}

td:hover .select {
  display: block;
}

.select select {
  width: 100%;
  border: none;
  outline: none;
  font-size: inherit;
  background-color: transparent;
}

@media (max-width: 576px) {
  table {
    font-size: 0.8rem;
  }

  th,
  td {
    padding: 6px;
  }

  .select {
    font-size: 0.7rem;
  }
}
</style>
