import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ANON_MIN_COMPAT,
  PRESENCE_TTL_MS,
  isLiveGuest,
  isOfferer,
  isPairableGuest,
  isValidSignalType,
  pruneSignals,
  selectPairingPicks,
  shouldGoOfflineOn,
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
    assert.equal(isPairableGuest({ seeded: false, lastSeen: now, status: 'lobby' }, now), true)
    assert.equal(isPairableGuest({ seeded: false, lastSeen: now, status: 'seeking' }, now), true)
    assert.equal(isPairableGuest({ seeded: false, lastSeen: now, status: 'connected' }, now), false)
    assert.equal(isPairableGuest({ seeded: false, lastSeen: now, status: 'offline' }, now), false)
  })

  it('does not force offline on React unmount', () => {
    assert.equal(shouldGoOfflineOn('unmount'), false)
    assert.equal(shouldGoOfflineOn('visibilitychange'), false)
    assert.equal(shouldGoOfflineOn('pagehide'), true)
    assert.equal(shouldGoOfflineOn('beforeunload'), true)
  })

  it('prefers 50%+ then falls back to best available for two live guests', () => {
    const ranked = [
      { id: 'low', compatibility: 22 },
      { id: 'high', compatibility: 61 },
    ]
    assert.deepEqual(
      selectPairingPicks(ranked, { otherLiveCount: 2, selfSeeking: true, seekingPeerCount: 1 }).picks.map(
        (item) => item.id,
      ),
      ['high'],
    )
    const onlyLow = [{ id: 'low', compatibility: 22 }]
    const fallback = selectPairingPicks(onlyLow, {
      otherLiveCount: 1,
      selfSeeking: true,
      seekingPeerCount: 0,
    })
    assert.equal(fallback.mode, 'best-available')
    assert.equal(fallback.picks[0].id, 'low')
    const stranded = selectPairingPicks(onlyLow, {
      otherLiveCount: 3,
      selfSeeking: true,
      seekingPeerCount: 0,
    })
    assert.equal(stranded.mode, 'none')
    const bothSeeking = selectPairingPicks(onlyLow, {
      otherLiveCount: 2,
      selfSeeking: true,
      seekingPeerCount: 1,
    })
    assert.equal(bothSeeking.mode, 'best-available')
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

  it('keeps the latest offer and answer when ICE floods the buffer', () => {
    const signals = [
      { id: 'offer-1', type: 'offer', fromGuestId: 'a' },
      ...Array.from({ length: 40 }, (_, i) => ({
        id: `ice-${i}`,
        type: 'ice',
        fromGuestId: i % 2 === 0 ? 'a' : 'b',
      })),
      { id: 'answer-1', type: 'answer', fromGuestId: 'b' },
      { id: 'offer-2', type: 'offer', fromGuestId: 'a' },
      { id: 'ice-late', type: 'ice', fromGuestId: 'b' },
    ]
    const kept = pruneSignals(signals, 6)
    assert.equal(kept.some((item) => item.id === 'offer-2'), true)
    assert.equal(kept.some((item) => item.id === 'answer-1'), true)
    assert.equal(kept.some((item) => item.id === 'offer-1'), false)
    assert.equal(kept.at(-1).id, 'ice-late')
    assert.ok(kept.length <= 6)
  })
})
