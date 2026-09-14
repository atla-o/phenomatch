/**
 * Anon match: live video chat (text secondary) with a similar phenotype (50%+).
 * Persistence is injected via the datastore (Firestore in production).
 * Catalog seeds are Data-only — they never appear as Anon live peers.
 */

import { rankMatches } from './matching.mjs'
import { userPhenotype, matches as seedCatalog } from './catalog.mjs'
import { memoryDatastore } from './memory-store.mjs'
import { roomKey, serializeRoom, toUmingleMatch } from './umingle-models.mjs'
import {
  ANON_MIN_COMPAT,
  PAIR_ATTEMPTS,
  PRESENCE_TTL_MS,
  isLiveGuest,
  isPairableGuest,
  isValidSignalType,
  pruneSignals,
  selectPairingPicks,
} from '../shared/anon-live.mjs'

export { ANON_MIN_COMPAT, PRESENCE_TTL_MS }
export { candidateFromPhenotype, seedGuestFromMatch } from './umingle-models.mjs'

export function createUmingle(store, { now = () => Date.now(), ttlMs = PRESENCE_TTL_MS } = {}) {
  function clock() {
    return now()
  }

  async function peerOf(room, guestId) {
    const peerId = (room.participantIds || []).find((id) => id !== guestId)
    return peerId ? store.getGuest(peerId) : null
  }

  async function touch(guest, patch = {}) {
    const latest = (guest?.id && (await store.getGuest(guest.id))) || guest
    const next = {
      ...latest,
      ...patch,
      lastSeen: clock(),
      seeded: false,
      anonymous: true,
    }
    await store.saveGuest(next)
    return next
  }

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
        joinedAt: clock(),
        lastSeen: clock(),
        status: 'lobby',
        roomId: null,
        skipPeerId: null,
      }
      await store.saveGuest(guest)
      return guest
    }

    const keepStatus =
      guest.status === 'connected' || guest.status === 'seeking' ? guest.status : 'lobby'

    return touch(guest, {
      phenotype,
      displayName: `Guest ${phenotype.code}`,
      genealogy: phenotype.genealogyLikelihood,
      status: keepStatus,
    })
  }

  async function listLive(excludeId) {
    const t = clock()
    return (await store.listGuests()).filter(
      (other) => other.id !== excludeId && isLiveGuest(other, t, ttlMs),
    )
  }

  async function listMatches(guest) {
    return rankMatches(guest.phenotype, (await listLive(guest.id)).map(toUmingleMatch))
  }

  async function similarMatches(guest) {
    const ranked = await listMatches(guest)
    return ranked.filter((match) => match.compatibility >= ANON_MIN_COMPAT)
  }

  async function presence(guest) {
    const matches = await listMatches(guest)
    const similar = matches.filter((match) => match.compatibility >= ANON_MIN_COMPAT)
    const liveCount = (await listLive()).length
    return {
      matches,
      similar,
      similarCount: similar.length,
      liveCount,
    }
  }

  async function getChat(roomId, guestId) {
    const room = await store.getRoom(roomId)
    if (!room) return null
    if (!room.participantIds.includes(guestId)) {
      throw new Error('not_a_participant')
    }
    return serializeRoom(room, guestId, await peerOf(room, guestId))
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
    const callId = `call-${clock()}`
    if (!room) {
      room = {
        id,
        matchType: 'anonymous',
        participantIds: [guestId, peerGuestId],
        compatibility,
        messages: [],
        signals: [],
        callId,
        endedAt: null,
        leftBy: null,
      }
    } else {
      room = {
        ...room,
        compatibility: compatibility != null ? compatibility : room.compatibility,
        signals: [],
        callId,
        endedAt: null,
        leftBy: null,
      }
    }
    await store.saveRoom(room)
    await touch(guest, { status: 'connected', roomId: room.id })
    const peerNow = await touch(peer, { status: 'connected', roomId: room.id })
    return serializeRoom(room, guestId, peerNow)
  }

  async function pairWith(guest, peer, compatibility) {
    return openChat(guest.id, peer.id, compatibility)
  }

  async function endRoom(roomId, guestId) {
    const room = await store.getRoom(roomId)
    if (!room || room.endedAt) return room
    const next = {
      ...room,
      endedAt: clock(),
      leftBy: guestId,
    }
    await store.saveRoom(next)
    return next
  }

  async function readAssignedRoom(guestId) {
    const latest = await store.getGuest(guestId)
    if (!latest?.roomId) return { guest: latest, room: null }
    const existing = await store.getRoom(latest.roomId)
    if (existing && !existing.endedAt) {
      const guest = await touch(latest, { status: 'connected' })
      return {
        guest,
        room: serializeRoom(existing, guest.id, await peerOf(existing, guest.id)),
      }
    }
    return { guest: latest, room: null }
  }

  async function connectSimilar(guest, { skipPeerId } = {}) {
    let current = (await store.getGuest(guest.id)) || guest

    if (skipPeerId && current.roomId) {
      await endRoom(current.roomId, current.id)
      current = await touch(current, {
        status: 'seeking',
        skipPeerId,
        roomId: null,
      })
    } else {
      const assigned = await readAssignedRoom(current.id)
      if (assigned.room) return assigned.room
      current = assigned.guest || current
      current = await touch(current, {
        status: 'seeking',
        skipPeerId: skipPeerId || current.skipPeerId || null,
      })
      const again = await readAssignedRoom(current.id)
      if (again.room) return again.room
      current = again.guest || current
      if (current.roomId) {
        current = await touch(current, { status: 'seeking', roomId: null })
      }
    }

    for (let attempt = 0; attempt < PAIR_ATTEMPTS; attempt += 1) {
      const assigned = await readAssignedRoom(current.id)
      if (assigned.room) return assigned.room
      current = assigned.guest || current

      const others = await listLive(current.id)
      const pairable = others.filter(
        (peer) =>
          peer.id !== current.skipPeerId &&
          peer.skipPeerId !== current.id &&
          !peer.roomId &&
          isPairableGuest(peer, clock(), ttlMs),
      )
      const ranked = rankMatches(current.phenotype, pairable.map(toUmingleMatch))
      const { picks } = selectPairingPicks(ranked, {
        otherLiveCount: others.length,
        seekingPeerCount: pairable.filter((peer) => peer.status === 'seeking').length,
        selfSeeking: true,
      })

      for (const pick of picks) {
        const latest = await readAssignedRoom(current.id)
        if (latest.room) return latest.room
        current = latest.guest || current
        const peer = await store.getGuest(pick.guestId)
        if (
          !peer ||
          peer.id === current.skipPeerId ||
          peer.skipPeerId === current.id ||
          peer.roomId ||
          !isPairableGuest(peer, clock(), ttlMs)
        ) {
          continue
        }
        return pairWith(current, peer, pick.compatibility)
      }
    }
    return null
  }

  async function heartbeat(guestId) {
    const guest = guestId ? await store.getGuest(guestId) : null
    if (!guest || guest.seeded) return null
    let current = await touch(guest, {})
    const assigned = await readAssignedRoom(current.id)
    if (assigned.room) {
      return { guest: assigned.guest, room: assigned.room }
    }
    current = assigned.guest || current
    if (current.status === 'seeking') {
      const room = await connectSimilar(current)
      current = (await store.getGuest(current.id)) || current
      return { guest: current, room }
    }
    return { guest: current, room: null }
  }

  async function leave(guestId, { goOffline = false } = {}) {
    const guest = await store.getGuest(guestId)
    if (!guest) return null
    if (guest.roomId) {
      await endRoom(guest.roomId, guestId)
    }
    return touch(guest, {
      status: goOffline ? 'offline' : 'lobby',
      roomId: null,
    })
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
      createdAt: clock(),
    })

    const next = { ...room, messages }
    await store.saveRoom(next)
    return serializeRoom(next, guestId, await peerOf(next, guestId))
  }

  async function getSignals(roomId, guestId) {
    const room = await store.getRoom(roomId)
    if (!room) return null
    if (!room.participantIds.includes(guestId)) {
      throw new Error('not_a_participant')
    }
    return {
      id: room.id,
      callId: room.callId || null,
      endedAt: room.endedAt || null,
      peerLeft: Boolean(room.endedAt && room.leftBy && room.leftBy !== guestId),
      signals: Array.isArray(room.signals) ? room.signals : [],
    }
  }

  async function mutateRoom(roomId, guestId, mutate) {
    if (typeof store.updateRoom === 'function') {
      const next = await store.updateRoom(roomId, (room) => {
        if (!room.participantIds.includes(guestId)) {
          throw new Error('not_a_participant')
        }
        return mutate(room)
      })
      if (!next) {
        throw new Error('room_not_found')
      }
      return next
    }

    const room = await store.getRoom(roomId)
    if (!room) {
      throw new Error('room_not_found')
    }
    if (!room.participantIds.includes(guestId)) {
      throw new Error('not_a_participant')
    }
    const next = await mutate(room)
    await store.saveRoom(next)
    return next
  }

  async function postSignal(roomId, guestId, type, payload) {
    if (!isValidSignalType(type)) {
      throw new Error('bad_signal')
    }
    if (!payload || typeof payload !== 'object') {
      throw new Error('signal_payload_required')
    }

    const signal = {
      id: `sig-${crypto.randomUUID()}`,
      fromGuestId: guestId,
      type,
      payload,
      createdAt: clock(),
    }
    const next = await mutateRoom(roomId, guestId, (room) => ({
      ...room,
      signals: pruneSignals([...(room.signals || []), signal]),
    }))
    return serializeRoom(next, guestId, await peerOf(next, guestId))
  }

  async function restartCall(roomId, guestId) {
    const next = await mutateRoom(roomId, guestId, (room) => {
      if (room.endedAt) {
        throw new Error('room_ended')
      }
      return {
        ...room,
        signals: [],
        callId: `call-${clock()}-${crypto.randomUUID()}`,
      }
    })
    return serializeRoom(next, guestId, await peerOf(next, guestId))
  }

  async function poolSize() {
    return (await listLive()).length
  }

  return {
    join,
    listMatches,
    similarMatches,
    presence,
    openChat,
    connectSimilar,
    getChat,
    getSignals,
    postMessage,
    postSignal,
    restartCall,
    heartbeat,
    leave,
    listLive,
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
