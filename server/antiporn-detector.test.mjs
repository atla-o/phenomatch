import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { detectNudity, filterDecision, isSkinPixel } from '../shared/antiporn-detector.mjs'

function image(width, height, fill) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const pixel = fill(i % width, (i / width) | 0)
    data.set(pixel, i * 4)
  }
  return { data, width, height }
}

describe('antiporn detector', () => {
  it('classifies obvious skin vs non-skin pixels', () => {
    assert.equal(isSkinPixel(210, 160, 130), true)
    assert.equal(isSkinPixel(0, 0, 255), false)
    assert.equal(isSkinPixel(10, 10, 10), false)
  })

  it('covers a large skin cluster and can hide the feed', () => {
    const skin = image(40, 40, (x, y) => {
      if (x > 8 && x < 32 && y > 8 && y < 32) return [210, 155, 125, 255]
      return [20, 40, 180, 255]
    })
    const result = detectNudity(skin, 35, 200, 200)
    assert.ok(result.skinRatio > 0.2)
    assert.ok(result.boxes.length >= 1)
    assert.equal(result.boxes[0].kind === 'explicit' || result.explicitLikely, true)
    const decision = filterDecision(result, { enabled: true, hideOnExplicit: true })
    assert.equal(decision.hide, result.explicitLikely)
    assert.ok(decision.boxes.length >= 1)
  })

  it('leaves a non-skin frame uncovered', () => {
    const cool = image(24, 24, () => [12, 40, 200, 255])
    const result = detectNudity(cool, 35, 120, 120)
    assert.equal(result.boxes.length, 0)
    assert.equal(result.explicitLikely, false)
    const off = filterDecision(result, { enabled: false })
    assert.deepEqual(off.boxes, [])
    assert.equal(off.hide, false)
  })
})
