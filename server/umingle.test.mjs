import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { userPhenotype, matches } from './catalog.mjs'
import { memoryDatastore } from './memory-store.mjs'
import { ANON_MIN_COMPAT, PRESENCE_TTL_MS, createUmingle } from './umingle.mjs'

function fresh(clock = { now: Date.now() }) {
  const store = memoryDatastore({ userPhenotype, matches })
  return createUmingle(store, { now: () => clock.now })
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
    assert.equal(await umingle.connectSimilar(a), null)
    const room = await umingle.connectSimilar(b)
    assert.ok(room)
    assert.ok((room.compatibility ?? 0) >= ANON_MIN_COMPAT)
    assert.equal(room.peer.guestId, a.id)
    assert.equal(room.messages.length, 0)
    assert.ok(room.callId)

    const forA = await umingle.connectSimilar(a)
    assert.equal(forA.id, room.id)
    assert.equal(forA.peer.guestId, b.id)
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
    const umingle = fresh()
    const a = await umingle.join({ phenotype: userPhenotype })
    const b = await umingle.join({ phenotype: userPhenotype })
    await umingle.connectSimilar(a)
    const room = await umingle.connectSimilar(b)
    await umingle.postSignal(room.id, a.id, 'offer', { type: 'offer', sdp: 'v=0' })
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
})
