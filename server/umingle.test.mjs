import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { userPhenotype, matches } from './catalog.mjs'
import { memoryDatastore } from './memory-store.mjs'
import { ANON_MIN_COMPAT, PRESENCE_TTL_MS, createUmingle } from './umingle.mjs'
import { isLiveGuest } from '../shared/anon-live.mjs'

function fresh(clock = { now: Date.now() }) {
  const store = memoryDatastore({ userPhenotype, matches })
  return createUmingle(store, { now: () => clock.now })
}

function farPhenotype() {
  return {
    ...userPhenotype,
    id: 'far-cluster',
    name: 'Far Cluster',
    code: 'GN-FAR',
    genealogyLikelihood: 0,
    traits: userPhenotype.traits.map((trait) => ({ ...trait, value: 0 })),
  }
}

describe('umingle', () => {
  it('joins without an account and does not list catalog seeds', async () => {
    const umingle = fresh()
    const guest = await umingle.join({ phenotype: userPhenotype })
    assert.equal(guest.anonymous, true)
    assert.match(guest.id, /^guest-/)
    assert.equal(guest.displayName, `Guest ${userPhenotype.code}`)
    assert.equal(guest.status, 'lobby')

    const listed = await umingle.listMatches(guest)
    assert.equal(listed.length, 0)
    assert.equal(await umingle.poolSize(), 1)
  })

  it('shows another live guest and ranks by phenotype', async () => {
    const umingle = fresh()
    const guest = await umingle.join({ phenotype: userPhenotype })
    const peer = await umingle.join({ phenotype: userPhenotype })
    const matchesForGuest = await umingle.listMatches(guest)
    assert.equal(matchesForGuest.length, 1)
    assert.equal(matchesForGuest[0].guestId, peer.id)
    assert.equal(matchesForGuest[0].matchType, 'anonymous')
    assert.ok(matchesForGuest[0].compatibility >= ANON_MIN_COMPAT)
  })

  it('waits when only one guest is seeking', async () => {
    const umingle = fresh()
    const guest = await umingle.join({ phenotype: userPhenotype })
    const room = await umingle.connectSimilar(guest)
    assert.equal(room, null)
    const snapshot = await umingle.presence(guest)
    assert.equal(snapshot.liveCount, 1)
    assert.equal(snapshot.similarCount, 0)
  })

  it('live-connects two similar guests at 50%+', async () => {
    const umingle = fresh()
    const a = await umingle.join({ phenotype: userPhenotype })
    const b = await umingle.join({ phenotype: userPhenotype })
    const room = await umingle.connectSimilar(a)
    assert.ok(room)
    assert.ok((room.compatibility ?? 0) >= ANON_MIN_COMPAT)
    assert.equal(room.peer.guestId, b.id)
    assert.equal(room.messages.length, 0)
    assert.ok(room.callId)

    const forB = await umingle.connectSimilar(b)
    assert.equal(forB.id, room.id)
    assert.equal(forB.peer.guestId, a.id)
  })

  it('does not auto-reply and exchanges signals', async () => {
    const umingle = fresh()
    const a = await umingle.join({ phenotype: userPhenotype })
    const b = await umingle.join({ phenotype: userPhenotype })
    await umingle.connectSimilar(a)
    const room = await umingle.connectSimilar(b)
    const after = await umingle.postMessage(room.id, b.id, 'Your cluster lined up.')
    assert.equal(after.messages.length, 1)
    assert.equal(after.messages[0].mine, true)
    assert.equal(after.messages.some((m) => !m.mine), false)

    const signaled = await umingle.postSignal(room.id, b.id, 'offer', {
      type: 'offer',
      sdp: 'v=0',
    })
    assert.equal(signaled.signals.length, 1)
    assert.equal(signaled.signals[0].type, 'offer')
    const seen = await umingle.getChat(room.id, a.id)
    assert.equal(seen.signals[0].fromGuestId, b.id)
  })

  it('expires guests who stop heartbeating', async () => {
    const clock = { now: 1_000_000 }
    const umingle = fresh(clock)
    const a = await umingle.join({ phenotype: userPhenotype })
    await umingle.join({ phenotype: userPhenotype })
    assert.equal((await umingle.listMatches(a)).length, 1)
    clock.now += PRESENCE_TTL_MS + 1
    assert.equal((await umingle.listMatches(a)).length, 0)
    const beat = await umingle.heartbeat(a.id)
    assert.ok(beat?.guest)
    assert.equal((await umingle.listMatches(a)).length, 0)
  })

  it('keeps every concurrent signal instead of last-write-wins', async () => {
    const umingle = fresh()
    const a = await umingle.join({ phenotype: userPhenotype })
    const b = await umingle.join({ phenotype: userPhenotype })
    await umingle.connectSimilar(a)
    const room = await umingle.connectSimilar(b)
    const posts = [
      umingle.postSignal(room.id, a.id, 'offer', { type: 'offer', sdp: 'offer-a' }),
      umingle.postSignal(room.id, b.id, 'answer', { type: 'answer', sdp: 'answer-b' }),
      umingle.postSignal(room.id, a.id, 'ice', { candidate: 'a1' }),
      umingle.postSignal(room.id, b.id, 'ice', { candidate: 'b1' }),
      umingle.postSignal(room.id, a.id, 'ice', { candidate: 'a2' }),
      umingle.postSignal(room.id, b.id, 'ice', { candidate: 'b2' }),
    ]
    await Promise.all(posts)
    const seen = await umingle.getChat(room.id, a.id)
    assert.equal(seen.signals.length, 6)
    assert.deepEqual(
      seen.signals.map((item) => item.type).sort(),
      ['answer', 'ice', 'ice', 'ice', 'ice', 'offer'],
    )
    const light = await umingle.getSignals(room.id, b.id)
    assert.equal(light.signals.length, 6)
    assert.equal(light.callId, room.callId)
  })

  it('restart clears signals and bumps callId', async () => {
    const clock = { now: 2_000_000 }
    const umingle = fresh(clock)
    const a = await umingle.join({ phenotype: userPhenotype })
    const b = await umingle.join({ phenotype: userPhenotype })
    await umingle.connectSimilar(a)
    const room = await umingle.connectSimilar(b)
    await umingle.postSignal(room.id, a.id, 'offer', { type: 'offer', sdp: 'v=0' })
    clock.now += 1
    const restarted = await umingle.restartCall(room.id, b.id)
    assert.ok(restarted.callId)
    assert.notEqual(restarted.callId, room.callId)
    assert.equal(restarted.signals.length, 0)
    const seen = await umingle.getSignals(room.id, a.id)
    assert.equal(seen.callId, restarted.callId)
    assert.equal(seen.signals.length, 0)
  })

  it('skip ends the room so the peer sees they left', async () => {
    const umingle = fresh()
    const a = await umingle.join({ phenotype: userPhenotype })
    const b = await umingle.join({ phenotype: userPhenotype })
    await umingle.connectSimilar(a)
    const room = await umingle.connectSimilar(b)
    const skipped = await umingle.connectSimilar(b, { skipPeerId: a.id })
    assert.equal(skipped, null)
    const leftover = await umingle.getChat(room.id, a.id)
    assert.equal(leftover.peerLeft, true)
  })

  it('heartbeat keeps seeking presence without going offline', async () => {
    const clock = { now: 3_000_000 }
    const umingle = fresh(clock)
    const a = await umingle.join({ phenotype: userPhenotype })
    assert.equal(await umingle.connectSimilar(a), null)
    const beat = await umingle.heartbeat(a.id)
    assert.equal(beat.guest.status, 'seeking')
    assert.equal(isLiveGuest(beat.guest, clock.now), true)
  })

  it('leave without goOffline stays live in lobby', async () => {
    const clock = { now: 4_000_000 }
    const umingle = fresh(clock)
    const a = await umingle.join({ phenotype: userPhenotype })
    await umingle.connectSimilar(a)
    const left = await umingle.leave(a.id, { goOffline: false })
    assert.equal(left.status, 'lobby')
    assert.equal(isLiveGuest(left, clock.now), true)
    const offline = await umingle.leave(a.id, { goOffline: true })
    assert.equal(offline.status, 'offline')
    assert.equal(isLiveGuest(offline, clock.now), false)
  })

  it('pairs a seeking guest with a live lobby peer', async () => {
    const umingle = fresh()
    const a = await umingle.join({ phenotype: userPhenotype })
    const b = await umingle.join({ phenotype: userPhenotype })
    const room = await umingle.connectSimilar(b)
    assert.ok(room)
    assert.equal(room.peer.guestId, a.id)
    const forA = await umingle.heartbeat(a.id)
    assert.equal(forA.room.id, room.id)
  })

  it('pairs two live guests below 50% when they are the only ones', async () => {
    const umingle = fresh()
    const a = await umingle.join({ phenotype: userPhenotype })
    const b = await umingle.join({ phenotype: farPhenotype() })
    const ranked = await umingle.listMatches(a)
    assert.ok(ranked[0].compatibility < ANON_MIN_COMPAT)
    const room = await umingle.connectSimilar(a)
    assert.ok(room)
    assert.equal(room.peer.guestId, b.id)
    assert.ok((room.compatibility ?? 0) < ANON_MIN_COMPAT)
  })

  it('pairs when both guests go live at once', async () => {
    const umingle = fresh()
    const a = await umingle.join({ phenotype: userPhenotype })
    const b = await umingle.join({ phenotype: userPhenotype })
    const [first, second] = await Promise.all([umingle.connectSimilar(a), umingle.connectSimilar(b)])
    const room = first || second
    assert.ok(room)
    const againA = await umingle.connectSimilar(a)
    const againB = await umingle.connectSimilar(b)
    assert.equal(againA.id, againB.id)
    assert.equal(againA.id, room.id)
  })

  it('openChat assigns a room both heartbeats can see', async () => {
    const umingle = fresh()
    const a = await umingle.join({ phenotype: userPhenotype })
    const b = await umingle.join({ phenotype: userPhenotype })
    const room = await umingle.openChat(a.id, b.id, 41)
    assert.equal(room.peer.guestId, b.id)
    assert.equal(room.compatibility, 41)
    const beatA = await umingle.heartbeat(a.id)
    const beatB = await umingle.heartbeat(b.id)
    assert.equal(beatA.room.id, room.id)
    assert.equal(beatB.room.id, room.id)
    assert.equal(beatA.guest.status, 'connected')
    assert.equal(beatB.guest.status, 'connected')
    const sent = await umingle.postMessage(room.id, a.id, 'text works without video')
    assert.equal(sent.messages[0].text, 'text works without video')
  })
})
