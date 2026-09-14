import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PHONE_DESIGN_HEIGHT,
  PHONE_DESIGN_WIDTH,
  computePhoneScale,
} from '../shared/phone-shell.mjs'

describe('phone shell scale', () => {
  it('is 1 at the 390×844 design size', () => {
    assert.equal(computePhoneScale(PHONE_DESIGN_WIDTH, PHONE_DESIGN_HEIGHT), 1)
  })

  it('shrinks uniformly for short Safari chrome', () => {
    assert.equal(computePhoneScale(390, 650), 650 / 844)
    assert.equal(computePhoneScale(390, 700), 700 / 844)
  })

  it('does not upscale on a desktop viewport', () => {
    assert.equal(computePhoneScale(1280, 900), 1)
    assert.equal(computePhoneScale(1280, 900, { maxScale: 1 }), 1)
  })

  it('can fill a slightly wider iPhone when height allows', () => {
    const scale = computePhoneScale(430, 932)
    assert.ok(scale > 1)
    assert.equal(scale, Math.min(430 / 390, 932 / 844))
  })
})
