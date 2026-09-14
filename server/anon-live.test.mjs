import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ANON_MIN_COMPAT,
  PRESENCE_TTL_MS,
  isLiveGuest,
  isOfferer,
  isValidSignalType,
  pruneSignals,
  signalsForPeer,
} from '../shared/anon-live.mjs'

describe('anon live helpers', () => {
  it('treats only recently seen, non-seeded guests as live', () => {
    const now = 50_000
    assert.equal(isLiveGuest({ seeded: false, lastSeen: now, status: 'lobby' }, now), true)
    assert.equal(isLiveGuest({ seeded: true, lastSeen: now, status: 'lobby' }, now), false)
    assert.equal(isLiveGuest({ seeded: false, lastSeen: now - PRESENCE_TTL_MS - 1, status: 'seeking' }, now), false)
    assert.equal(isLiveGuest({ seeded: false, lastSeen: now, status: 'offline' }, now), false)
    assert.equal(isLiveGuest({ seeded: false, lastSeen: 0, status: 'lobby' }, now), false)
  })

  it('picks a stable WebRTC offerer', () => {
    assert.equal(isOfferer('guest-a', 'guest-b'), true)
    assert.equal(isOfferer('guest-b', 'guest-a'), false)
    assert.equal(ANON_MIN_COMPAT, 50)
  })

  it('prunes and filters signaling payloads', () => {
    const signals = Array.from({ length: 50 }, (_, i) => ({
      id: `s${i}`,
      fromGuestId: i % 2 === 0 ? 'a' : 'b',
    }))
    const kept = pruneSignals(signals, 8)
    assert.equal(kept.length, 8)
    assert.equal(kept[0].id, 's42')
    assert.deepEqual(
      signalsForPeer(kept, 'a').map((item) => item.fromGuestId),
      ['b', 'b', 'b', 'b'],
    )
    assert.equal(isValidSignalType('offer'), true)
    assert.equal(isValidSignalType('candidate'), false)
    assert.deepEqual(pruneSignals(null), [])
  })
})
