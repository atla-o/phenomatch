import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { resolveStaticPath } from './static.mjs'

const port = 18788
const base = `http://127.0.0.1:${port}`
const staticDir = mkdtempSync(path.join(tmpdir(), 'phenomatch-static-'))
mkdirSync(path.join(staticDir, 'assets'))
writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><html><body>PhenoMatch</body></html>')
writeFileSync(path.join(staticDir, 'assets', 'app.js'), 'window.phenomatch = true')

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
    env: { ...process.env, MATCH_API_PORT: String(port), STATIC_DIR: staticDir },
    stdio: 'ignore',
  })
  await waitForHealth()
})

after(() => {
  child?.kill()
})

test('static path resolution blocks traversal', () => {
  assert.equal(resolveStaticPath(staticDir, '/index.html'), path.join(staticDir, 'index.html'))
  assert.equal(resolveStaticPath(staticDir, '/../package.json'), null)
  assert.equal(resolveStaticPath(staticDir, '/%2e%2e/package.json'), null)
})

test('GET / serves the built UI', async () => {
  const res = await fetch(`${base}/`)
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type') || '', /text\/html/)
  assert.match(await res.text(), /PhenoMatch/)
})

test('GET hashed assets and unknown UI paths stay on the SPA', async () => {
  const asset = await fetch(`${base}/assets/app.js`)
  assert.equal(asset.status, 200)
  assert.match(asset.headers.get('content-type') || '', /javascript/)
  assert.equal(await asset.text(), 'window.phenomatch = true')

  const spa = await fetch(`${base}/match`)
  assert.equal(spa.status, 200)
  assert.match(await spa.text(), /PhenoMatch/)
})

test('unknown API paths stay JSON 404', async () => {
  const res = await fetch(`${base}/api/missing`)
  assert.equal(res.status, 404)
  const body = await res.json()
  assert.equal(body.error, 'not_found')
})
