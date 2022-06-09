<template>
  <client-only>
    <bar-chart :chart-options="chartOptions" :chart-data="chartData" />
  </client-only>
</template>

<script>
export default {
  props: {
    chartValues: {
      type: Array,
      default() {
        return []
      },
    },
    title: {
      type: String,
      default() {
        return ''
      },
    },
  },
  data() {
    return {
      chartData: {
        labels: [
          `Strongly Agree - ${this.chartValues[0]}`,
          `Agree - ${this.chartValues[1]}`,
          `Neither Agree nor Disagree - ${this.chartValues[2]}`,
          `Don't Agree - ${this.chartValues[3]}`,
          `Strongly Don't Agree - ${this.chartValues[4]}`,
        ],
        datasets: [
          {
            // label: 'Data One',
            backgroundColor: [
              '#1B5E20',
              '#43A047',
              '#FFEE58',
              '#EF5350',
              '#B71C1C',
            ],
            maxBarThickness: 66,
            borderWidth: 1,
            hoverBorderWidth: 3,
            borderColor: 'white',
            hoverBorderColor: '#000046',
            data: this.chartValues,
          },
        ],
      },
      chartOptions: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
            labels: {
              color: 'rgb(255, 99, 132)',
            },
          },
          title: {
            display: false,
            text: this.title,
            position: 'top',
            align: 'start',
            font: {
              size: 20,
              weight: 'normal',
              // family: "'Baloo 2', cursive;",
            },
            padding: {
              bottom: 25,
            },
          },
        },
      },
    }
  },
}
</script>

<style>
</style>