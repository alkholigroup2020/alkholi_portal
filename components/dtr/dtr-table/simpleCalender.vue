<template>
  <div>
    <div class="calendar-header">{{ period }}</div>
    <div class="calendar">
      <div
        v-for="day in days"
        :key="day.date"
        class="calendar-day"
        :class="{ today: day.today, selected: day.selected }"
        @click="select(day)"
      >
        <div class="calendar-day-label">{{ day.label }}</div>
      </div>
    </div>
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
      period: '',
      days: [],
      selectedDate: null,
    }
  },
  mounted() {
    this.init()
  },
  methods: {
    init() {
      const start = new Date(this.startDate)
      const end = new Date(this.endDate)

      this.period = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`

      const days = []
      const date = new Date(start)
      // eslint-disable-next-line no-unmodified-loop-condition
      while (date <= end) {
        days.push({
          date: new Date(date),
          label: date.getDate(),
          today: this.isToday(date),
          selected: false,
        })
        date.setDate(date.getDate() + 1)
      }

      this.days = days
    },
    isToday(date) {
      const today = new Date()
      return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      )
    },
    select(day) {
      if (this.selectedDate) {
        this.selectedDate.selected = false
      }
      day.selected = true
      this.selectedDate = day
    },
  },
}
</script>

<style>
.calendar-header {
  font-size: 1.5rem;
  font-weight: bold;
  text-align: center;
  margin-bottom: 1rem;
}

.calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(6, 1fr);
  gap: 0.25rem;
}

.calendar-day {
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.25rem;
  height: 3rem;
  cursor: pointer;
  border-radius: 0.25rem;
}

.calendar-day.today {
  background-color: #eee;
}

.calendar-day.selected {
  background-color: #007bff;
  color: #fff;
}
</style>
