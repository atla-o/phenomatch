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

export type UmingleGuest = {
  id: string
  displayName: string
  anonymous: true
  phenotype: Phenotype
}

export type UmingleJoinResponse = {
  guest: UmingleGuest
  matches: Match[]
  total: number
  returned: number
  matchType: 'anonymous'
  account: 'none'
  source: string
}

export type ChatMessage = {
  id: string
  fromGuestId: string
  mine: boolean
  text: string
  createdAt: number
}

export type UmingleRoom = {
  id: string
  matchType: 'anonymous'
  peer: {
    guestId: string
    displayName: string
    phenotype: Phenotype
    anonymous: boolean
  } | null
  messages: ChatMessage[]
}

const UMINGLE_GUEST_KEY = 'phenomatch.umingleGuestId'

export function storedUmingleGuestId(): string | null {
  try {
    return localStorage.getItem(UMINGLE_GUEST_KEY)
  } catch {
    return null
  }
}

function rememberGuestId(id: string) {
  try {
    localStorage.setItem(UMINGLE_GUEST_KEY, id)
  } catch {
    /* private mode */
  }
}

function clientFilter(matches: Match[], filters: MatchFilters): Match[] {
  return matches.filter((m) => {
    if (filters.virginity !== 'any' && m.virginity !== filters.virginity) return false
    if (m.genealogy < filters.genealogyMin) return false
    if (m.age != null && (m.age < filters.ageMin || m.age > filters.ageMax)) return false
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

export async function uploadGene(file: File): Promise<Phenotype> {
  const res = await fetch('/api/phenotype/gene', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, size: file.size, mimeType: file.type }),
  })
  if (!res.ok) throw new Error('gene upload failed')
  const body = (await res.json()) as { phenotype: Phenotype }
  return body.phenotype
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

export async function joinUmingle(phenotype?: Phenotype): Promise<UmingleJoinResponse> {
  const guestId = storedUmingleGuestId()
  const res = await fetch('/api/umingle/join', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ guestId, phenotype }),
  })
  if (!res.ok) throw new Error('umingle join failed')
  const body = (await res.json()) as UmingleJoinResponse
  rememberGuestId(body.guest.id)
  return body
}

export async function openUmingleChat(guestId: string, peerGuestId: string): Promise<UmingleRoom> {
  const res = await fetch('/api/umingle/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ guestId, peerGuestId }),
  })
  if (!res.ok) throw new Error('umingle chat failed')
  const body = (await res.json()) as { room: UmingleRoom }
  return body.room
}

export async function fetchUmingleChat(roomId: string, guestId: string): Promise<UmingleRoom> {
  const res = await fetch(`/api/umingle/chat/${encodeURIComponent(roomId)}?guestId=${encodeURIComponent(guestId)}`)
  if (!res.ok) throw new Error('umingle chat load failed')
  const body = (await res.json()) as { room: UmingleRoom }
  return body.room
}

export async function sendUmingleMessage(roomId: string, guestId: string, text: string): Promise<UmingleRoom> {
  const res = await fetch(`/api/umingle/chat/${encodeURIComponent(roomId)}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ guestId, text }),
  })
  if (!res.ok) throw new Error('umingle send failed')
  const body = (await res.json()) as { room: UmingleRoom }
  return body.room
}
