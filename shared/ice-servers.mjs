/** Public ICE defaults for Anon WebRTC. Override with env — no Devo secrets required. */

export const DEFAULT_STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

/** Open Relay / Metered public TURN (ports 80/443) plus extra STUN. */
export const DEFAULT_ICE_SERVERS = [
  ...DEFAULT_STUN_SERVERS,
  { urls: 'stun:openrelay.metered.ca:80' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turns:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
]

export function sanitizeIceServers(list) {
  if (!Array.isArray(list)) return null
  const out = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const urls = item.urls
    if (!urls || (Array.isArray(urls) && urls.length === 0)) continue
    const next = { urls }
    if (item.username) next.username = String(item.username)
    if (item.credential) next.credential = String(item.credential)
    out.push(next)
  }
  return out.length ? out : null
}

export function parseIceServersJson(raw) {
  if (!raw) return null
  if (Array.isArray(raw)) return sanitizeIceServers(raw)
  if (typeof raw !== 'string') return null
  try {
    return sanitizeIceServers(JSON.parse(raw))
  } catch {
    return null
  }
}

export function iceServersFromEnv(env = process.env) {
  const fromJson = parseIceServersJson(env.PHENOMATCH_ICE_SERVERS)
  if (fromJson) return fromJson

  const turnUrls = String(env.PHENOMATCH_TURN_URLS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const username = String(env.PHENOMATCH_TURN_USERNAME || '').trim()
  const credential = String(env.PHENOMATCH_TURN_CREDENTIAL || '').trim()
  if (turnUrls.length && username && credential) {
    return [
      ...DEFAULT_STUN_SERVERS,
      ...turnUrls.map((urls) => ({ urls, username, credential })),
    ]
  }
  return DEFAULT_ICE_SERVERS
}

export function hasTurnServer(servers) {
  return (servers || []).some((item) => {
    const urls = Array.isArray(item?.urls) ? item.urls : [item?.urls]
    return urls.some((url) => /^turns?:/i.test(String(url || '')))
  })
}
