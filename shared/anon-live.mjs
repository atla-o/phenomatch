/** Shared Anon live helpers (presence, signaling, WebRTC roles). */

export const PRESENCE_TTL_MS = 20_000
export const ANON_MIN_COMPAT = 50
export const DEFAULT_FILTER_SEVERITY = 35
export const SIGNAL_TYPES = ['offer', 'answer', 'ice']

export function isLiveGuest(guest, now = Date.now(), ttlMs = PRESENCE_TTL_MS) {
  if (!guest || guest.seeded) return false
  if (guest.status === 'offline') return false
  const seen = Number(guest.lastSeen || 0)
  if (!Number.isFinite(seen) || seen <= 0) return false
  return now - seen <= ttlMs
}

export function isOfferer(localId, remoteId) {
  return String(localId) < String(remoteId)
}

export function pruneSignals(signals, max = 48) {
  if (!Array.isArray(signals)) return []
  return signals.slice(-Math.max(1, max))
}

export function signalsForPeer(signals, guestId) {
  return pruneSignals(signals).filter((item) => item && item.fromGuestId && item.fromGuestId !== guestId)
}

export function isValidSignalType(type) {
  return SIGNAL_TYPES.includes(type)
}
