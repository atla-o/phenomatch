export function seedGuestFromMatch(match) {
  return {
    id: `guest-seed-${match.phenotype.id}`,
    anonymous: true,
    seeded: true,
    displayName: `Guest ${match.phenotype.code}`,
    phenotype: match.phenotype,
    genealogy: match.genealogy,
    sharedTraits: match.sharedTraits,
    complementaryTraits: match.complementaryTraits,
    distance: 'nearby',
    joinedAt: Date.now(),
    lastSeen: 0,
    status: 'offline',
    roomId: null,
  }
}

export function candidateFromPhenotype(phenotype, profileId) {
  return {
    id: `user-${profileId}`,
    profileId,
    seeded: false,
    phenotype,
    sharedTraits: ['Overlapping visual cluster'],
    complementaryTraits: ['Adjacent genealogy cluster'],
    distance: 'nearby',
    age: null,
    virginity: 'undisclosed',
    genealogy: phenotype.genealogyLikelihood ?? 0,
  }
}

export function toUmingleMatch(guest) {
  return {
    phenotype: guest.phenotype,
    compatibility: 0,
    sharedTraits: guest.sharedTraits || [],
    complementaryTraits: guest.complementaryTraits || [],
    distance: guest.distance || 'nearby',
    age: null,
    virginity: 'undisclosed',
    genealogy: guest.genealogy ?? guest.phenotype?.genealogyLikelihood ?? 0,
    matchType: 'anonymous',
    guestId: guest.id,
    anonymous: true,
    status: guest.status || 'lobby',
  }
}

export function roomKey(a, b) {
  return [a, b].sort().join('__')
}

export function serializeRoom(room, guestId, peer) {
  const endedAt = room.endedAt || null
  const leftBy = room.leftBy || null
  return {
    id: room.id,
    matchType: 'anonymous',
    callId: room.callId || null,
    endedAt,
    leftBy,
    peerLeft: Boolean(endedAt && leftBy && leftBy !== guestId),
    peer: peer
      ? {
          guestId: peer.id,
          displayName: peer.displayName,
          phenotype: peer.phenotype,
          anonymous: true,
          compatibility: room.compatibility ?? null,
          status: peer.status || null,
        }
      : null,
    compatibility: room.compatibility ?? null,
    signals: Array.isArray(room.signals) ? room.signals : [],
    messages: (room.messages || []).map((m) => ({
      id: m.id,
      fromGuestId: m.fromGuestId,
      mine: m.fromGuestId === guestId,
      text: m.text,
      createdAt: m.createdAt,
    })),
  }
}
