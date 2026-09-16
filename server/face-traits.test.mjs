import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  LM,
  scoreFace,
  tribeScoreFromTraits,
} from '../shared/face-traits.mjs'
import { nearestType } from '../shared/phenotype-catalog.mjs'

function fillRect(image, x0, y0, x1, y1, rgb) {
  const xStart = Math.max(0, Math.floor(x0))
  const yStart = Math.max(0, Math.floor(y0))
  const xEnd = Math.min(image.width, Math.ceil(x1))
  const yEnd = Math.min(image.height, Math.ceil(y1))
  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const i = (y * image.width + x) * 4
      image.data[i] = rgb[0]
      image.data[i + 1] = rgb[1]
      image.data[i + 2] = rgb[2]
      image.data[i + 3] = 255
    }
  }
}

function makeImage(skin, hair, eyes) {
  const width = 240
  const height = 300
  const image = { width, height, data: new Uint8ClampedArray(width * height * 4) }
  fillRect(image, 0, 0, width, height, [210, 210, 210])
  fillRect(image, 40, 0, 200, 70, hair)
  fillRect(image, 50, 55, 190, 260, skin)
  fillRect(image, 78, 118, 102, 138, eyes)
  fillRect(image, 138, 118, 162, 138, eyes)
  return image
}

function landmarksFrom({
  cheeks,
  nostrils,
  lips,
  jaw,
  cheekbones,
  mouth,
  eyes,
  midface = 0.32,
  bridge = 0.07,
  ears = 0.16,
}) {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
  const set = (index, x, y) => {
    points[index] = { x, y, z: 0 }
  }
  set(LM.forehead, 0.5, 0.28)
  set(LM.glabella, 0.5, 0.36)
  set(LM.chin, 0.5, 0.88)
  set(LM.leftCheek, 0.5 - cheeks, 0.52)
  set(LM.rightCheek, 0.5 + cheeks, 0.52)
  set(LM.leftNostril, 0.5 - nostrils, 0.58)
  set(LM.rightNostril, 0.5 + nostrils, 0.58)
  set(LM.noseTip, 0.5, 0.56)
  set(LM.noseBridge, 0.5, 0.4)
  set(LM.nasion, 0.5, 0.38)
  set(LM.noseBottom, 0.5, 0.36 + midface)
  set(LM.leftNoseBridge, 0.5 - bridge, 0.42)
  set(LM.rightNoseBridge, 0.5 + bridge, 0.42)
  set(LM.mouthLeft, 0.5 - mouth, 0.7)
  set(LM.mouthRight, 0.5 + mouth, 0.7)
  set(LM.upperLip, 0.5, 0.7 - lips)
  set(LM.lowerLip, 0.5, 0.7 + lips)
  set(LM.leftJaw, 0.5 - jaw, 0.78)
  set(LM.rightJaw, 0.5 + jaw, 0.78)
  set(LM.leftCheekbone, 0.5 - cheekbones, 0.48)
  set(LM.rightCheekbone, 0.5 + cheekbones, 0.48)
  set(LM.leftEyeOuter, 0.5 - eyes - 0.04, 0.42)
  set(LM.leftEyeInner, 0.5 - eyes + 0.04, 0.42)
  set(LM.rightEyeInner, 0.5 + eyes - 0.04, 0.42)
  set(LM.rightEyeOuter, 0.5 + eyes + 0.04, 0.42)
  set(LM.leftIris, 0.5 - eyes, 0.42)
  set(LM.rightIris, 0.5 + eyes, 0.42)
  set(LM.leftEarTop, 0.12, 0.4)
  set(LM.leftEarLobe, 0.12, 0.4 + ears)
  set(LM.rightEarTop, 0.88, 0.4)
  set(LM.rightEarLobe, 0.88, 0.4 + ears)
  set(LM.leftSkin, 0.38, 0.55)
  set(LM.rightSkin, 0.62, 0.55)
  return points
}

const fairFace = {
  image: makeImage([232, 198, 176], [214, 196, 160], [110, 150, 196]),
  landmarks: landmarksFrom({
    cheeks: 0.18,
    nostrils: 0.035,
    lips: 0.028,
    jaw: 0.16,
    cheekbones: 0.19,
    mouth: 0.09,
    eyes: 0.12,
    midface: 0.28,
    bridge: 0.055,
    ears: 0.14,
  }),
}

