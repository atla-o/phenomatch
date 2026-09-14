/** Shared Anon live helpers (presence, signaling, WebRTC roles). */

export const PRESENCE_TTL_MS = 20_000
export const ANON_MIN_COMPAT = 50
export const DEFAULT_FILTER_SEVERITY = 35
export const SIGNAL_TYPES = ['offer', 'answer', 'ice']
export const SIGNAL_POLL_MS = 400
export const ICE_RENEGOTIATE_MS = 10_000
export const ICE_FAIL_MS = 18_000
export const CONNECT_FAIL_COPY = "Couldn't connect video — retry"
export const PAIRABLE_STATUSES = ['lobby', 'seeking']
export const PAIR_ATTEMPTS = 3

export function isLiveGuest(guest, now = Date.now(), ttlMs = PRESENCE_TTL_MS) {
  if (!guest || guest.seeded) return false
  if (guest.status === 'offline') return false
  const seen = Number(guest.lastSeen || 0)
  if (!Number.isFinite(seen) || seen <= 0) return false
  return now - seen <= ttlMs
}

export function isPairableStatus(status) {
  return status === 'lobby' || status === 'seeking'
}

export function isPairableGuest(guest, now = Date.now(), ttlMs = PRESENCE_TTL_MS) {
  return isLiveGuest(guest, now, ttlMs) && isPairableStatus(guest.status)
}

/** React unmount / tab remount must not force offline. Page close does. */
export function shouldGoOfflineOn(reason) {
  return reason === 'pagehide' || reason === 'beforeunload'
}

export function selectPairingPicks(ranked, options = {}) {
  const list = Array.isArray(ranked) ? ranked : []
  const minCompat = Number.isFinite(Number(options.minCompat))
    ? Number(options.minCompat)
    : ANON_MIN_COMPAT
  const otherLiveCount = Number(options.otherLiveCount) || 0
  const seekingPeerCount = Number(options.seekingPeerCount) || 0
  const selfSeeking = Boolean(options.selfSeeking)
  const similar = list.filter((item) => (item?.compatibility ?? 0) >= minCompat)
  if (similar.length) {
    return { picks: similar, mode: 'similar' }
  }
  const onlyOtherLive = otherLiveCount === 1
  const bothSeeking = selfSeeking && seekingPeerCount > 0
  if ((onlyOtherLive || bothSeeking) && list.length) {
    return { picks: list, mode: 'best-available' }
  }
  return { picks: [], mode: 'none' }
}

export function isOfferer(localId, remoteId) {
  return String(localId) < String(remoteId)
}

export function pruneSignals(signals, max = 48) {
  if (!Array.isArray(signals)) return []
  const list = signals.filter((item) => item)
  const cap = Math.max(1, max)
  if (list.length <= cap) return list

  const latestOffer = [...list].reverse().find((item) => item.type === 'offer')
  const latestAnswer = [...list].reverse().find((item) => item.type === 'answer')
  const reserved = new Set([latestOffer, latestAnswer].filter(Boolean))
  const extras = list.filter((item) => !reserved.has(item))
  const keptExtras = extras.slice(-Math.max(0, cap - reserved.size))
  const keep = new Set([...reserved, ...keptExtras])
  return list.filter((item) => keep.has(item))
}

export function signalsForPeer(signals, guestId) {
  return pruneSignals(signals).filter((item) => item && item.fromGuestId && item.fromGuestId !== guestId)
}

export function isValidSignalType(type) {
  return SIGNAL_TYPES.includes(type)
}
