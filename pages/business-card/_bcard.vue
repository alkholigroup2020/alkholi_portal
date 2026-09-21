<template>
  <div class="theBG">
    <div
      v-if="loading || errorKey"
      class="pa-6 text-center primary--text"
      :dir="$i18n.locale === 'ar' ? 'rtl' : 'ltr'"
      role="status"
      aria-live="polite"
    >
      {{ $t(`businessCards.publicCard.${loading ? 'loading' : errorKey}`) }}
    </div>
    <template v-else-if="result">
      <alkholiGroup
        v-if="result.company === 'Alkholi Group'"
        :result="result"
      />

      <akstraConsulting
        v-if="result.company === 'AKSTRA Consulting'"
        :result="result"
      />

      <aktek v-if="result.company === 'AKTEK'" :result="result" />

      <CustomLayout v-if="result.company === 'Custom'" :result="result" />

      <amosAndSBTMCManager
        v-if="result.company === 'AMOS & SBTMC Manager'"
        :result="result"
      />

      <bteco v-if="result.company === 'BTECO'" :result="result" />

      <alkholiHolding
        v-if="result.company === 'Alkholi Holding'"
        :result="result"
      />

      <upmoc v-if="result.company == 'UPMOC'" :result="result" />

      <mxReality v-if="result.company == 'MX Reality'" :result="result" />
    </template>
  </div>
</template>

<script>
export default {
  layout: 'businessCard',
  asyncData({ params }) {
    const employeeCode = params.bcard
    return { employeeCode }
  },
  data() {
    return {
      result: null,
      loading: true,
      errorKey: null,
      requestId: 0,
    }
  },
  watch: {
    employeeCode() {
      this.loadPublicCard()
    },
  },
  beforeMount() {
    this.loadPublicCard()
  },
  beforeDestroy() {
    this.requestId++
  },
  methods: {
    async loadPublicCard() {
      const requestId = ++this.requestId
      this.result = null
      this.errorKey = null
      this.loading = true
      // Nuxt also matches /business-card without the optional route parameter.
      if (typeof this.employeeCode !== 'string' || !this.employeeCode.length) {
        this.errorKey = 'invalidEmployeeCode'
        this.loading = false
        return
      }
      try {
        const response = await this.$axios.get(
          `${
            this.$config.baseURL
          }/business-cards-api/public-cards/${encodeURIComponent(
            this.employeeCode
          )}`,
          { timeout: 15000 }
        )
        if (requestId !== this.requestId) return
        const card = response.data
        const companies = [
          'Alkholi Group',
          'AKSTRA Consulting',
          'AKTEK',
          'Custom',
          'AMOS & SBTMC Manager',
          'BTECO',
          'Alkholi Holding',
          'UPMOC',
          'MX Reality',
        ]
        if (!card || Array.isArray(card) || !companies.includes(card.company)) {
          this.errorKey = 'serviceUnavailable'
          return
        }
        this.result = card
      } catch (error) {
        if (requestId !== this.requestId) return
        const status = error.response && error.response.status
        this.errorKey =
          status === 400
            ? 'invalidEmployeeCode'
            : status === 404
            ? 'cardNotFound'
            : 'serviceUnavailable'
      } finally {
        if (requestId === this.requestId) this.loading = false
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.theBG {
  height: 100%;
  width: 100%;
  overflow: hidden;
}
</style>
