/**
 * GCP config for Phenomatch cloud data.
 * Project: devo-holding (org atla-o.com, folder Devo).
 * App data is GCP Firestore, not Firebase. This module never deploys.
 */

export const gcpConfig = {
  projectId: process.env.GCP_PROJECT_ID || 'devo-holding',
  organization: 'atla-o.com',
  folder: 'Devo',
  region: process.env.GCP_REGION || 'us-west1',
  firestoreDatabase: process.env.FIRESTORE_DATABASE || '(default)',
  collections: {
    meta: 'phenomatch_meta',
    phenotypes: 'phenomatch_phenotypes',
    candidates: 'phenomatch_candidates',
    matchQueries: 'phenomatch_match_queries',
    umingleGuests: 'phenomatch_umingle_guests',
    umingleRooms: 'phenomatch_umingle_rooms',
    geneUploads: 'phenomatch_gene_uploads',
  },
  cloudRunService: process.env.CLOUD_RUN_SERVICE || 'phenomatch-web',
}

export function isCloudRun(env = process.env) {
  return Boolean(env.K_SERVICE)
}

/** Cloud Run and NODE_ENV=production must use Firestore, never memory-stub. */
export function isProductionPath(env = process.env) {
  return isCloudRun(env) || env.NODE_ENV === 'production'
}

/**
 * Store selection:
 * - Cloud Run always Firestore (PHENOMATCH_STORE cannot force memory).
 * - NODE_ENV=production defaults to Firestore.
 * - Local / test defaults to memory unless PHENOMATCH_STORE=firestore.
 */
export function resolveStoreMode(env = process.env) {
  const explicit = String(env.PHENOMATCH_STORE || '').trim().toLowerCase()
  if (isCloudRun(env)) return 'firestore'
  if (explicit === 'memory') return 'memory'
  if (explicit === 'firestore') return 'firestore'
  if (env.NODE_ENV === 'production') return 'firestore'
  return 'memory'
}

export function gcpBaseStatus() {
  return {
    projectId: gcpConfig.projectId,
    organization: gcpConfig.organization,
    folder: gcpConfig.folder,
    region: gcpConfig.region,
    firestoreDatabase: gcpConfig.firestoreDatabase,
    cloudRunService: gcpConfig.cloudRunService,
  }
}

export async function gcpStatus(store) {
  if (store?.status) {
    return store.status()
  }
  return {
    ...gcpBaseStatus(),
    connected: false,
    mode: resolveStoreMode() === 'firestore' ? 'firestore-unavailable' : 'memory-stub',
    reason: 'Datastore is not initialized.',
  }
}
