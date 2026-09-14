export const PRESENCE_TTL_MS: number
export const ANON_MIN_COMPAT: number
export const DEFAULT_FILTER_SEVERITY: number
export const SIGNAL_TYPES: string[]
export const SIGNAL_POLL_MS: number
export const ICE_RENEGOTIATE_MS: number
export const ICE_FAIL_MS: number
export const CONNECT_FAIL_COPY: string
export const PAIRABLE_STATUSES: string[]
export const PAIR_ATTEMPTS: number

export function isLiveGuest(guest: unknown, now?: number, ttlMs?: number): boolean
export function isPairableStatus(status: unknown): boolean
export function isPairableGuest(guest: unknown, now?: number, ttlMs?: number): boolean
export function shouldGoOfflineOn(reason: string): boolean
export function selectPairingPicks<T extends { compatibility?: number | null }>(
  ranked: T[] | null | undefined,
  options?: {
    minCompat?: number
    otherLiveCount?: number
    seekingPeerCount?: number
    selfSeeking?: boolean
  },
): { picks: T[]; mode: 'similar' | 'best-available' | 'none' }
export function isOfferer(localId: string, remoteId: string): boolean
export function pruneSignals<T>(signals: T[] | null | undefined, max?: number): T[]
export function signalsForPeer<T extends { fromGuestId?: string }>(
  signals: T[] | null | undefined,
  guestId: string,
): T[]
export function isValidSignalType(type: string): boolean
