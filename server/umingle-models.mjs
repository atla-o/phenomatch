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
  }
}

export function roomKey(a, b) {
  return [a, b].sort().join('__')
}

export function liveReply(peer) {
  return `Still here. ${peer.displayName} — similar phenotype.`
}

export function serializeRoom(room, guestId, peer) {
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
    messages: (room.messages || []).map((m) => ({
      id: m.id,
      fromGuestId: m.fromGuestId,
      mine: m.fromGuestId === guestId,
      text: m.text,
      createdAt: m.createdAt,
    })),
  }
}
