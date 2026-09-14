import http from 'node:http'
import { gcpConfig, gcpStatus } from './gcp.mjs'
import { createStore } from './store.mjs'
import { queryMatches } from './matching.mjs'
import { userPhenotype, matches, filterOptions, scanSteps } from './catalog.mjs'
import { createUmingle } from './umingle.mjs'
import { hasStaticUi, serveStatic } from './static.mjs'
import { iceServersFromEnv, hasTurnServer } from '../shared/ice-servers.mjs'

const PORT = Number(process.env.MATCH_API_PORT || process.env.PORT || 8080)
const HOST = process.env.HOST || '0.0.0.0'

const store = await createStore({ userPhenotype, matches })
const umingle = createUmingle(store)

function send(res, status, body) {
  const payload = body === undefined ? '' : JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, x-phenomatch-profile',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'cache-control': 'no-store',
  })
  res.end(payload)
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function defaultFilters() {
  return { virginity: 'any', genealogyMin: 0, ageMin: 18, ageMax: 45 }
}

function profileIdOf(req, body = {}) {
  const header = req.headers['x-phenomatch-profile']
  const fromHeader = Array.isArray(header) ? header[0] : header
  return String(fromHeader || body.profileId || 'local-dev').trim() || 'local-dev'
}

function isUnavailable(error) {
  return error?.code === 'FIRESTORE_UNAVAILABLE' || error?.message === 'firestore_unavailable'
}

