import type { Match, MatchFilters, Phenotype } from '../types'
import { defaultMatchFilters } from '../types'
import { userPhenotype as fallbackPhenotype } from '../data/mock'
import { getOrCreateProfileId, loadProfile } from '../storage'

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

export type PhenotypeResponse = {
  phenotype: Phenotype
  hasProfile: boolean
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
  compatibility?: number | null
  peer: {
    guestId: string
    displayName: string
    phenotype: Phenotype
    anonymous: boolean
    compatibility?: number | null
  } | null
  messages: ChatMessage[]
}

export type AnonLiveResponse = {
  guest: UmingleGuest
  room: UmingleRoom | null
  matchType: 'anonymous'
  account: 'none'
  minCompatibility: number
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

function apiHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = {
    'x-phenomatch-profile': getOrCreateProfileId(),
  }
  if (json) headers['content-type'] = 'application/json'
  return headers
}

async function readError(res: Response, fallback: string) {
  try {
    const body = (await res.json()) as { error?: string; message?: string }
    return body.message || body.error || fallback
  } catch {
    return fallback
  }
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

export async function fetchPhenotype(): Promise<PhenotypeResponse> {
  try {
    const res = await fetch('/api/phenotype/me', { headers: apiHeaders() })
    if (!res.ok) throw new Error(await readError(res, 'phenotype failed'))
    return (await res.json()) as PhenotypeResponse
  } catch {
    const stored = loadProfile()
    return {
      phenotype: stored?.phenotype ?? fallbackPhenotype,
      hasProfile: Boolean(stored?.hasProfile),
      source: 'client-fallback',
    }
  }
}

export async function uploadGene(file: File): Promise<Phenotype> {
  const res = await fetch('/api/phenotype/gene', {
    method: 'POST',
    headers: apiHeaders(true),
    body: JSON.stringify({ fileName: file.name, size: file.size, mimeType: file.type }),
  })
  if (!res.ok) throw new Error(await readError(res, 'gene upload failed'))
  const body = (await res.json()) as { phenotype: Phenotype }
  return body.phenotype
}

export async function runSimulatedScan(): Promise<Phenotype> {
  const res = await fetch('/api/phenotype/scan', {
    method: 'POST',
    headers: apiHeaders(true),
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(await readError(res, 'scan failed'))
  const body = (await res.json()) as { phenotype: Phenotype }
  return body.phenotype
}

export async function fetchMatches(
  filters: MatchFilters = defaultMatchFilters,
  phenotype?: Phenotype,
): Promise<MatchesResponse> {
  const res = await fetch('/api/matches', {
    method: 'POST',
    headers: apiHeaders(true),
    body: JSON.stringify({ filters, phenotype }),
  })
  if (!res.ok) throw new Error(await readError(res, 'matches failed'))
  return (await res.json()) as MatchesResponse
}

export async function joinUmingleLobby(phenotype: Phenotype): Promise<UmingleJoinResponse> {
  const guestId = storedUmingleGuestId()
  const res = await fetch('/api/umingle/join', {
    method: 'POST',
    headers: apiHeaders(true),
    body: JSON.stringify({ guestId, phenotype }),
  })
  if (!res.ok) throw new Error(await readError(res, 'umingle join failed'))
  const body = (await res.json()) as UmingleJoinResponse
  rememberGuestId(body.guest.id)
  return body
}

export async function joinAnonLive(phenotype: Phenotype, skipPeerId?: string): Promise<AnonLiveResponse> {
  const guestId = storedUmingleGuestId()
  const res = await fetch('/api/umingle/live', {
    method: 'POST',
    headers: apiHeaders(true),
    body: JSON.stringify({ guestId, phenotype, skipPeerId }),
  })
  if (!res.ok) throw new Error(await readError(res, 'anon live failed'))
  const body = (await res.json()) as AnonLiveResponse
  rememberGuestId(body.guest.id)
  return body
}

export async function openUmingleChat(guestId: string, peerGuestId: string): Promise<UmingleRoom> {
  const res = await fetch('/api/umingle/chat', {
    method: 'POST',
    headers: apiHeaders(true),
    body: JSON.stringify({ guestId, peerGuestId }),
  })
  if (!res.ok) throw new Error(await readError(res, 'umingle chat failed'))
  const body = (await res.json()) as { room: UmingleRoom }
  return body.room
}

export async function fetchUmingleChat(roomId: string, guestId: string): Promise<UmingleRoom> {
  const res = await fetch(
    `/api/umingle/chat/${encodeURIComponent(roomId)}?guestId=${encodeURIComponent(guestId)}`,
    { headers: apiHeaders() },
  )
  if (!res.ok) throw new Error(await readError(res, 'umingle chat load failed'))
  const body = (await res.json()) as { room: UmingleRoom }
  return body.room
}

export async function sendUmingleMessage(roomId: string, guestId: string, text: string): Promise<UmingleRoom> {
  const res = await fetch(`/api/umingle/chat/${encodeURIComponent(roomId)}/messages`, {
    method: 'POST',
    headers: apiHeaders(true),
    body: JSON.stringify({ guestId, text }),
  })
  if (!res.ok) throw new Error(await readError(res, 'umingle send failed'))
  const body = (await res.json()) as { room: UmingleRoom }
  return body.room
}
