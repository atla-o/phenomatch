/**
 * Anon match: live chat with a similar phenotype (50%+).
 */

import { rankMatches } from './matching.mjs'
import { matches as seedCatalog } from './catalog.mjs'

export const ANON_MIN_COMPAT = 50

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

export function similarMatches(guest) {
  return listUmingleMatches(guest).filter((match) => match.compatibility >= ANON_MIN_COMPAT)
}

function roomKey(a, b) {
  return [a, b].sort().join('__')
}

export function openChat(guestId, peerGuestId, compatibility = null) {
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
      compatibility,
      messages: [],
    }
    rooms.set(id, room)
  }
  if (compatibility != null) {
    room.compatibility = compatibility
  }
  if (room.messages.length === 0) {
    room.messages.push({
      id: `msg-${crypto.randomUUID()}`,
      fromGuestId: peer.id,
      text: 'Hey — similar phenotype. This is a live chat.',
      createdAt: Date.now(),
    })
  }
  return serializeRoom(room, guestId)
}

export function connectSimilar(guest, { skipPeerId } = {}) {
  const ranked = similarMatches(guest).filter((match) => match.guestId !== skipPeerId)
  const pick = ranked[0]
  if (!pick) return null
  return openChat(guest.id, pick.guestId, pick.compatibility)
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
  if (peer) {
    room.messages.push({
      id: `msg-${crypto.randomUUID()}`,
      fromGuestId: peer.id,
      text: liveReply(peer),
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
          compatibility: room.compatibility ?? null,
        }
      : null,
    compatibility: room.compatibility ?? null,
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

function liveReply(peer) {
  return `Still here. ${peer.displayName} — similar phenotype.`
}
