import type { Match, MatchFilters, Phenotype } from '../types'
import { defaultMatchFilters } from '../types'
import { matches as fallbackMatches, userPhenotype as fallbackPhenotype } from '../data/mock'

export type GcpStatus = {
  projectId: string
  mode: string
  connected: boolean
  reason: string
}

export type HealthResponse = {
  ok: boolean
  service: string
  gcp: GcpStatus
}

export type MatchesResponse = {
  matches: Match[]
  total: number
  returned: number
  source: string
}

function clientFilter(matches: Match[], filters: MatchFilters): Match[] {
  return matches.filter((m) => {
    if (filters.virginity !== 'any' && m.virginity !== filters.virginity) return false
    if (m.genealogy < filters.genealogyMin) return false
    if (m.age < filters.ageMin || m.age > filters.ageMax) return false
    return true
  })
}

export async function fetchHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch('/api/health')
    if (!res.ok) return null
    return (await res.json()) as HealthResponse
  } catch {
    return null
  }
}

export async function fetchPhenotype(): Promise<Phenotype> {
  try {
    const res = await fetch('/api/phenotype/me')
    if (!res.ok) return fallbackPhenotype
    const body = (await res.json()) as { phenotype: Phenotype }
    return body.phenotype
  } catch {
    return fallbackPhenotype
  }
}

export async function runSimulatedScan(): Promise<Phenotype> {
  try {
    const res = await fetch('/api/phenotype/scan', { method: 'POST' })
    if (!res.ok) return fallbackPhenotype
    const body = (await res.json()) as { phenotype: Phenotype }
    return body.phenotype
  } catch {
    return fallbackPhenotype
  }
}

export async function fetchMatches(filters: MatchFilters = defaultMatchFilters): Promise<MatchesResponse> {
  try {
    const res = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filters }),
    })
    if (!res.ok) throw new Error('matches failed')
    return (await res.json()) as MatchesResponse
  } catch {
    const filtered = clientFilter(fallbackMatches, filters)
    return {
      matches: filtered,
      total: fallbackMatches.length,
      returned: filtered.length,
      source: 'client-fallback',
    }
  }
}
