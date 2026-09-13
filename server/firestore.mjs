/**
 * Firestore datastore for Phenomatch in GCP project devo-holding.
 * Native Firestore, not Firebase client SDKs.
 */

import { gcpBaseStatus, gcpConfig } from './gcp.mjs'
import { candidateFromPhenotype, seedGuestFromMatch } from './umingle-models.mjs'

const PING_MS = Number(process.env.FIRESTORE_PING_MS || 2500)

function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value))
}

function dataOf(snap) {
  return snap.exists ? snap.data() : null
}

export async function createFirestoreDatastore(catalog) {
  if (process.env.FIRESTORE_FORCE_UNAVAILABLE === '1') {
    throw new Error('firestore_forced_unavailable')
  }
  const { Firestore } = await import('@google-cloud/firestore')
  const db = new Firestore({
    projectId: gcpConfig.projectId,
    databaseId: gcpConfig.firestoreDatabase,
    ignoreUndefinedProperties: true,
  })

  const cols = gcpConfig.collections
  const ping = db.collection(cols.candidates).limit(1).get()
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('firestore_ping_timeout')), PING_MS)
  })
  try {
    await Promise.race([ping, timeout])
  } catch (error) {
    void db.terminate().catch(() => undefined)
    throw error
  }
  await seedIfNeeded(db, catalog)

  return {
    mode: 'firestore',
    async status() {
      return {
        ...gcpBaseStatus(),
        connected: true,
        mode: 'firestore',
        reason: 'Reading and writing Firestore in devo-holding.',
      }
    },
    async getPhenotype(profileId) {
      const snap = await db.collection(cols.phenotypes).doc(profileId).get()
      const row = dataOf(snap)
      if (row?.phenotype) {
        return { phenotype: row.phenotype, hasProfile: Boolean(row.hasProfile) }
      }
      return { phenotype: catalog.userPhenotype, hasProfile: false }
    },
    async savePhenotype(profileId, next) {
      if (!next || typeof next !== 'object') {
        const current = await this.getPhenotype(profileId)
        return current.phenotype
      }
      const prev = (await this.getPhenotype(profileId)).phenotype
      const phenotype = jsonSafe({ ...prev, ...next })
      const now = Date.now()
      await db.collection(cols.phenotypes).doc(profileId).set(
        {
          profileId,
          phenotype,
          hasProfile: true,
          updatedAt: now,
          createdAt: now,
        },
        { merge: true },
      )
      const candidate = candidateFromPhenotype(phenotype, profileId)
      await db.collection(cols.candidates).doc(candidate.id).set(
        {
          ...jsonSafe(candidate),
          updatedAt: now,
        },
        { merge: true },
      )
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
      await db.collection(cols.geneUploads).add({
        profileId,
        fileName: name,
        size: Number(size) || 0,
        mimeType: String(mimeType || ''),
        createdAt: Date.now(),
      })
      return phenotype
    },
    async listCandidates({ excludeProfileId } = {}) {
      const snap = await db.collection(cols.candidates).get()
      return snap.docs
        .map((doc) => doc.data())
        .filter((item) => item.profileId !== excludeProfileId)
    },
    async recordMatchQuery({ profileId, filters, returned }) {
      await db.collection(cols.matchQueries).add({
        profileId: profileId || null,
        filters: jsonSafe(filters || {}),
        returned: Number(returned) || 0,
        createdAt: Date.now(),
      })
    },
    async getGuest(guestId) {
      if (!guestId) return null
      const snap = await db.collection(cols.umingleGuests).doc(guestId).get()
      return dataOf(snap)
    },
    async saveGuest(guest) {
      await db.collection(cols.umingleGuests).doc(guest.id).set(jsonSafe({
        ...guest,
        updatedAt: Date.now(),
      }))
      return guest
    },
    async listGuests() {
      const snap = await db.collection(cols.umingleGuests).get()
      return snap.docs.map((doc) => doc.data())
    },
    async getRoom(roomId) {
      if (!roomId) return null
      const snap = await db.collection(cols.umingleRooms).doc(roomId).get()
      return dataOf(snap)
    },
    async saveRoom(room) {
      await db.collection(cols.umingleRooms).doc(room.id).set(jsonSafe({
        ...room,
        updatedAt: Date.now(),
      }))
      return room
    },
  }
}

async function seedIfNeeded(db, catalog) {
  const metaRef = db.collection(gcpConfig.collections.meta).doc('seed')
  const meta = await metaRef.get()
  if (meta.exists) return

  const batch = db.batch()
  const now = Date.now()
  for (const match of catalog.matches) {
    const candidateRef = db.collection(gcpConfig.collections.candidates).doc(match.phenotype.id)
    batch.set(candidateRef, jsonSafe({
      ...match,
      id: match.phenotype.id,
      seeded: true,
      updatedAt: now,
    }))
    const guest = seedGuestFromMatch(match)
    batch.set(db.collection(gcpConfig.collections.umingleGuests).doc(guest.id), jsonSafe({
      ...guest,
      updatedAt: now,
    }))
  }
  batch.set(metaRef, {
    seededAt: now,
    projectId: gcpConfig.projectId,
    catalogSize: catalog.matches.length,
  })
  await batch.commit()
}
