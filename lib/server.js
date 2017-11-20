const express = require('express')
const path = require('path')

module.exports = function (options, webhook) {
  const app = express()

  app.get('/ping', (req, res) => res.end('PONG'))

  app.use('/probot/static/', express.static(path.join(__dirname, '..', 'static')))
  app.use(options.webhookPath || '/', webhook)

  app.set('view engine', 'ejs')
  app.set('views', path.join(__dirname, '..', 'views'))

  return app
}
