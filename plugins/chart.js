/* eslint-disable vue/one-component-per-file */
import Vue from 'vue'
import { Bar } from 'vue-chartjs/legacy'

import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
} from 'chart.js'

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  PointElement,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  LineElement
)

Vue.component('BarChart', {
  extends: Bar,
})
