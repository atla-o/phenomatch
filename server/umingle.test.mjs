import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { userPhenotype } from './catalog.mjs'
import { joinUmingle, listUmingleMatches, openChat, postMessage } from './umingle.mjs'

describe('umingle', () => {
  it('joins without an account and ranks by phenotype', () => {
    const guest = joinUmingle({ phenotype: userPhenotype })
    assert.equal(guest.anonymous, true)
    assert.match(guest.id, /^guest-/)
    assert.equal(guest.displayName, `Guest ${userPhenotype.code}`)

    const matches = listUmingleMatches(guest)
    assert.ok(matches.length >= 4)
    assert.equal(matches.every((m) => m.matchType === 'umingle' && m.anonymous), true)
    assert.equal(matches.some((m) => m.guestId === guest.id), false)
    const scores = matches.map((m) => m.compatibility)
    const sorted = [...scores].sort((a, b) => b - a)
    assert.deepEqual(scores, sorted)
  })

  it('opens a phenotype chat and echoes a seed reply', () => {
    const guest = joinUmingle({ phenotype: userPhenotype })
    const peerId = listUmingleMatches(guest).find((m) => m.guestId.startsWith('guest-seed-'))?.guestId
    assert.ok(peerId)
    const room = openChat(guest.id, peerId)
    assert.equal(room.matchType, 'umingle')
    assert.equal(room.peer.guestId, peerId)
    assert.equal(room.messages.length, 0)

    const after = postMessage(room.id, guest.id, 'Your cluster lined up.')
    assert.equal(after.messages[0].mine, true)
    assert.equal(after.messages[0].text, 'Your cluster lined up.')
    assert.equal(after.messages.length, 2)
    assert.equal(after.messages[1].mine, false)
  })
})
