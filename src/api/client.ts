import type { Match, MatchFilters, Phenotype } from '../types'
import { defaultMatchFilters } from '../types'
import { userPhenotype as fallbackPhenotype } from '../data/mock'
import { getOrCreateProfileId, loadProfile } from '../storage'
import { DEFAULT_ICE_SERVERS } from '../../shared/ice-servers.mjs'

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
  status?: 'lobby' | 'seeking' | 'connected' | 'offline'
}

export type SignalType = 'offer' | 'answer' | 'ice'

export type UmingleSignal = {
  id: string
  fromGuestId: string
  type: SignalType
  payload: Record<string, unknown>
  createdAt: number
}

export type UmingleJoinResponse = {
  guest: UmingleGuest
  matches: Match[]
  total: number
  returned: number
  liveCount: number
  similarCount: number
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
  callId?: string | null
  endedAt?: number | null
  leftBy?: string | null
  peerLeft?: boolean
  compatibility?: number | null
  peer: {
    guestId: string
    displayName: string
    phenotype: Phenotype
    anonymous: boolean
    compatibility?: number | null
    status?: string | null
  } | null
  signals: UmingleSignal[]
  messages: ChatMessage[]
}

export type AnonLiveResponse = {
  guest: UmingleGuest
  room: UmingleRoom | null
  waiting: boolean
  matches?: Match[]
  liveCount: number
  similarCount: number
  matchType: 'anonymous'
  account: 'none'
  minCompatibility: number
  pairing?: 'similar' | 'best-available' | 'none'
}

export type AnonHeartbeatResponse = {
  guest: UmingleGuest
  room: UmingleRoom | null
  matches: Match[]
  liveCount: number
  similarCount: number
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

export async function submitPhenotypeScan(payload: {
  traits: Record<string, number>
  typeId?: string
  metrics?: {
    extra?: Record<string, number>
    landmarkCount?: number
    source?: string
  }
}): Promise<Phenotype> {
  const res = await fetch('/api/phenotype/scan', {
    method: 'POST',
    headers: apiHeaders(true),
    body: JSON.stringify(payload),
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

export async function openUmingleChat(
  guestId: string,
  peerGuestId: string,
  compatibility?: number | null,
): Promise<UmingleRoom> {
  const res = await fetch('/api/umingle/chat', {
    method: 'POST',
    headers: apiHeaders(true),
    body: JSON.stringify({ guestId, peerGuestId, compatibility }),
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

export async function heartbeatAnon(guestId: string): Promise<AnonHeartbeatResponse> {
  const res = await fetch('/api/umingle/heartbeat', {
    method: 'POST',
    headers: apiHeaders(true),
    body: JSON.stringify({ guestId }),
  })
  if (!res.ok) throw new Error(await readError(res, 'anon heartbeat failed'))
  return (await res.json()) as AnonHeartbeatResponse
}

export async function leaveAnon(
  guestId: string,
  goOffline = false,
  { keepalive = false }: { keepalive?: boolean } = {},
): Promise<void> {
  const res = await fetch('/api/umingle/leave', {
    method: 'POST',
    headers: apiHeaders(true),
    body: JSON.stringify({ guestId, goOffline }),
    keepalive,
  })
  if (!res.ok) throw new Error(await readError(res, 'anon leave failed'))
}

export async function postAnonSignal(
  roomId: string,
  guestId: string,
  type: SignalType,
  payload: Record<string, unknown>,
): Promise<UmingleRoom> {
  const res = await fetch('/api/umingle/signal', {
    method: 'POST',
    headers: apiHeaders(true),
    body: JSON.stringify({ roomId, guestId, type, payload }),
  })
  if (!res.ok) throw new Error(await readError(res, 'anon signal failed'))
  const body = (await res.json()) as { room: UmingleRoom }
  return body.room
}

export type AnonSignalSnapshot = {
  id: string
  callId: string | null
  endedAt: number | null
  peerLeft: boolean
  signals: UmingleSignal[]
}

export async function fetchAnonSignals(roomId: string, guestId: string): Promise<AnonSignalSnapshot> {
  const res = await fetch(
    `/api/umingle/chat/${encodeURIComponent(roomId)}/signals?guestId=${encodeURIComponent(guestId)}`,
    { headers: apiHeaders() },
  )
  if (!res.ok) throw new Error(await readError(res, 'anon signals failed'))
  return (await res.json()) as AnonSignalSnapshot
}

export async function restartAnonCall(roomId: string, guestId: string): Promise<UmingleRoom> {
  const res = await fetch(`/api/umingle/chat/${encodeURIComponent(roomId)}/restart`, {
    method: 'POST',
    headers: apiHeaders(true),
    body: JSON.stringify({ guestId }),
  })
  if (!res.ok) throw new Error(await readError(res, 'anon restart failed'))
  const body = (await res.json()) as { room: UmingleRoom }
  return body.room
}

export type IceServer = RTCIceServer

let iceServersCache: RTCIceServer[] = DEFAULT_ICE_SERVERS

export function cachedIceServers(): RTCIceServer[] {
  return iceServersCache
}

export async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch('/api/ice')
    if (res.ok) {
      const body = (await res.json()) as { iceServers?: RTCIceServer[] }
      if (Array.isArray(body.iceServers) && body.iceServers.length) {
        iceServersCache = body.iceServers
      }
    }
  } catch {
    /* keep public defaults */
  }
  return iceServersCache
}
