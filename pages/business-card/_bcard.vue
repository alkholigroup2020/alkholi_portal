<template>
  <div class="theBG">
    <alkholiGroup v-if="result.company === 'Alkholi Group'" :result="result" />

    <akstraConsulting
      v-if="result.company === 'AKSTRA Consulting'"
      :result="result"
    />

    <aktek v-if="result.company === 'AKTEK'" :result="result" />

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
      result: [],
    }
  },
  beforeMount() {
    this.getGeneratedCards()
  },
  methods: {
    async getGeneratedCards() {
      try {
        const generatedCards = await this.$axios.post(
          `${this.$config.baseURL}/business-cards-api/open-sql-call`,
          {
            query: `SELECT * FROM [businessCards].[employeeData] WHERE employeeID = '${this.employeeCode}'`,
          }
        )
        if (generatedCards.status === 200) {
          const res = generatedCards.data
          this.result = res[0]
        }
      } catch (e) {
        const error = e.toString()
        const newErrorString = error.replaceAll('Error: ', '')
        const notification = {
          type: 'error',
          message: newErrorString,
        }
        await this.$store.dispatch(
          'appNotifications/addNotification',
          notification
        )
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