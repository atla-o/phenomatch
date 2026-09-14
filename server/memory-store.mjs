/**
 * Local / test datastore. Production (Cloud Run) must not use this.
 */

import { gcpBaseStatus } from './gcp.mjs'
import { candidateFromPhenotype } from './umingle-models.mjs'

function createLocker() {
  const locks = new Map()
  return function withLock(key, fn) {
    const prev = locks.get(key) || Promise.resolve()
    const next = prev.catch(() => undefined).then(fn)
    locks.set(key, next)
    return next
  }
}

export function memoryDatastore(catalog) {
  const phenotypes = new Map()
  const candidates = new Map()
  const guests = new Map()
  const rooms = new Map()
  const withRoomLock = createLocker()

  for (const match of catalog.matches) {
    const record = {
      ...match,
      id: match.phenotype.id,
      seeded: true,
    }
    candidates.set(record.id, record)
  }

  return {
    mode: 'memory-stub',
    async status() {
      return {
        ...gcpBaseStatus(),
        connected: false,
        mode: 'memory-stub',
        reason:
          'Local/dev memory catalog. Production on Cloud Run uses Firestore in devo-holding.',
      }
    },
    async getPhenotype(profileId) {
      const saved = phenotypes.get(profileId)
      if (saved) {
        return { phenotype: saved.phenotype, hasProfile: true }
      }
      return { phenotype: catalog.userPhenotype, hasProfile: false }
    },
    async savePhenotype(profileId, next) {
      if (!next || typeof next !== 'object') {
        const current = await this.getPhenotype(profileId)
        return current.phenotype
      }
      const prev = phenotypes.get(profileId)?.phenotype || catalog.userPhenotype
      const phenotype = { ...prev, ...next }
      phenotypes.set(profileId, { phenotype, hasProfile: true })
      const candidate = candidateFromPhenotype(phenotype, profileId)
      candidates.set(candidate.id, candidate)
      return phenotype
    },
    async linkGene(profileId, { fileName, size, mimeType }) {
      const name = String(fileName || '').trim()
      if (!name) {
        throw new Error('gene_file_required')
      }
      const current = (await this.getPhenotype(profileId)).phenotype
      const phenotype = {
        ...current,
        geneLinked: true,
        geneFileName: name,
        genealogyLikelihood: Math.min(99, (current.genealogyLikelihood ?? 0) + 8),
        genealogyLineage: current.genealogyLineage.includes(name)
          ? current.genealogyLineage
          : `${current.genealogyLineage} · linked ${name}`,
      }
      await this.savePhenotype(profileId, phenotype)
      void size
      void mimeType
      return phenotype
    },
    async listCandidates({ excludeProfileId } = {}) {
      return [...candidates.values()].filter((item) => item.profileId !== excludeProfileId)
    },
    async recordMatchQuery() {
      return null
    },
    async getGuest(guestId) {
      return guests.get(guestId) || null
    },
    async saveGuest(guest) {
      guests.set(guest.id, guest)
      return guest
    },
    async listGuests() {
      return [...guests.values()]
    },
    async getRoom(roomId) {
      return rooms.get(roomId) || null
    },
    async saveRoom(room) {
      return withRoomLock(room.id, async () => {
        rooms.set(room.id, room)
        return room
      })
    },
    async updateRoom(roomId, mutate) {
      if (!roomId) return null
      return withRoomLock(roomId, async () => {
        const room = rooms.get(roomId) || null
        if (!room) return null
        const next = await mutate(room)
        if (!next) return null
        rooms.set(roomId, next)
        return next
      })
    },
  }
}

export function unavailableDatastore(error) {
  const message = String(error?.message || error)
  const status = {
    ...gcpBaseStatus(),
    connected: false,
    mode: 'firestore-unavailable',
    reason: `Firestore in devo-holding is required on the production path. ${message}`,
  }
  const fail = () => {
    const err = new Error('firestore_unavailable')
    err.code = 'FIRESTORE_UNAVAILABLE'
    throw err
  }
  return {
    mode: 'firestore-unavailable',
    async status() {
      return status
    },
    getPhenotype: fail,
    savePhenotype: fail,
    linkGene: fail,
    listCandidates: fail,
    recordMatchQuery: fail,
    getGuest: fail,
    saveGuest: fail,
    listGuests: fail,
    getRoom: fail,
    saveRoom: fail,
    updateRoom: fail,
  }
}
