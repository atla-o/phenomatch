import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { test } from 'node:test'
import { resolveStoreMode } from './gcp.mjs'
import { createStore } from './store.mjs'
import { memoryDatastore } from './memory-store.mjs'
import { userPhenotype, matches } from './catalog.mjs'

test('resolveStoreMode uses memory locally and firestore in production', () => {
  assert.equal(resolveStoreMode({ NODE_ENV: 'test' }), 'memory')
  assert.equal(resolveStoreMode({ NODE_ENV: 'production' }), 'firestore')
  assert.equal(resolveStoreMode({ NODE_ENV: 'production', PHENOMATCH_STORE: 'memory' }), 'memory')
  assert.equal(
    resolveStoreMode({ NODE_ENV: 'production', PHENOMATCH_STORE: 'memory', K_SERVICE: 'phenomatch-web' }),
    'firestore',
  )
})

test('memory store appends concurrent room updates without dropping rows', async () => {
  const store = memoryDatastore({ userPhenotype, matches })
  await store.saveRoom({ id: 'room-race', signals: [], participantIds: ['a', 'b'] })
  await Promise.all(
    Array.from({ length: 24 }, (_, i) =>
      store.updateRoom('room-race', (room) => ({
        ...room,
        signals: [...(room.signals || []), { id: `sig-${i}` }],
      })),
    ),
  )
  const room = await store.getRoom('room-race')
  assert.equal(room.signals.length, 24)
  assert.equal(new Set(room.signals.map((item) => item.id)).size, 24)
})

test('memory store persists a scan for later reads', async () => {
  const store = await createStore({ userPhenotype, matches })
  assert.equal(store.mode, 'memory-stub')
  const before = await store.getPhenotype('user-1')
  assert.equal(before.hasProfile, false)
  await store.savePhenotype('user-1', userPhenotype)
  const after = await store.getPhenotype('user-1')
  assert.equal(after.hasProfile, true)
  assert.equal(after.phenotype.id, userPhenotype.id)
  const others = await store.listCandidates({ excludeProfileId: 'user-2' })
  assert.ok(others.some((item) => item.profileId === 'user-1'))
})

test('production path does not fall back to memory-stub', async () => {
  const port = 18789
  const child = spawn(process.execPath, ['server/index.mjs'], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      MATCH_API_PORT: String(port),
      PHENOMATCH_STORE: 'firestore',
      FIRESTORE_FORCE_UNAVAILABLE: '1',
    },
    stdio: 'ignore',
  })

  try {
    const deadline = Date.now() + 12000
    let body
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/health`)
        if (res.ok) {
          body = await res.json()
          break
        }
      } catch {
        /* still booting */
      }
      await new Promise((r) => setTimeout(r, 80))
    }

    assert.ok(body, 'production server should boot')
    assert.equal(body.gcp.projectId, 'devo-holding')
    assert.notEqual(body.gcp.mode, 'memory-stub')
    assert.equal(body.gcp.mode, 'firestore-unavailable')

    const matchesRes = await fetch(`http://127.0.0.1:${port}/api/matches`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    assert.equal(matchesRes.status, 503)
    const failed = await matchesRes.json()
    assert.equal(failed.error, 'firestore_unavailable')
    assert.equal(failed.projectId, 'devo-holding')
  } finally {
    child.kill()
  }
})
