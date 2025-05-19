import Vue from 'vue'
import PdfEmbed from 'vue-pdf-embed/dist/vue2-pdf-embed'

// Register as a global component
Vue.component('PdfEmbed', PdfEmbed)

export default (ctx, inject) => {
  // If you want to inject the component instance into the Nuxt context
  inject('pdfEmbed', PdfEmbed)
}
