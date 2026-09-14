import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('phone shell scales a 390×844 frame with no document or main scroll', () => {
  const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
  const base = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

  assert.equal(css.includes('min-height: 780px'), false)
  assert.match(base, /--phone-design-w:\s*390px/)
  assert.match(base, /--phone-design-h:\s*844px/)
  assert.match(css, /transform:\s*scale\(var\(--phone-scale\)\)/)
  assert.match(css, /\.app__main[\s\S]*?overflow:\s*hidden/)
  assert.equal(/overflow-y:\s*auto/.test(css), false)
  assert.equal(/overflow:\s*auto/.test(css), false)
  assert.equal(/overflow:\s*scroll/.test(css), false)
  assert.match(base, /overflow:\s*hidden/)
  assert.match(base, /100dvh/)
  assert.match(base, /100svh/)
  assert.match(base, /touch-action:\s*none/)
  assert.match(html, /viewport-fit=cover/)
  assert.match(html, /--phone-scale/)
  assert.match(app, /usePhoneScale/)
  assert.match(app, /app__fit/)
})
