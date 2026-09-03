import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { userPhenotype } from './catalog.mjs'
import { joinUmingle, listUmingleMatches, openChat, postMessage, connectSimilar, ANON_MIN_COMPAT } from './umingle.mjs'

describe('umingle', () => {
  it('joins without an account and ranks by phenotype', () => {
    const guest = joinUmingle({ phenotype: userPhenotype })
    assert.equal(guest.anonymous, true)
    assert.match(guest.id, /^guest-/)
    assert.equal(guest.displayName, `Guest ${userPhenotype.code}`)

    const matches = listUmingleMatches(guest)
    assert.ok(matches.length >= 4)
    assert.equal(matches.every((m) => m.matchType === 'anonymous' && m.anonymous), true)
    assert.equal(matches.some((m) => m.guestId === guest.id), false)
    const scores = matches.map((m) => m.compatibility)
    const sorted = [...scores].sort((a, b) => b - a)
    assert.deepEqual(scores, sorted)
  })

  it('live-connects a similar phenotype at 50%+', () => {
    const guest = joinUmingle({ phenotype: userPhenotype })
    const room = connectSimilar(guest)
    assert.ok(room)
    assert.ok((room.compatibility ?? 0) >= ANON_MIN_COMPAT)
    assert.ok(room.messages.length >= 1)
    assert.equal(room.messages[0].mine, false)
  })

  it('opens a live phenotype chat and replies', () => {
    const guest = joinUmingle({ phenotype: userPhenotype })
    const peerId = listUmingleMatches(guest).find((m) => m.guestId.startsWith('guest-seed-'))?.guestId
    assert.ok(peerId)
    const room = openChat(guest.id, peerId, 93)
    assert.equal(room.matchType, 'anonymous')
    assert.equal(room.peer.guestId, peerId)
    assert.ok(room.messages.length >= 1)

    const after = postMessage(room.id, guest.id, 'Your cluster lined up.')
    assert.equal(after.messages.some((m) => m.mine && m.text === 'Your cluster lined up.'), true)
    assert.ok(after.messages.filter((m) => !m.mine).length >= 2)
  })
})
