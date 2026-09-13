/**
 * Anon match: live video chat (text secondary) with a similar phenotype (50%+).
 * Persistence is injected via the datastore (Firestore in production).
 */

import { rankMatches } from './matching.mjs'
import { userPhenotype, matches as seedCatalog } from './catalog.mjs'
import { memoryDatastore } from './memory-store.mjs'
import {
  liveReply,
  roomKey,
  serializeRoom,
  toUmingleMatch,
} from './umingle-models.mjs'

export const ANON_MIN_COMPAT = 50

export { candidateFromPhenotype, seedGuestFromMatch } from './umingle-models.mjs'

export function createUmingle(store) {
  async function join({ guestId, phenotype }) {
    if (!phenotype) {
      throw new Error('phenotype_required')
    }

    let guest = guestId ? await store.getGuest(guestId) : null
    if (!guest || guest.seeded) {
      guest = {
        id: `guest-${crypto.randomUUID()}`,
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
      await store.saveGuest(guest)
      return guest
    }

    guest = {
      ...guest,
      phenotype,
      displayName: `Guest ${phenotype.code}`,
      genealogy: phenotype.genealogyLikelihood,
    }
    await store.saveGuest(guest)
    return guest
  }

  async function listMatches(guest) {
    const others = (await store.listGuests())
      .filter((other) => other.id !== guest.id)
      .map(toUmingleMatch)
    return rankMatches(guest.phenotype, others)
  }

  async function similarMatches(guest) {
    const ranked = await listMatches(guest)
    return ranked.filter((match) => match.compatibility >= ANON_MIN_COMPAT)
  }

  async function openChat(guestId, peerGuestId, compatibility = null) {
    const guest = await store.getGuest(guestId)
    const peer = await store.getGuest(peerGuestId)
    if (!guest || !peer) {
      throw new Error('guest_not_found')
    }
    if (guestId === peerGuestId) {
      throw new Error('cannot_chat_self')
    }

    const id = roomKey(guestId, peerGuestId)
    let room = await store.getRoom(id)
    if (!room) {
      room = {
        id,
        matchType: 'anonymous',
        participantIds: [guestId, peerGuestId],
        compatibility,
        messages: [],
      }
    }
    if (compatibility != null) {
      room = { ...room, compatibility }
    }
    if (!room.messages || room.messages.length === 0) {
      room = {
        ...room,
        messages: [
          {
            id: `msg-${crypto.randomUUID()}`,
            fromGuestId: peer.id,
            text: 'Hey — similar phenotype. This is a live video chat.',
            createdAt: Date.now(),
          },
        ],
      }
    }
    await store.saveRoom(room)
    return serializeRoom(room, guestId, peer)
  }

  async function connectSimilar(guest, { skipPeerId } = {}) {
    const ranked = (await similarMatches(guest)).filter((match) => match.guestId !== skipPeerId)
    const pick = ranked[0]
    if (!pick) return null
    return openChat(guest.id, pick.guestId, pick.compatibility)
  }

  async function getChat(roomId, guestId) {
    const room = await store.getRoom(roomId)
    if (!room) return null
    if (!room.participantIds.includes(guestId)) {
      throw new Error('not_a_participant')
    }
    const peerId = room.participantIds.find((id) => id !== guestId)
    const peer = peerId ? await store.getGuest(peerId) : null
    return serializeRoom(room, guestId, peer)
  }

  async function postMessage(roomId, guestId, text) {
    const trimmed = String(text || '').trim()
    if (!trimmed) {
      throw new Error('empty_message')
    }
    const room = await store.getRoom(roomId)
    if (!room) {
      throw new Error('room_not_found')
    }
    if (!room.participantIds.includes(guestId)) {
      throw new Error('not_a_participant')
    }

    const messages = [...(room.messages || [])]
    messages.push({
      id: `msg-${crypto.randomUUID()}`,
      fromGuestId: guestId,
      text: trimmed,
      createdAt: Date.now(),
    })

    const peerId = room.participantIds.find((id) => id !== guestId)
    const peer = peerId ? await store.getGuest(peerId) : null
    if (peer) {
      messages.push({
        id: `msg-${crypto.randomUUID()}`,
        fromGuestId: peer.id,
        text: liveReply(peer),
        createdAt: Date.now() + 1,
      })
    }

    const next = { ...room, messages }
    await store.saveRoom(next)
    return serializeRoom(next, guestId, peer)
  }

  async function poolSize() {
    return (await store.listGuests()).length
  }

  return {
    join,
    listMatches,
    similarMatches,
    openChat,
    connectSimilar,
    getChat,
    postMessage,
    poolSize,
  }
}

const defaultStore = memoryDatastore({ userPhenotype, matches: seedCatalog })
const defaultUmingle = createUmingle(defaultStore)

export function joinUmingle(args) {
  return defaultUmingle.join(args)
}

export function listUmingleMatches(guest) {
  return defaultUmingle.listMatches(guest)
}

export function openChat(guestId, peerGuestId, compatibility) {
  return defaultUmingle.openChat(guestId, peerGuestId, compatibility)
}

export function connectSimilar(guest, options) {
  return defaultUmingle.connectSimilar(guest, options)
}

export function getChat(roomId, guestId) {
  return defaultUmingle.getChat(roomId, guestId)
}

export function postMessage(roomId, guestId, text) {
  return defaultUmingle.postMessage(roomId, guestId, text)
}

export function getGuest(guestId) {
  return defaultStore.getGuest(guestId)
}

export function uminglePoolSize() {
  return defaultUmingle.poolSize()
}
