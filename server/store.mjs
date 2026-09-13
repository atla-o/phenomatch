import { resolveStoreMode } from './gcp.mjs'
import { memoryDatastore, unavailableDatastore } from './memory-store.mjs'

export async function createStore(catalog) {
  const mode = resolveStoreMode()
  if (mode === 'memory') {
    return memoryDatastore(catalog)
  }

  try {
    const { createFirestoreDatastore } = await import('./firestore.mjs')
    return await createFirestoreDatastore(catalog)
  } catch (error) {
    if (mode !== 'firestore') {
      return memoryDatastore(catalog)
    }
    return unavailableDatastore(error)
  }
}
