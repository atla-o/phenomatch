import http from 'node:http'
import { gcpStatus, memoryDatastore, gcpConfig } from './gcp.mjs'
import { queryMatches } from './matching.mjs'
import { userPhenotype, matches, filterOptions, scanSteps } from './catalog.mjs'
import { joinUmingle, listUmingleMatches, openChat, getChat, postMessage, getGuest, connectSimilar } from './umingle.mjs'

const PORT = Number(process.env.MATCH_API_PORT || process.env.PORT || 8787)
const store = memoryDatastore({ userPhenotype, matches })

function send(res, status, body) {
  const payload = body === undefined ? '' : JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
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
        service: 'phenomatch-matching-api',
        gcp: await gcpStatus(),
      })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/gcp') {
      send(res, 200, { config: gcpConfig, status: await gcpStatus() })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/filters') {
      send(res, 200, { filters: filterOptions, defaults: defaultFilters() })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/phenotype/me') {
      send(res, 200, { phenotype: await store.getUserPhenotype(), scanSteps })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/phenotype/gene') {
      const body = await readJson(req)
      const phenotype = await store.linkGene({ fileName: body.fileName })
      send(res, 200, {
        phenotype,
        linked: true,
        note: 'Gene file metadata is stored in the memory stub. Full sequence processing stays off this Linux VM.',
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/matches') {
      const body = await readJson(req)
      const filters = { ...defaultFilters(), ...(body.filters || {}) }
      const user = body.phenotype || (await store.getUserPhenotype())
      const candidates = await store.listCandidates()
      const ranked = queryMatches(user, candidates, filters)
      const gcp = await gcpStatus()
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
      const phenotype = body.phenotype || (await store.getUserPhenotype())
      const guest = joinUmingle({ guestId: body.guestId, phenotype })
      const ranked = listUmingleMatches(guest)
      const gcp = await gcpStatus()
      send(res, 200, {
        guest: {
          id: guest.id,
          displayName: guest.displayName,
          anonymous: true,
          phenotype: guest.phenotype,
        },
        matches: ranked,
        total: ranked.length,
        returned: ranked.length,
        matchType: 'anonymous',
        account: 'none',
        source: gcp.mode,
        clustering: ['visual-traits', 'tribe', 'genealogy'],
      })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/umingle/matches') {
      const guestId = url.searchParams.get('guestId')
      const guest = guestId ? getGuest(guestId) : null
      if (!guest) {
        send(res, 404, { error: 'guest_not_found' })
        return
      }
      const ranked = listUmingleMatches(guest)
      send(res, 200, {
        matches: ranked,
        total: ranked.length,
        returned: ranked.length,
        matchType: 'anonymous',
        account: 'none',
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/umingle/live') {
      const body = await readJson(req)
      const phenotype = body.phenotype || (await store.getUserPhenotype())
      const guest = joinUmingle({ guestId: body.guestId, phenotype })
      const room = connectSimilar(guest, { skipPeerId: body.skipPeerId })
      send(res, 200, {
        guest: {
          id: guest.id,
          displayName: guest.displayName,
          anonymous: true,
          phenotype: guest.phenotype,
        },
        room,
        matchType: 'anonymous',
        account: 'none',
        minCompatibility: 50,
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/umingle/chat') {
      const body = await readJson(req)
      const room = openChat(body.guestId, body.peerGuestId)
      send(res, 200, { room, matchType: 'anonymous', account: 'none' })
      return
    }

    const chatPath = url.pathname.match(/^\/api\/umingle\/chat\/([^/]+)(?:\/(messages))?$/)
    if (chatPath) {
      const roomId = decodeURIComponent(chatPath[1])
      const messagesOnly = chatPath[2] === 'messages'

      if (req.method === 'GET' && !messagesOnly) {
        const guestId = url.searchParams.get('guestId')
        const room = getChat(roomId, guestId)
        if (!room) {
          send(res, 404, { error: 'room_not_found' })
          return
        }
        send(res, 200, { room, matchType: 'anonymous' })
        return
      }

      if (req.method === 'POST' && messagesOnly) {
        const body = await readJson(req)
        const room = postMessage(roomId, body.guestId, body.text)
        send(res, 200, { room, matchType: 'anonymous' })
        return
      }
    }

    send(res, 404, { error: 'not_found' })
  } catch (error) {
    send(res, 400, { error: 'bad_request', message: String(error.message || error) })
  }
})

server.listen(PORT, '0.0.0.0', () => {
  process.stdout.write(`phenomatch matching API on :${PORT}\n`)
})
