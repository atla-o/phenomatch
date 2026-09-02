/**
 * GCP stubs for Phenomatch cloud data.
 * Project: devo-holding (org atla-o.com, folder Devo).
 * App data is GCP, not Firebase. This module never deploys.
 */

export const gcpConfig = {
  projectId: process.env.GCP_PROJECT_ID || 'devo-holding',
  organization: 'atla-o.com',
  folder: 'Devo',
  region: process.env.GCP_REGION || 'us-central1',
  firestoreDatabase: process.env.FIRESTORE_DATABASE || '(default)',
  collections: {
    phenotypes: 'phenomatch_phenotypes',
    candidates: 'phenomatch_candidates',
    matchQueries: 'phenomatch_match_queries',
    umingleGuests: 'phenomatch_umingle_guests',
    geneUploads: 'phenomatch_gene_uploads',
  },
  cloudRunService: 'phenomatch-matching-api',
}

export async function gcpStatus() {
  const hasCredentials = Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT,
  )

  return {
    projectId: gcpConfig.projectId,
    organization: gcpConfig.organization,
    folder: gcpConfig.folder,
    region: gcpConfig.region,
    firestoreDatabase: gcpConfig.firestoreDatabase,
    cloudRunService: gcpConfig.cloudRunService,
    connected: false,
    mode: hasCredentials ? 'credentials-present-unwired' : 'memory-stub',
    reason:
      'Cloud agent uses an in-memory catalog. Wire Firestore in devo-holding before production traffic.',
  }
}

/** In-memory stand-in for Firestore reads. Replace with @google-cloud/firestore later. */
export function memoryDatastore(catalog) {
  let userPhenotype = catalog.userPhenotype
  return {
    async getUserPhenotype() {
      return userPhenotype
    },
    async linkGene({ fileName }) {
      const name = String(fileName || '').trim()
      if (!name) {
        throw new Error('gene_file_required')
      }
      userPhenotype = {
        ...userPhenotype,
        geneLinked: true,
        geneFileName: name,
        genealogyLikelihood: Math.min(99, (userPhenotype.genealogyLikelihood ?? 0) + 8),
        genealogyLineage: userPhenotype.genealogyLineage.includes(name)
          ? userPhenotype.genealogyLineage
          : `${userPhenotype.genealogyLineage} · linked ${name}`,
      }
      return userPhenotype
    },
    async listCandidates() {
      return catalog.matches
    },
  }
}