function sendUnavailable(res) {
  send(res, 503, {
    error: 'firestore_unavailable',
    projectId: gcpConfig.projectId,
    message: 'Firestore in devo-holding is required for this request. Memory-stub is disabled on the production path.',
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`)

  if (req.method === 'OPTIONS') {
    send(res, 204)
    return
  }

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      send(res, 200, {
        ok: true,
        service: 'phenomatch-web',
        ui: hasStaticUi(),
        gcp: await gcpStatus(store),
      })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/gcp') {
      send(res, 200, { config: gcpConfig, status: await gcpStatus(store) })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/ice') {
      const iceServers = iceServersFromEnv()
      send(res, 200, {
        iceServers,
        hasTurn: hasTurnServer(iceServers),
        source: process.env.PHENOMATCH_ICE_SERVERS
          ? 'env'
          : process.env.PHENOMATCH_TURN_URLS
            ? 'turn-env'
            : 'public-defaults',
      })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/filters') {
      send(res, 200, { filters: filterOptions, defaults: defaultFilters() })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/phenotype/me') {
      const profileId = profileIdOf(req)
      const { phenotype, hasProfile } = await store.getPhenotype(profileId)
      send(res, 200, {
        phenotype,
        hasProfile,
        profileId,
        scanSteps,
        source: store.mode,
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/phenotype/scan') {
      const body = await readJson(req)
      const profileId = profileIdOf(req, body)
      const current = body.phenotype || (await store.getPhenotype(profileId)).phenotype
      const phenotype = await store.savePhenotype(profileId, current)
      send(res, 200, {
        phenotype,
        hasProfile: true,
        profileId,
        scanned: true,
        source: store.mode,
        note: 'Optical scan result persisted. Camera capture stays on the Mac client.',
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/phenotype/gene') {
      const body = await readJson(req)
      const profileId = profileIdOf(req, body)
      const phenotype = await store.linkGene(profileId, {
        fileName: body.fileName,
        size: body.size,
        mimeType: body.mimeType,
      })
      send(res, 200, {
        phenotype,
        hasProfile: true,
        profileId,
        linked: true,
        source: store.mode,
        note:
          store.mode === 'firestore'
            ? 'Gene file metadata is stored in Firestore in devo-holding. Sequence processing stays off this Linux VM.'
            : 'Gene file metadata is stored in the local catalog. Production uses Firestore in devo-holding.',
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/matches') {
      const body = await readJson(req)
      const profileId = profileIdOf(req, body)
      const filters = { ...defaultFilters(), ...(body.filters || {}) }
      const saved = await store.getPhenotype(profileId)
      const user = body.phenotype || saved.phenotype
      const candidates = await store.listCandidates({ excludeProfileId: profileId })
      const ranked = queryMatches(user, candidates, filters)
      const gcp = await gcpStatus(store)
      void store.recordMatchQuery({ profileId, filters, returned: ranked.length }).catch(() => undefined)
      send(res, 200, {
        matches: ranked,
        total: candidates.length,
        returned: ranked.length,
        filters,
        matchType: 'data',
        source: gcp.mode,
        clustering: ['visual-traits', 'tribe', 'genealogy'],
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/umingle/join') {
      const body = await readJson(req)
      const profileId = profileIdOf(req, body)
      const phenotype = body.phenotype || (await store.getPhenotype(profileId)).phenotype
      const guest = await umingle.join({ guestId: body.guestId, phenotype })
      const snapshot = await umingle.presence(guest)
      const gcp = await gcpStatus(store)
      send(res, 200, {
        guest: {
          id: guest.id,
          displayName: guest.displayName,
          anonymous: true,
          phenotype: guest.phenotype,
          status: guest.status,
        },
        matches: snapshot.matches,
        total: snapshot.liveCount,
        returned: snapshot.matches.length,
        liveCount: snapshot.liveCount,
        similarCount: snapshot.similarCount,
        matchType: 'anonymous',
        account: 'none',
        source: gcp.mode,
        clustering: ['visual-traits', 'tribe', 'genealogy'],
      })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/umingle/matches') {
      const guestId = url.searchParams.get('guestId')
      const guest = guestId ? await store.getGuest(guestId) : null
      if (!guest) {
        send(res, 404, { error: 'guest_not_found' })
        return
      }
      const ranked = await umingle.listMatches(guest)
      send(res, 200, {
        matches: ranked,
        total: ranked.length,
        returned: ranked.length,
        matchType: 'anonymous',
        account: 'none',
        source: store.mode,
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/umingle/live') {
      const body = await readJson(req)
      const profileId = profileIdOf(req, body)
      const phenotype = body.phenotype || (await store.getPhenotype(profileId)).phenotype
      let guest = await umingle.join({ guestId: body.guestId, phenotype })
      const room = await umingle.connectSimilar(guest, { skipPeerId: body.skipPeerId })
      guest = (await store.getGuest(guest.id)) || guest
      const snapshot = await umingle.presence(guest)
      send(res, 200, {
        guest: {
          id: guest.id,
          displayName: guest.displayName,
          anonymous: true,
          phenotype: guest.phenotype,
          status: guest.status,
        },
        room,
        waiting: !room,
        matches: snapshot.matches,
        liveCount: snapshot.liveCount,
        similarCount: snapshot.similarCount,
        matchType: 'anonymous',
        account: 'none',
        minCompatibility: 50,
        pairing: (room?.compatibility ?? 0) >= 50 ? 'similar' : room ? 'best-available' : 'none',
        source: store.mode,
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/umingle/heartbeat') {
      const body = await readJson(req)
      const beat = await umingle.heartbeat(body.guestId)
      if (!beat) {
        send(res, 404, { error: 'guest_not_found' })
        return
      }
      const snapshot = await umingle.presence(beat.guest)
      send(res, 200, {
        guest: {
          id: beat.guest.id,
          displayName: beat.guest.displayName,
          anonymous: true,
          phenotype: beat.guest.phenotype,
          status: beat.guest.status,
        },
        room: beat.room,
        matches: snapshot.matches,
        liveCount: snapshot.liveCount,
        similarCount: snapshot.similarCount,
        matchType: 'anonymous',
        source: store.mode,
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/umingle/leave') {
      const body = await readJson(req)
      const guest = await umingle.leave(body.guestId, { goOffline: Boolean(body.goOffline) })
      if (!guest) {
        send(res, 404, { error: 'guest_not_found' })
        return
      }
      send(res, 200, {
        guest: { id: guest.id, status: guest.status, anonymous: true },
        matchType: 'anonymous',
        source: store.mode,
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/umingle/signal') {
      const body = await readJson(req)
      const room = await umingle.postSignal(body.roomId, body.guestId, body.type, body.payload)
      send(res, 200, { room, matchType: 'anonymous', source: store.mode })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/umingle/chat') {
      const body = await readJson(req)
      const room = await umingle.openChat(body.guestId, body.peerGuestId, body.compatibility)
      send(res, 200, { room, matchType: 'anonymous', account: 'none', source: store.mode })
      return
    }

    const chatPath = url.pathname.match(
      /^\/api\/umingle\/chat\/([^/]+)(?:\/(messages|signals|restart))?$/,
    )
    if (chatPath) {
      const roomId = decodeURIComponent(chatPath[1])
      const tail = chatPath[2] || ''

      if (req.method === 'GET' && tail === '') {
        const guestId = url.searchParams.get('guestId')
        const room = await umingle.getChat(roomId, guestId)
        if (!room) {
          send(res, 404, { error: 'room_not_found' })
          return
        }
        send(res, 200, { room, matchType: 'anonymous', source: store.mode })
        return
      }

      if (req.method === 'GET' && tail === 'signals') {
        const guestId = url.searchParams.get('guestId')
        const snap = await umingle.getSignals(roomId, guestId)
        if (!snap) {
          send(res, 404, { error: 'room_not_found' })
          return
        }
        send(res, 200, { ...snap, matchType: 'anonymous', source: store.mode })
        return
      }

      if (req.method === 'POST' && tail === 'messages') {
        const body = await readJson(req)
        const room = await umingle.postMessage(roomId, body.guestId, body.text)
        send(res, 200, { room, matchType: 'anonymous', source: store.mode })
        return
      }

      if (req.method === 'POST' && tail === 'restart') {
        const body = await readJson(req)
        const room = await umingle.restartCall(roomId, body.guestId)
        send(res, 200, { room, matchType: 'anonymous', source: store.mode })
        return
      }
    }

    if (!url.pathname.startsWith('/api') && serveStatic(req, res, url.pathname)) {
      return
    }

    send(res, 404, { error: 'not_found' })
  } catch (error) {
    if (isUnavailable(error)) {
      sendUnavailable(res)
      return
    }
    send(res, 400, { error: 'bad_request', message: String(error.message || error) })
  }
})

server.listen(PORT, HOST, () => {
  process.stdout.write(`phenomatch-web on ${HOST}:${PORT} store=${store.mode}\n`)
})
