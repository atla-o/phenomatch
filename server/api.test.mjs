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

test('umingle join needs no account and opens phenotype chat', async () => {
  const join = await fetch(`${base}/api/umingle/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })
  assert.equal(join.status, 200)
  const joined = await join.json()
  assert.equal(joined.account, 'none')
  assert.equal(joined.matchType, 'anonymous')
  assert.equal(joined.guest.anonymous, true)
  assert.ok(joined.guest.id)
  assert.ok(joined.returned >= 4)

  const peer = joined.matches[0]
  const chat = await fetch(`${base}/api/umingle/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ guestId: joined.guest.id, peerGuestId: peer.guestId }),
  })
  assert.equal(chat.status, 200)
  const opened = await chat.json()
  assert.equal(opened.room.peer.guestId, peer.guestId)

  const send = await fetch(`${base}/api/umingle/chat/${encodeURIComponent(opened.room.id)}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ guestId: joined.guest.id, text: 'No account. Just phenotype.' }),
  })
  assert.equal(send.status, 200)
  const sent = await send.json()
  assert.equal(sent.room.messages[0].text, 'No account. Just phenotype.')
  assert.ok(sent.room.messages.length >= 2)
})
