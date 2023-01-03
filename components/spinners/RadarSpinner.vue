<template>
  <!-- overlay needs to be manually added with the v-if condition -->
  <v-overlay v-if="loading" :color="bgColor" z-index="1000" opacity="100">
    <div class="radar-spinner" :style="spinnerStyle">
      <div
        v-for="(cs, index) in circlesStyles"
        :key="index"
        class="circle"
        :style="cs"
      >
        <div class="circle-inner-container" :style="circleInnerContainerStyle">
          <div class="circle-inner" :style="circleInnerStyle"></div>
        </div>
      </div>
    </div>
  </v-overlay>
</template>

<script>
export default {
  name: 'RadarSpinner',
  props: {
    animationDuration: {
      type: Number,
      default: 2000,
    },
    size: {
      type: Number,
      default: 110,
    },
  },
  data() {
    return {
      circlesNum: 4,
      // manually added
      loading: false,
      setColor: '',
      bgColor: '',
    }
  },
  computed: {
    borderWidth() {
      return (this.size * 5) / 110
    },
    spinnerStyle() {
      return {
        height: `${this.size}px`,
        width: `${this.size}px`,
      }
    },
    circleStyle() {
      return {
        animationDuration: `${this.animationDuration}ms`,
      }
    },
    circleInnerContainerStyle() {
      return {
        borderWidth: `${this.borderWidth}px`,
      }
    },
    circleInnerStyle() {
      return {
        borderLeftColor: this.setColor,
        borderRightColor: this.setColor,
        borderWidth: `${this.borderWidth}px`,
      }
    },
    circlesStyles() {
      const circlesStyles = []
      const delay = this.animationDuration * 0.15
      for (let i = 0; i < this.circlesNum; i++) {
        circlesStyles.push(
          Object.assign(
            {
              padding: `${this.borderWidth * 2 * i}px`,
              animationDelay: `${i === this.circlesNum - 1 ? 0 : delay}ms`,
            },
            this.circleStyle
          )
        )
      }
      return circlesStyles
    },
  },
  // manually added
  methods: {
    start() {
      const colorMode = localStorage.getItem('colorMode')
      if (colorMode === 'dark') {
        this.setColor = this.$vuetify.theme.themes.light.mainBG
        this.bgColor = this.$vuetify.theme.themes.dark.mainBG
      } else {
        this.setColor = this.$vuetify.theme.themes.dark.mainBG
        this.bgColor = this.$vuetify.theme.themes.light.mainBG
      }
      this.loading = true
    },
    finish() {
      this.loading = false
    },
  },
}
</script>

<style scoped>
.radar-spinner,
.radar-spinner * {
  box-sizing: border-box;
}
.radar-spinner {
  height: 60px;
  width: 60px;
  position: relative;
}
.radar-spinner .circle {
  position: absolute;
  height: 100%;
  width: 100%;
  top: 0;
  left: 0;
  animation: radar-spinner-animation 2s infinite;
}
.radar-spinner .circle:nth-child(1) {
  padding: calc(60px * 5 * 2 * 0 / 110);
  animation-delay: 300ms;
}
.radar-spinner .circle:nth-child(2) {
  padding: calc(60px * 5 * 2 * 1 / 110);
  animation-delay: 300ms;
}
.radar-spinner .circle:nth-child(3) {
  padding: calc(60px * 5 * 2 * 2 / 110);
  animation-delay: 300ms;
}
.radar-spinner .circle:nth-child(4) {
  padding: calc(60px * 5 * 2 * 3 / 110);
  animation-delay: 0ms;
}
.radar-spinner .circle-inner,
.radar-spinner .circle-inner-container {
  height: 100%;
  width: 100%;
  border-radius: 50%;
  border: calc(60px * 5 / 110) solid transparent;
}
.radar-spinner .circle-inner {
  border-left-color: #ff1d5e;
  border-right-color: #ff1d5e;
}
@keyframes radar-spinner-animation {
  50% {
    transform: rotate(180deg);
  }
  100% {
    transform: rotate(0deg);
  }
}
</style>