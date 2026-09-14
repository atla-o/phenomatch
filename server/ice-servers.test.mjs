import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_ICE_SERVERS,
  hasTurnServer,
  iceServersFromEnv,
  parseIceServersJson,
} from '../shared/ice-servers.mjs'

describe('ice servers', () => {
  it('ships public TURN plus extra STUN by default', () => {
    assert.equal(hasTurnServer(DEFAULT_ICE_SERVERS), true)
    assert.ok(DEFAULT_ICE_SERVERS.some((item) => String(item.urls).includes('stun.l.google.com')))
    assert.ok(DEFAULT_ICE_SERVERS.some((item) => String(item.urls).includes('stun.cloudflare.com')))
    assert.ok(DEFAULT_ICE_SERVERS.some((item) => String(item.urls).startsWith('turn:')))
    assert.deepEqual(iceServersFromEnv({}), DEFAULT_ICE_SERVERS)
  })

  it('accepts a JSON override and turn URL env without Devo secrets', () => {
    const custom = iceServersFromEnv({
      PHENOMATCH_ICE_SERVERS: JSON.stringify([
        { urls: 'stun:stun.example:3478' },
        { urls: 'turn:turn.example:80', username: 'guest', credential: 'guest' },
      ]),
    })
    assert.equal(custom.length, 2)
    assert.equal(custom[1].username, 'guest')

    const fromUrls = iceServersFromEnv({
      PHENOMATCH_TURN_URLS: 'turn:relay.example:80,turns:relay.example:443',
      PHENOMATCH_TURN_USERNAME: 'demo',
      PHENOMATCH_TURN_CREDENTIAL: 'demo',
    })
    assert.equal(hasTurnServer(fromUrls), true)
    assert.equal(fromUrls.some((item) => item.urls === 'turns:relay.example:443'), true)
    assert.equal(parseIceServersJson('not-json'), null)
  })
})
