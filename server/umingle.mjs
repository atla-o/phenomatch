/**
 * Anonymous match: no-account phenotype matching for chat.
 * Profile match ranks guests by visual traits, tribe, and genealogy.
 */

import { rankMatches } from './matching.mjs'
import { matches as seedCatalog } from './catalog.mjs'

const guests = new Map()
const rooms = new Map()

function seedPool() {
  for (const match of seedCatalog) {
    const id = `guest-seed-${match.phenotype.id}`
    guests.set(id, {
      id,
      anonymous: true,
      seeded: true,
      displayName: `Guest ${match.phenotype.code}`,
      phenotype: match.phenotype,
      genealogy: match.genealogy,
      sharedTraits: match.sharedTraits,
      complementaryTraits: match.complementaryTraits,
      distance: 'nearby',
      joinedAt: Date.now(),
    })
  }
}

seedPool()

function toUmingleMatch(guest) {
  return {
    phenotype: guest.phenotype,
    compatibility: 0,
    sharedTraits: guest.sharedTraits,
    complementaryTraits: guest.complementaryTraits,
    distance: guest.distance,
    age: null,
    virginity: 'undisclosed',
    genealogy: guest.genealogy,
    matchType: 'anonymous',
    guestId: guest.id,
    anonymous: true,
  }
}

export function getGuest(guestId) {
  return guests.get(guestId) || null
}

export function joinUmingle({ guestId, phenotype }) {
  if (!phenotype) {
    throw new Error('phenotype_required')
  }

  let guest = guestId ? guests.get(guestId) : null
  if (!guest || guest.seeded) {
    const id = `guest-${crypto.randomUUID()}`
    guest = {
      id,
      anonymous: true,
      seeded: false,
      displayName: `Guest ${phenotype.code}`,
      phenotype,
      genealogy: phenotype.genealogyLikelihood,
      sharedTraits: [],
      complementaryTraits: [],
      distance: 'here',
      joinedAt: Date.now(),
    }
    guests.set(id, guest)
    return guest
  }

  guest.phenotype = phenotype
  guest.displayName = `Guest ${phenotype.code}`
  guest.genealogy = phenotype.genealogyLikelihood
  return guest
}

export function listUmingleMatches(guest) {
  const others = [...guests.values()]
    .filter((other) => other.id !== guest.id)
    .map(toUmingleMatch)
  return rankMatches(guest.phenotype, others)
}

function roomKey(a, b) {
  return [a, b].sort().join('__')
}

export function openChat(guestId, peerGuestId) {
  const guest = guests.get(guestId)
  const peer = guests.get(peerGuestId)
  if (!guest || !peer) {
    throw new Error('guest_not_found')
  }
  if (guestId === peerGuestId) {
    throw new Error('cannot_chat_self')
  }

  const id = roomKey(guestId, peerGuestId)
  let room = rooms.get(id)
  if (!room) {
    room = {
      id,
      matchType: 'anonymous',
      participantIds: [guestId, peerGuestId],
      messages: [],
    }
    rooms.set(id, room)
  }
  return serializeRoom(room, guestId)
}

export function getChat(roomId, guestId) {
  const room = rooms.get(roomId)
  if (!room) return null
  if (!room.participantIds.includes(guestId)) {
    throw new Error('not_a_participant')
  }
  return serializeRoom(room, guestId)
}

export function postMessage(roomId, guestId, text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) {
    throw new Error('empty_message')
  }
  const room = rooms.get(roomId)
  if (!room) {
    throw new Error('room_not_found')
  }
  if (!room.participantIds.includes(guestId)) {
    throw new Error('not_a_participant')
  }

  const message = {
    id: `msg-${crypto.randomUUID()}`,
    fromGuestId: guestId,
    text: trimmed,
    createdAt: Date.now(),
  }
  room.messages.push(message)

  const peerId = room.participantIds.find((id) => id !== guestId)
  const peer = guests.get(peerId)
  const firstFromGuest = room.messages.filter((m) => m.fromGuestId === guestId).length === 1
  if (peer && firstFromGuest) {
    room.messages.push({
      id: `msg-${crypto.randomUUID()}`,
      fromGuestId: peer.id,
      text: `Cluster overlap looks real. I'm ${peer.displayName} — anonymous profile match, same as you.`,
      createdAt: Date.now() + 1,
    })
  }

  return serializeRoom(room, guestId)
}

function serializeRoom(room, guestId) {
  const peerId = room.participantIds.find((id) => id !== guestId)
  const peer = guests.get(peerId)
  return {
    id: room.id,
    matchType: 'anonymous',
    peer: peer
      ? {
          guestId: peer.id,
          displayName: peer.displayName,
          phenotype: peer.phenotype,
          anonymous: true,
        }
      : null,
    messages: room.messages.map((m) => ({
      id: m.id,
      fromGuestId: m.fromGuestId,
      mine: m.fromGuestId === guestId,
      text: m.text,
      createdAt: m.createdAt,
    })),
  }
}

export function uminglePoolSize() {
  return guests.size
}
