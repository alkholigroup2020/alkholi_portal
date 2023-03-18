<template>
  <div>
    <v-row class="fill-height">
      <v-col>
        <v-sheet height="64">
          <v-toolbar flat>
            <v-toolbar-title v-if="$refs.calendar">
              <span>{{ $refs.calendar.title }}</span> || <span>{{ code }}</span>
            </v-toolbar-title>
            <v-spacer></v-spacer>
          </v-toolbar>
        </v-sheet>
        <v-sheet height="500">
          <v-calendar
            ref="calendar"
            color="primary"
            :events="events"
            :event-color="getEventColor"
            :event-ripple="true"
            :event-height="30"
            :event-margin-bottom="0"
            type="custom-weekly"
            :start="start"
            :end="end"
            @click:event="showEvent"
            @change="updateRange"
          >
          </v-calendar>
          <!-- the popup -->
          <v-menu
            v-model="selectedOpen"
            :close-on-content-click="false"
            :activator="selectedElement"
            offset-x
          >
            <v-card color="grey lighten-4" min-width="350px" flat>
              <v-toolbar :color="selectedEvent.color" dark>
                <v-btn icon>
                  <v-icon>mdi-pencil</v-icon>
                </v-btn>

                <v-spacer></v-spacer>
                <v-btn icon>
                  <v-icon>mdi-heart</v-icon>
                </v-btn>
                <v-btn icon>
                  <v-icon>mdi-dots-vertical</v-icon>
                </v-btn>
              </v-toolbar>

              <v-card-actions>
                <v-btn text color="secondary" @click="selectedOpen = false">
                  Cancel
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-menu>
        </v-sheet>
      </v-col>
    </v-row>
  </div>
</template>

<script>
export default {
  layout: 'dtr',
  props: {
    start: {
      type: String,
      default: '',
    },
    end: {
      type: String,
      default: '',
    },
    code: {
      type: String,
      default: '',
    },
  },

  data() {
    return {
      daysCount: 0,
      selectedEvent: {},
      selectedElement: null,
      selectedOpen: false,
      events: [],
      colors: ['indigo'],
      names: ['Status'],
    }
  },

  methods: {
    getEventColor(event) {
      return event.color
    },

    showEvent({ nativeEvent, event }) {
      console.log('🚀 start ==>', event.start)
      const open = () => {
        this.selectedEvent = event
        this.selectedElement = nativeEvent.target
        requestAnimationFrame(() =>
          requestAnimationFrame(() => (this.selectedOpen = true))
        )
      }

      if (this.selectedOpen) {
        this.selectedOpen = false
        requestAnimationFrame(() => requestAnimationFrame(() => open()))
      } else {
        open()
      }

      nativeEvent.stopPropagation()
    },

    updateRange({ start, end }) {
      // console.log('🚀 start ==>', start.date)
      // console.log('🚀 Start Month =>', start.month)
      // console.log('🚀 end =>', end.date)

      this.$emit('calenderIsExpanded')
      this.daysCount = 0

      // need to move it to here as the calender is not mounted on the page mount
      this.$refs.calendar.checkChange()

      if (process.client) {
        // aria-expanded="true"
        // document.querySelectorAll('[data-foo="value"]')
        const activeCalender = document.querySelectorAll(
          '[aria-expanded="true"]'
        )

        const allDaysCount = activeCalender[0].getElementsByClassName(
          'v-calendar-weekly__day'
        )

        for (const key in allDaysCount) {
          // console.log(typeof `${allDaysCount[key]._prevClass}`)
          const classesString = `${allDaysCount[key]._prevClass}`

          if (!classesString.includes('v-outside')) {
            if (classesString !== 'undefined') {
              this.daysCount += 1
            }
          }
        }
      }

      // console.log('🚀 this.daysCount ==>', this.daysCount)
      // console.log('🚀 employee ==>', employee)

      const events = []

      if (this.daysCount === 31) {
        for (let index = 0; index < this.daysCount + 1; index++) {
          if (index < 12) {
            const event = {
              color: 'indigo',
              start: `${start.year}-${start.month}-${start.day + index}`,
              end: `${start.year}-${start.month}-${start.day + index}`,
              name: 'Status',
              timed: true,
            }
            events.push(event)
          } else {
            const event = {
              color: 'indigo',
              start: `${end.year}-${end.month}-${index - 11}`,
              end: `${end.year}-${end.month}-${index - 11}`,
              name: 'Status',
              timed: true,
            }
            events.push(event)
          }
        }
      } else if (this.daysCount === 30) {
        for (let index = 0; index < this.daysCount + 1; index++) {
          if (index < 11) {
            const event = {
              color: 'indigo',
              start: `${start.year}-${start.month}-${start.day + index}`,
              end: `${start.year}-${start.month}-${start.day + index}`,
              name: 'Status',
              timed: true,
            }
            events.push(event)
          } else {
            const event = {
              color: 'indigo',
              start: `${end.year}-${end.month}-${index - 10}`,
              end: `${end.year}-${end.month}-${index - 10}`,
              name: 'Status',
              timed: true,
            }
            events.push(event)
          }
        }
      } else if (this.daysCount === 29) {
        for (let index = 0; index < this.daysCount + 1; index++) {
          if (index < 10) {
            const event = {
              color: 'indigo',
              start: `${start.year}-${start.month}-${start.day + index}`,
              end: `${start.year}-${start.month}-${start.day + index}`,
              name: 'Status',
              timed: true,
            }
            events.push(event)
          } else {
            const event = {
              color: 'indigo',
              start: `${end.year}-${end.month}-${index - 9}`,
              end: `${end.year}-${end.month}-${index - 9}`,
              name: 'Status',
              timed: true,
            }
            events.push(event)
          }
        }
      } else if (this.daysCount === 28) {
        for (let index = 0; index < this.daysCount + 1; index++) {
          if (index < 9) {
            const event = {
              color: 'indigo',
              start: `${start.year}-${start.month}-${start.day + index}`,
              end: `${start.year}-${start.month}-${start.day + index}`,
              name: 'Status',
              timed: true,
            }
            events.push(event)
          } else {
            const event = {
              color: 'indigo',
              start: `${end.year}-${end.month}-${index - 8}`,
              end: `${end.year}-${end.month}-${index - 8}`,
              name: 'Status',
              timed: true,
            }
            events.push(event)
          }
        }
      }

      this.events = events
    },
  },
}
</script>

<style>
</style>