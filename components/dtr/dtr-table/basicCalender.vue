<template>
  <div class="calendar">
    <table>
      <thead>
        <tr>
          <th v-for="(day, d) in days" :key="d">{{ day }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(week, index) in weeks" :key="index">
          <td v-for="day in week" :key="day.date">
            <div class="day">
              <div class="date">{{ day.date | formatDate }}</div>
              <select v-model="day.selectedOption">
                <option v-for="(option, o) in options" :key="o" :value="option">
                  {{ option }}
                </option>
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
  name: 'Calendar',
  filters: {
    formatDate(date) {
      const month = date.toLocaleString('default', { month: 'short' })
      const day = date.getDate()
      return `${month} ${day}`
    },
  },
  props: {
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
  },
  data() {
    return {
      options: [
        'option1',
        'option2',
        'option3',
        'option4',
        'option5',
        'option6',
        'option7',
        'option8',
      ],
      days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      weeks: [],
    }
  },
  mounted() {
    this.generateWeeks()
  },
  methods: {
    generateWeeks() {
      const start = new Date(this.startDate)
      const end = new Date(this.endDate)
      const weeks = []
      let currentWeek = []

      // eslint-disable-next-line no-unmodified-loop-condition
      while (start <= end) {
        if (currentWeek.length === 7) {
          weeks.push(currentWeek)
          currentWeek = []
        }
        currentWeek.push({
          date: start,
          selectedOption: 'option1',
        })
        start.setDate(start.getDate() + 1)
      }

      if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
          currentWeek.push(null)
        }
        weeks.push(currentWeek)
      }

      this.weeks = weeks
    },
  },
}
</script>