const deepFace = {
  image: makeImage([78, 46, 32], [22, 14, 10], [48, 32, 22]),
  landmarks: landmarksFrom({
    cheeks: 0.24,
    nostrils: 0.08,
    lips: 0.07,
    jaw: 0.2,
    cheekbones: 0.21,
    mouth: 0.13,
    eyes: 0.13,
    midface: 0.36,
    bridge: 0.1,
    ears: 0.2,
  }),
}

describe('tribal scoring from faces', () => {
  it('scores two synthetic faces onto different tribe values and types', () => {
    const fair = scoreFace(fairFace.landmarks, fairFace.image)
    const deep = scoreFace(deepFace.landmarks, deepFace.image)

    assert.ok(fair.traits.melanin < deep.traits.melanin)
    assert.ok(fair.traits.eyeColor > deep.traits.eyeColor)
    assert.ok(fair.traits.hairPattern < deep.traits.hairPattern)
    assert.ok(fair.traits.noseShape < deep.traits.noseShape)
    assert.ok(fair.traits.lipFullness < deep.traits.lipFullness)
    assert.notEqual(fair.traits.tribe, deep.traits.tribe)
    assert.ok(Math.abs(fair.traits.tribe - deep.traits.tribe) >= 8)

    const fairType = nearestType(fair.traits)
    const deepType = nearestType(deep.traits)
    assert.notEqual(fairType.type.id, deepType.type.id)
    assert.equal(fair.traits.tribe, tribeScoreFromTraits(fair.traits, fair.extra))
    assert.equal(deep.traits.tribe, tribeScoreFromTraits(deep.traits, deep.extra))
    assert.ok(Number.isFinite(fair.extra.boneIndex))
    assert.ok(Number.isFinite(fair.extra.cartilage))
    assert.ok(Number.isFinite(fair.extra.hairThickness))
    assert.ok(Number.isFinite(fair.extra.bridgeScore))
    assert.ok(Number.isFinite(fair.extra.thirdsScore))
    assert.notEqual(fair.extra.boneIndex, deep.extra.boneIndex)
    assert.notEqual(fair.extra.cartilage, deep.extra.cartilage)
  })

  it('changes tribe when bone and cartilage change but shade stays put', () => {
    const image = makeImage([200, 160, 130], [80, 60, 40], [90, 80, 70])
    const compact = scoreFace(
      landmarksFrom({
        cheeks: 0.2,
        nostrils: 0.03,
        lips: 0.03,
        jaw: 0.12,
        cheekbones: 0.14,
        mouth: 0.08,
        eyes: 0.1,
        midface: 0.22,
        bridge: 0.04,
        ears: 0.1,
      }),
      image,
    )
    const open = scoreFace(
      landmarksFrom({
        cheeks: 0.2,
        nostrils: 0.08,
        lips: 0.03,
        jaw: 0.22,
        cheekbones: 0.26,
        mouth: 0.14,
        eyes: 0.15,
        midface: 0.4,
        bridge: 0.13,
        ears: 0.24,
      }),
      image,
    )
    assert.equal(compact.traits.melanin, open.traits.melanin)
    assert.ok(open.extra.boneIndex - compact.extra.boneIndex >= 10)
    assert.ok(open.extra.cartilage - compact.extra.cartilage >= 10)
    assert.ok(Math.abs(compact.traits.tribe - open.traits.tribe) >= 6)

    const base = {
      melanin: 50,
      eyeColor: 50,
      hairPattern: 50,
      noseShape: 50,
      lipFullness: 50,
      facialStructure: 50,
      jawLine: 50,
      cheekboneStructure: 50,
    }
    const lowBone = tribeScoreFromTraits(base, { boneIndex: 18, cartilage: 20, hairThickness: 22 })
    const highBone = tribeScoreFromTraits(base, { boneIndex: 88, cartilage: 84, hairThickness: 80 })
    assert.ok(highBone - lowBone >= 20)
  })

  it('does not emit a constant stub tribe score', () => {
    const fair = scoreFace(fairFace.landmarks, fairFace.image)
    const deep = scoreFace(deepFace.landmarks, deepFace.image)
    const midImage = makeImage([160, 118, 92], [60, 42, 30], [72, 58, 48])
    const midLandmarks = landmarksFrom({
      cheeks: 0.21,
      nostrils: 0.055,
      lips: 0.045,
      jaw: 0.18,
      cheekbones: 0.2,
      mouth: 0.11,
      eyes: 0.125,
    })
    const mid = scoreFace(midLandmarks, midImage)
    const tribes = new Set([fair.traits.tribe, mid.traits.tribe, deep.traits.tribe])
    assert.ok(tribes.size >= 3)
  })
})
