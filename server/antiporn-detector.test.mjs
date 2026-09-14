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

  it('covers a large skin cluster without hiding a single center patch', () => {
    const skin = image(40, 40, (x, y) => {
      if (x > 8 && x < 32 && y > 8 && y < 32) return [210, 155, 125, 255]
      return [20, 40, 180, 255]
    })
    const result = detectNudity(skin, 35, 200, 200)
    assert.ok(result.skinRatio > 0.2)
    assert.ok(result.boxes.length >= 1)
    assert.equal(result.boxes[0].kind === 'explicit' || result.explicitLikely, true)
    assert.equal(result.strongExplicit, false)
    const remote = filterDecision(result, { enabled: true, hideOnExplicit: true })
    assert.equal(remote.hide, false)
    assert.ok(remote.boxes.length >= 1)
    const local = filterDecision(result, { enabled: true, localPreview: true })
    assert.equal(local.hide, false)
  })

  it('does not hide a face-like selfie even when skinRatio is high', () => {
    const face = image(40, 40, (x, y) => {
      const dx = (x - 20) / 12
      const dy = (y - 14) / 13
      if (dx * dx + dy * dy < 1) return [210, 155, 125, 255]
      return [20, 40, 180, 255]
    })
    const result = detectNudity(face, 35, 200, 200)
    assert.ok(result.skinRatio >= 0.22, `expected close-up skinRatio, got ${result.skinRatio}`)
    assert.equal(result.explicitLikely, true)
    assert.equal(result.strongExplicit, false)
    assert.equal(filterDecision(result, { localPreview: true }).hide, false)
    assert.equal(filterDecision(result, { hideOnExplicit: true }).hide, false)
  })

  it('hides a remote feed on stronger lower-body explicit signal', () => {
    const torso = image(40, 40, (x, y) => {
      if (x > 8 && x < 32 && y > 18) return [210, 155, 125, 255]
      return [20, 40, 180, 255]
    })
    const result = detectNudity(torso, 35, 200, 200)
    assert.equal(result.strongExplicit, true)
    assert.equal(filterDecision(result, { hideOnExplicit: true }).hide, true)
    assert.equal(filterDecision(result, { localPreview: true, hideOnExplicit: true }).hide, false)
  })

  it('leaves a non-skin frame uncovered', () => {
    const cool = image(24, 24, () => [12, 40, 200, 255])
    const result = detectNudity(cool, 35, 120, 120)
    assert.equal(result.boxes.length, 0)
    assert.equal(result.explicitLikely, false)
    assert.equal(result.strongExplicit, false)
    const off = filterDecision(result, { enabled: false })
    assert.deepEqual(off.boxes, [])
    assert.equal(off.hide, false)
  })
})
