module.exports = {
  apps: [
    {
      name: 'alkholi_portal',
      exec_mode: 'cluster',
      instances: 'max',
      script: './node_modules/nuxt/bin/nuxt.js',
      args: 'start',
    },
  ],
}
