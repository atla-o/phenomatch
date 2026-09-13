import type { Match, Phenotype } from './types'

const PROFILE_KEY = 'phenomatch.profile'
const PROFILE_ID_KEY = 'phenomatch.profileId'
const LIKES_KEY = 'phenomatch.likes'
const PASSED_KEY = 'phenomatch.passed'
const ANON_FILTER_KEY = 'phenomatch.anonFilter'

export function getOrCreateProfileId(): string {
  try {
    const existing = localStorage.getItem(PROFILE_ID_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(PROFILE_ID_KEY, id)
    return id
  } catch {
    return 'local-dev'
  }
}

export type StoredProfile = {
  hasProfile: boolean
  phenotype: Phenotype
}

export function loadProfile(): StoredProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredProfile
    if (!parsed?.phenotype?.id) return null
    return parsed
  } catch {
    return null
  }
}

export function saveProfile(profile: StoredProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    /* private mode */
  }
}

export function loadLikes(): Match[] {
  try {
    const raw = localStorage.getItem(LIKES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Match[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveLikes(likes: Match[]) {
  try {
    localStorage.setItem(LIKES_KEY, JSON.stringify(likes))
  } catch {
    /* private mode */
  }
}

export function loadPassedIds(): string[] {
  try {
    const raw = localStorage.getItem(PASSED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function savePassedIds(ids: string[]) {
  try {
    localStorage.setItem(PASSED_KEY, JSON.stringify(ids))
  } catch {
    /* private mode */
  }
}

export type AnonFilterSettings = {
  enabled: boolean
  severity: number
}

export const defaultAnonFilter: AnonFilterSettings = {
  enabled: true,
  severity: 35,
}

export function loadAnonFilter(): AnonFilterSettings {
  try {
    const raw = localStorage.getItem(ANON_FILTER_KEY)
    if (!raw) return { ...defaultAnonFilter }
    const parsed = JSON.parse(raw) as Partial<AnonFilterSettings>
    return {
      enabled: parsed.enabled !== false,
      severity: Number.isFinite(Number(parsed.severity))
        ? Math.max(0, Math.min(100, Number(parsed.severity)))
        : defaultAnonFilter.severity,
    }
  } catch {
    return { ...defaultAnonFilter }
  }
}

export function saveAnonFilter(settings: AnonFilterSettings) {
  try {
    localStorage.setItem(ANON_FILTER_KEY, JSON.stringify(settings))
  } catch {
    /* private mode */
  }
}
