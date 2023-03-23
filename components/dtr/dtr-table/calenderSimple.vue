<template>
  <div class="calendar">
    <table>
      <thead>
        <tr>
          <th v-for="(day, d) in days" :key="d">{{ day }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(week, w) in weeks" :key="w">
          <td
            v-for="(day, i) in week"
            :key="i"
            :class="{ 'different-month': day.month !== currentMonth }"
          >
            <div class="day-number">{{ day.number }}</div>
            <select v-model="day.selectedOption">
              <option v-for="(option, index) in options" :key="index">
                {{ option }}
              </option>
            </select>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  props: {
    startDate: {
      type: String,
      required: true,
    },
    endDate: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      options: [
        'Option 1',
        'Option 2',
        'Option 3',
        'Option 4',
        'Option 5',
        'Option 6',
        'Option 7',
        'Option 8',
      ],
      days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      currentMonth: '',
      weeks: [],
    }
  },
  created() {
    this.generateCalendar()
  },
  methods: {
    generateCalendar() {
      const startDate = new Date(this.startDate)
      const endDate = new Date(this.endDate)

      // const daysInMonth = new Date(
      //   startDate.getFullYear(),
      //   startDate.getMonth() + 1,
      //   0
      // ).getDate()
      const firstDayOfMonth = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        1
      ).getDay()
      // const lastDayOfMonth = new Date(
      //   startDate.getFullYear(),
      //   startDate.getMonth(),
      //   daysInMonth
      // ).getDay()
      const numDaysFromSunday = firstDayOfMonth === 0 ? 7 : firstDayOfMonth
      // const numDaysFromSaturday = lastDayOfMonth === 6 ? 0 : 6 - lastDayOfMonth
      // const numDays = daysInMonth + numDaysFromSunday + numDaysFromSaturday

      const currentDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        1 - numDaysFromSunday
      )
      let currentWeek = []
      this.weeks = []

      // eslint-disable-next-line no-unmodified-loop-condition
      while (currentDate <= endDate) {
        if (currentDate.getDay() === 0 && currentWeek.length > 0) {
          this.weeks.push(currentWeek)
          currentWeek = []
        }

        currentWeek.push({
          number: currentDate.getDate(),
          month: currentDate.toLocaleString('default', { month: 'short' }),
          selectedOption: '',
        })

        currentDate.setDate(currentDate.getDate() + 1)
      }

      if (currentWeek.length > 0) {
        this.weeks.push(currentWeek)
      }

      this.currentMonth = this.weeks[0][numDaysFromSunday].month
    },
  },
}
</script>

<style>
.calendar {
  max-width: 100%;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 10px;
  text-align: center;
  border: 1px solid #ccc;
}

th {
  background-color: #f2f2f2;
}

.day-number {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 5px;
}

select {
  width: 100%;
  padding: 5px;
  margin-top: 5px;
  border-radius: 5px;
  border: 1px solid #ccc;
}
</style>
