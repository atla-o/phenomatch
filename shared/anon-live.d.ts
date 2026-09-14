export const PRESENCE_TTL_MS: number
export const ANON_MIN_COMPAT: number
export const DEFAULT_FILTER_SEVERITY: number
export const SIGNAL_TYPES: string[]

export function isLiveGuest(guest: unknown, now?: number, ttlMs?: number): boolean
export function isOfferer(localId: string, remoteId: string): boolean
export function pruneSignals<T>(signals: T[] | null | undefined, max?: number): T[]
export function signalsForPeer<T extends { fromGuestId?: string }>(
  signals: T[] | null | undefined,
  guestId: string,
): T[]
export function isValidSignalType(type: string): boolean
