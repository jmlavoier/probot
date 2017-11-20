const Webhooks = require('@octokit/webhooks')

const createRobot = require('../lib/robot')
const pushEventPayload = require('./fixtures/webhook/push')

describe('Robot', function () {
  let event
  let webhooks
  let robot

  beforeEach(function () {
    webhooks = new Webhooks({secret: 'development'})
    robot = createRobot({webhooks})
    robot.auth = () => {}
    event = {
      id: '123',
      name: 'push',
      data: pushEventPayload,
      signature: webhooks.sign(pushEventPayload)
    }
  })

  describe('constructor', () => {
    it('takes a logger', () => {
      const logger = {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn()
      }
      robot = createRobot({logger})

      robot.log('hello world')
      expect(logger.debug).toHaveBeenCalledWith('hello world')
    })

    it('exposes webhooks methods', async () => {
      const spy = jest.fn()

      robot.on('push', spy)
      await robot.receive(event)
      expect(spy.mock.calls.length).toBe(1)
    })
  })
})
