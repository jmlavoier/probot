const createProbot = require('..')
const request = require('supertest')

const sign = require('@octokit/webhooks/sign')

const pushPayload = require('./fixtures/webhook/push')
const signature = sign('development', pushPayload)

describe('Probot', () => {
  let probot
  let eventMeta

  beforeEach(() => {
    probot = createProbot()

    eventMeta = {
      id: '123',
      name: 'push'
    }
  })

  describe('webhook delivery', () => {
    it('forwards webhooks to the robot', async () => {
      const robot = probot.load(() => {})
      const handler = jest.fn()
      robot.on('push', handler)
      await request(probot.server)
        .post('/')
        .send(pushPayload)
        .set('content-type', 'application/json')
        .set('user-agent', 'GitHub-Hookshot/abc4567')
        .set('x-github-event', 'push')
        .set('x-hub-signature', signature)
        .set('x-github-delivery', eventMeta.id)
        .expect(200)

      expect(handler).toHaveBeenCalledWith(pushPayload, {
        id: '123',
        name: 'push'
      })
    })
  })

  describe('server', () => {
    it('prefixes paths with route name', () => {
      probot.load(robot => {
        const app = robot.route('/my-plugin')
        app.get('/foo', (req, res) => res.end('foo'))
      })

      return request(probot.server).get('/my-plugin/foo').expect(200, 'foo')
    })

    it('allows routes with no path', () => {
      probot.load(robot => {
        const app = robot.route()
        app.get('/foo', (req, res) => res.end('foo'))
      })

      return request(probot.server).get('/foo').expect(200, 'foo')
    })

    it('allows custom POST routes', () => {
      probot.load(robot => {
        const app = robot.route()
        app.post('/foo', (req, res) => res.end('foo'))
      })

      return request(probot.server).post('/foo').expect(200, 'foo')
    })

    it('allows you to overwrite the root path', () => {
      probot.load(robot => {
        const app = robot.route()
        app.get('/', (req, res) => res.end('foo'))
      })

      return request(probot.server).get('/').expect(200, 'foo')
    })

    it('isolates plugins from affecting eachother', async () => {
      ['foo', 'bar'].forEach(name => {
        probot.load(robot => {
          const app = robot.route('/' + name)

          app.use(function (req, res, next) {
            res.append('X-Test', name)
            next()
          })

          app.get('/hello', (req, res) => res.end(name))
        })
      })

      await request(probot.server).get('/foo/hello')
        .expect(200, 'foo')
        .expect('X-Test', 'foo')

      await request(probot.server).get('/bar/hello')
        .expect(200, 'bar')
        .expect('X-Test', 'bar')
    })

    it('allows users to configure webhook paths', async () => {
      probot = createProbot({webhookPath: '/webhook'})
      // Error handler to avoid printing logs
      // eslint-disable-next-line handle-callback-err
      probot.server.use((err, req, res, next) => { })

      probot.load(robot => {
        const app = robot.route()
        app.get('/webhook', (req, res) => res.end('get-webhook'))
        app.post('/webhook', (req, res) => res.end('post-webhook'))
      })

      // GET requests should succeed
      await request(probot.server).get('/webhook')
        .expect(200, 'get-webhook')

      // POST requests should fail b/c webhook path has precedence
      await request(probot.server).post('/webhook')
        .expect(400)
    })

    it('defaults webhook path to `/`', async () => {
      // Error handler to avoid printing logs
      // eslint-disable-next-line handle-callback-err
      probot.server.use((err, req, res, next) => { })

      // POST requests to `/` should 400 b/c webhook signature will fail
      await request(probot.server).post('/')
        .expect(400)
    })
  })

  describe('receive', () => {
    it('forwards events to each plugin', async () => {
      const spy = jest.fn()
      const robot = probot.load(robot => robot.on('push', spy))
      robot.auth = jest.fn().mockReturnValue(Promise.resolve({}))

      await probot.receive({
        id: eventMeta.id,
        name: eventMeta.name,
        data: pushPayload,
        signature: signature
      })

      expect(spy).toHaveBeenCalled()
    })

    it('logs errors', async () => {
      const spy = jest.fn()
      const robot = probot.load(() => {})

      robot.auth = jest.fn().mockReturnValue(Promise.resolve({}))
      robot.log.error = jest.fn()

      const error = new Error('testing')
      robot.on('push', () => {
        throw error
      })

      robot.on('error', spy)

      try {
        await probot.receive({
          id: eventMeta.id,
          name: eventMeta.name,
          data: pushPayload,
          signature: signature
        })
      } catch (error) {
        // expected
      }

      expect(spy).toHaveBeenCalled()
    })
  })

  describe('sentry', () => {
    afterEach(() => {
      // Clean up env variables
      delete process.env.SENTRY_URL
      delete process.env.SENTRY_DSN
    })

    describe('SENTRY_DSN', () => {
      it('configures sentry via the SENTRY_DSN ', () => {
        process.env.SENTRY_DSN = '1233'
        expect(() => {
          createProbot()
        }).toThrow(/Invalid Sentry DSN: 1233/)
      })
    })
  })
})
