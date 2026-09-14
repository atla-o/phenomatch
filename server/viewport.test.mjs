import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('phone shell fills the visible viewport without a 780px min-height', () => {
  const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
  const base = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

  assert.equal(css.includes('min-height: 780px'), false)
  assert.match(css, /\.app__phone[\s\S]*?height:\s*100%/)
  assert.match(css, /100dvh/)
  assert.match(css, /100svh/)
  assert.match(base, /overflow:\s*hidden/)
  assert.match(html, /viewport-fit=cover/)
})
