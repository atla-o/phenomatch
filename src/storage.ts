import type { Match, Phenotype } from './types'

const PROFILE_KEY = 'phenomatch.profile'
const LIKES_KEY = 'phenomatch.likes'
const PASSED_KEY = 'phenomatch.passed'

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
