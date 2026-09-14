import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { after, before, test } from 'node:test'

const port = 18787
const base = `http://127.0.0.1:${port}`
let child

async function waitForHealth() {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) return
    } catch {
      /* still booting */
    }
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error('API did not start')
}

before(async () => {
  child = spawn(process.execPath, ['server/index.mjs'], {
    env: { ...process.env, MATCH_API_PORT: String(port) },
    stdio: 'ignore',
  })
  await waitForHealth()
})

after(() => {
  child?.kill()
})

test('health reports GCP memory stub', async () => {
  const res = await fetch(`${base}/api/health`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.ok, true)
  assert.equal(body.gcp.projectId, 'devo-holding')
  assert.equal(body.gcp.mode, 'memory-stub')
})

test('matches endpoint filters virginity and ranks clusters', async () => {
  const res = await fetch(`${base}/api/matches`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      filters: { virginity: 'virgin', genealogyMin: 80, ageMin: 18, ageMax: 30 },
    }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.returned, 1)
  assert.equal(body.matches[0].phenotype.id, 'north-sea-12')
  assert.equal(body.clustering.includes('genealogy'), true)
  assert.equal(body.matchType, 'data')
})

test('phenotype scan returns a cluster profile from the memory stub', async () => {
  const res = await fetch(`${base}/api/phenotype/scan`, { method: 'POST' })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.scanned, true)
  assert.equal(body.source, 'memory-stub')
  assert.ok(body.phenotype?.id)
  assert.ok(Array.isArray(body.phenotype.traits))
})

test('scan persists a profile that later reads return', async () => {
  const headers = {
    'content-type': 'application/json',
    'x-phenomatch-profile': 'profile-persist-1',
  }
  const scan = await fetch(`${base}/api/phenotype/scan`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  })
  assert.equal(scan.status, 200)
  const scanned = await scan.json()
  assert.equal(scanned.hasProfile, true)

  const me = await fetch(`${base}/api/phenotype/me`, { headers })
  const body = await me.json()
  assert.equal(body.hasProfile, true)
  assert.equal(body.phenotype.id, scanned.phenotype.id)
  assert.equal(body.source, 'memory-stub')
})

test('gene upload links genealogy on the phenotype', async () => {
  const res = await fetch(`${base}/api/phenotype/gene`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fileName: 'family.vcf' }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.linked, true)
  assert.equal(body.phenotype.geneLinked, true)
  assert.equal(body.phenotype.geneFileName, 'family.vcf')
  assert.match(body.phenotype.genealogyLineage, /family\.vcf/)
})

test('scanned profile becomes a match candidate for other profiles', async () => {
  const scan = await fetch(`${base}/api/phenotype/scan`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-phenomatch-profile': 'profile-candidate-a',
    },
    body: JSON.stringify({}),
  })
  const scanned = await scan.json()

  const res = await fetch(`${base}/api/matches`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-phenomatch-profile': 'profile-candidate-b',
    },
    body: JSON.stringify({ filters: { virginity: 'any', genealogyMin: 0, ageMin: 18, ageMax: 99 } }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(
    body.matches.some((m) => m.age == null && m.phenotype.id === scanned.phenotype.id),
    'persisted scan should appear in another profile\'s match set',
  )
})

test('anon live waits alone then pairs two similar guests', async () => {
  const first = await fetch(`${base}/api/umingle/live`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })
  assert.equal(first.status, 200)
  const alone = await first.json()
  assert.equal(alone.matchType, 'anonymous')
  assert.equal(alone.room, null)
  assert.equal(alone.waiting, true)
  assert.equal(alone.liveCount, 1)

  const second = await fetch(`${base}/api/umingle/live`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })
  const paired = await second.json()
  assert.ok(paired.room)
  assert.equal(paired.waiting, false)
  assert.ok((paired.room.compatibility ?? 0) >= 50)
  assert.equal(paired.room.peer.guestId, alone.guest.id)

  const again = await fetch(`${base}/api/umingle/live`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ guestId: alone.guest.id }),
  })
  const joined = await again.json()
  assert.equal(joined.room.id, paired.room.id)

  const ice = await fetch(`${base}/api/ice`)
  assert.equal(ice.status, 200)
  const iceBody = await ice.json()
  assert.equal(iceBody.hasTurn, true)
  assert.ok(iceBody.iceServers.some((item) => String(item.urls).startsWith('turn:')))

  const [offerRes, answerRes, iceA, iceB] = await Promise.all([
    fetch(`${base}/api/umingle/signal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        roomId: paired.room.id,
        guestId: paired.guest.id,
        type: 'offer',
        payload: { type: 'offer', sdp: 'v=0' },
      }),
    }),
    fetch(`${base}/api/umingle/signal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        roomId: paired.room.id,
        guestId: alone.guest.id,
        type: 'answer',
        payload: { type: 'answer', sdp: 'v=1' },
      }),
    }),
    fetch(`${base}/api/umingle/signal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        roomId: paired.room.id,
        guestId: paired.guest.id,
        type: 'ice',
        payload: { candidate: 'a' },
      }),
    }),
    fetch(`${base}/api/umingle/signal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        roomId: paired.room.id,
        guestId: alone.guest.id,
        type: 'ice',
        payload: { candidate: 'b' },
      }),
    }),
  ])
  assert.equal(offerRes.status, 200)
  assert.equal(answerRes.status, 200)
  assert.equal(iceA.status, 200)
  assert.equal(iceB.status, 200)

  const light = await fetch(
    `${base}/api/umingle/chat/${encodeURIComponent(paired.room.id)}/signals?guestId=${encodeURIComponent(alone.guest.id)}`,
  )
  assert.equal(light.status, 200)
  const signaled = await light.json()
  assert.equal(signaled.signals.length, 4)
  assert.ok(signaled.signals.some((item) => item.type === 'offer'))
  assert.ok(signaled.signals.some((item) => item.type === 'answer'))

  const restart = await fetch(
    `${base}/api/umingle/chat/${encodeURIComponent(paired.room.id)}/restart`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ guestId: paired.guest.id }),
    },
  )
  assert.equal(restart.status, 200)
  const restarted = await restart.json()
  assert.equal(restarted.room.signals.length, 0)
  assert.notEqual(restarted.room.callId, paired.room.callId)

  const send = await fetch(`${base}/api/umingle/chat/${encodeURIComponent(paired.room.id)}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ guestId: paired.guest.id, text: 'Hey from a similar phenotype.' }),
  })
  assert.equal(send.status, 200)
  const sent = await send.json()
  assert.ok(sent.room.messages.some((m) => m.text === 'Hey from a similar phenotype.'))
  assert.equal(sent.room.messages.filter((m) => !m.mine).length, 0)

  const beat = await fetch(`${base}/api/umingle/heartbeat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ guestId: alone.guest.id }),
  })
  assert.equal(beat.status, 200)
  const living = await beat.json()
  assert.equal(living.room.id, paired.room.id)
})
