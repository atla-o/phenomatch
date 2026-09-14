/**
 * Visible-identifier scoring from face landmarks + image samples.
 *
 * Honest mapping (not a medical, genetic, or ancestry test):
 * - Melanin: inverse lightness of forehead/cheek patches (CIE L*). Lighting,
 *   makeup, and white-balance shift this. It is a color cluster, not a
 *   melanin assay.
 * - Eye color: iris-patch lightness and blue/green hue. Sclera and glasses
 *   contaminate samples.
 * - Hair: darkness of a band above the forehead. Baldness, hats, and
 *   backgrounds leak in.
 * - Nose / lips / facial / jaw / cheekbone: 2D landmark ratios. Distances
 *   are aspect-corrected so landscape frames do not collapse facial
 *   structure. Pose, focal length, and expression still move them.
 * - Tribe: a derived cluster index from pigmentation, iris lightness,
 *   breadth (nose+lips), relief (jaw+cheekbone), plus extra intercanthal
 *   and mouth-width ratios. It is a visible-identifier coordinate used to
 *   assign a catalog type — not ethnicity, DNA, or tribal membership.
 */

export const TRAIT_OBJECT_KEYS = [
  'melanin',
  'eyeColor',
  'hairPattern',
  'noseShape',
  'lipFullness',
  'facialStructure',
  'jawLine',
  'cheekboneStructure',
  'tribe',
]

export const TRAIT_IDS = [
  'melanin',
  'eye-color',
  'hair',
  'nose',
  'lips',
  'facial',
  'jaw',
  'cheekbone',
  'tribe',
]

export const TRAIT_KEY_BY_ID = {
  melanin: 'melanin',
  'eye-color': 'eyeColor',
  hair: 'hairPattern',
  nose: 'noseShape',
  lips: 'lipFullness',
  facial: 'facialStructure',
  jaw: 'jawLine',
  cheekbone: 'cheekboneStructure',
  tribe: 'tribe',
}

export const TRAIT_ID_BY_KEY = Object.fromEntries(
  Object.entries(TRAIT_KEY_BY_ID).map(([id, key]) => [key, id]),
)

export const TRAIT_LABELS = {
  melanin: 'Melanin Index',
  'eye-color': 'Eye Color',
  hair: 'Hair Pattern',
  nose: 'Nose Shape',
  lips: 'Lip Fullness',
  facial: 'Facial Structure',
  jaw: 'Jaw Line',
  cheekbone: 'Cheekbone Structure',
  tribe: 'Tribe',
}

/** MediaPipe Face Mesh indices (468 mesh + optional iris 468–477). */
export const LM = {
  forehead: 10,
  chin: 152,
  leftCheek: 234,
  rightCheek: 454,
  noseTip: 1,
  noseBridge: 168,
  noseBottom: 2,
  leftNostril: 98,
  rightNostril: 327,
  leftEyeOuter: 33,
  leftEyeInner: 133,
  rightEyeInner: 362,
  rightEyeOuter: 263,
  leftIris: 468,
  rightIris: 473,
  mouthLeft: 61,
  mouthRight: 291,
  upperLip: 0,
  lowerLip: 17,
  innerUpper: 13,
  innerLower: 14,
  leftCheekbone: 116,
  rightCheekbone: 345,
  leftJaw: 172,
  rightJaw: 397,
  leftSkin: 50,
  rightSkin: 280,
}

export function clampScore(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(Math.min(100, Math.max(0, n)))
}

export function lerpScore(value, min, max) {
  const lo = Number(min)
  const hi = Number(max)
  if (!(Number.isFinite(lo) && Number.isFinite(hi)) || lo === hi) return 0
  return clampScore(((Number(value) - lo) / (hi - lo)) * 100)
}

function point(landmarks, index) {
  const p = landmarks?.[index]
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null
  return p
}

function dist(a, b, aspect = 1) {
  if (!a || !b) return 0
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y)
}

function mix(a, b, weightA = 0.5) {
  return a * weightA + b * (1 - weightA)
}

export function geometryFromLandmarks(landmarks, image) {
  const aspect = image?.height ? image.width / image.height : 1
  const forehead = point(landmarks, LM.forehead)
  const chin = point(landmarks, LM.chin)
  const leftCheek = point(landmarks, LM.leftCheek)
  const rightCheek = point(landmarks, LM.rightCheek)
  const leftNostril = point(landmarks, LM.leftNostril)
  const rightNostril = point(landmarks, LM.rightNostril)
  const mouthLeft = point(landmarks, LM.mouthLeft)
  const mouthRight = point(landmarks, LM.mouthRight)
  const upperLip = point(landmarks, LM.upperLip)
  const lowerLip = point(landmarks, LM.lowerLip)
  const leftJaw = point(landmarks, LM.leftJaw)
  const rightJaw = point(landmarks, LM.rightJaw)
  const leftCheekbone = point(landmarks, LM.leftCheekbone)
  const rightCheekbone = point(landmarks, LM.rightCheekbone)
  const leftEyeInner = point(landmarks, LM.leftEyeInner)
  const rightEyeInner = point(landmarks, LM.rightEyeInner)

  const faceWidth = dist(leftCheek, rightCheek, aspect) || 0.4
  const faceHeight = dist(forehead, chin, aspect) || 0.6
  const noseWidth = dist(leftNostril, rightNostril, aspect)
  const mouthWidth = dist(mouthLeft, mouthRight, aspect) || 0.2
  const lipHeight = dist(upperLip, lowerLip, aspect)
  const jawWidth = dist(leftJaw, rightJaw, aspect)
  const cheekboneWidth = dist(leftCheekbone, rightCheekbone, aspect)
  const intercanthal = dist(leftEyeInner, rightEyeInner, aspect)

  const extra = {
    intercanthalIndex: intercanthal / faceWidth,
    mouthIndex: mouthWidth / faceWidth,
    faceIndex: faceWidth / faceHeight,
  }

  return {
    faceWidth,
    faceHeight,
    extra,
    noseShape: lerpScore(noseWidth / faceWidth, 0.12, 0.42),
    lipFullness: lerpScore(lipHeight / mouthWidth, 0.14, 0.72),
    facialStructure: lerpScore(faceWidth / faceHeight, 0.52, 0.98),
    jawLine: lerpScore(jawWidth / faceWidth, 0.62, 0.98),
    cheekboneStructure: lerpScore(cheekboneWidth / (jawWidth || faceWidth), 0.92, 1.28),
  }
}

function srgbToLinear(c) {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function rgbToLab(r, g, b) {
  const R = srgbToLinear(r)
  const G = srgbToLinear(g)
  const B = srgbToLinear(b)
  let x = R * 0.4124 + G * 0.3576 + B * 0.1805
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722
  let z = R * 0.0193 + G * 0.1192 + B * 0.9505
  x /= 0.95047
  z /= 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }
}

export function samplePatch(image, nx, ny, radius = 5) {
  const width = image?.width || 0
  const height = image?.height || 0
  const data = image?.data
  if (!width || !height || !data) return null
  const cx = Math.round(nx * (width - 1))
  const cy = Math.round(ny * (height - 1))
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    if (y < 0 || y >= height) continue
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if (x < 0 || x >= width) continue
      const i = (y * width + x) * 4
      const pr = data[i]
      const pg = data[i + 1]
      const pb = data[i + 2]
      const pa = data[i + 3]
      if (pa < 180) continue
      const L = rgbToLab(pr, pg, pb).L
      if (L < 2 || L > 98) continue
      r += pr
      g += pg
      b += pb
      n += 1
    }
  }
  if (!n) return null
  return { r: r / n, g: g / n, b: b / n, n }
}

function meanLab(samples) {
  if (!samples.length) return null
  let L = 0
  let a = 0
  let b = 0
  for (const sample of samples) {
    const lab = rgbToLab(sample.r, sample.g, sample.b)
    L += lab.L
    a += lab.a
    b += lab.b
  }
  const n = samples.length
  return { L: L / n, a: a / n, b: b / n }
}

function irisHueScore(lab) {
  if (!lab) return 50
  const lightness = lerpScore(lab.L, 12, 72)
  const blueGreen = lab.b < 8 ? lerpScore(-lab.b, -6, 28) : 0
  return clampScore(lightness * 0.62 + blueGreen * 0.38)
}

export function colorsFromImage(image, landmarks, geom) {
  const forehead = point(landmarks, LM.forehead)
  const leftSkin = point(landmarks, LM.leftSkin) || point(landmarks, LM.leftCheek)
  const rightSkin = point(landmarks, LM.rightSkin) || point(landmarks, LM.rightCheek)
  const leftIris = point(landmarks, LM.leftIris) || midpoint(point(landmarks, LM.leftEyeOuter), point(landmarks, LM.leftEyeInner))
  const rightIris = point(landmarks, LM.rightIris) || midpoint(point(landmarks, LM.rightEyeOuter), point(landmarks, LM.rightEyeInner))

  const skinSamples = [forehead, leftSkin, rightSkin]
    .filter(Boolean)
    .map((p) => samplePatch(image, p.x, p.y, 7))
    .filter(Boolean)
  const skin = meanLab(skinSamples)

  const eyeSamples = [leftIris, rightIris]
    .filter(Boolean)
    .map((p) => samplePatch(image, p.x, p.y, 3))
    .filter(Boolean)
  const iris = meanLab(eyeSamples)

  const hairPoint = forehead
    ? {
        x: forehead.x,
        y: Math.max(0.02, forehead.y - (geom?.faceHeight || 0.55) * 0.22),
      }
    : { x: 0.5, y: 0.08 }
  const hairLeft = { x: Math.max(0.12, hairPoint.x - 0.12), y: hairPoint.y }
  const hairRight = { x: Math.min(0.88, hairPoint.x + 0.12), y: hairPoint.y }
  const hairSamples = [hairPoint, hairLeft, hairRight]
    .map((p) => samplePatch(image, p.x, p.y, 6))
    .filter(Boolean)
  const hair = meanLab(hairSamples)

  return {
    melanin: skin ? lerpScore(skin.L, 84, 22) : 50,
    eyeColor: irisHueScore(iris),
    hairPattern: hair ? lerpScore(hair.L, 78, 8) : 50,
    samples: {
      skinCount: skinSamples.length,
      eyeCount: eyeSamples.length,
      hairCount: hairSamples.length,
    },
  }
}

function midpoint(a, b) {
  if (!a || !b) return a || b || null
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function tribeScoreFromTraits(traits = {}, extra = {}) {
  const pigmentation = mix(Number(traits.melanin) || 0, Number(traits.hairPattern) || 0, 0.72)
  const iris = Number(traits.eyeColor) || 0
  const breadth = mix(Number(traits.noseShape) || 0, Number(traits.lipFullness) || 0, 0.55)
  const relief = mix(Number(traits.cheekboneStructure) || 0, Number(traits.jawLine) || 0, 0.55)
  const extraScore = clampScore(
    lerpScore(Number(extra.intercanthalIndex) || 0.28, 0.18, 0.4) * 0.5 +
      lerpScore(Number(extra.mouthIndex) || 0.32, 0.24, 0.5) * 0.5,
  )
  return clampScore(
    pigmentation * 0.34 +
      (100 - iris) * 0.18 +
      breadth * 0.24 +
      relief * 0.12 +
      extraScore * 0.12,
  )
}

export function describeTribalMarkers(traits = {}, extra = {}, type = null) {
  const tribe = clampScore(traits.tribe ?? tribeScoreFromTraits(traits, extra))
  const breadth = clampScore(mix(Number(traits.noseShape) || 0, Number(traits.lipFullness) || 0, 0.55))
  const relief = clampScore(mix(Number(traits.cheekboneStructure) || 0, Number(traits.jawLine) || 0, 0.55))
  return [
    {
      id: 'tribe',
      label: 'Tribe',
      value: tribe,
      category: 'tribal',
      detail: type
        ? `${type.name} · visible-identifier cluster, not ancestry`
        : 'Visible-identifier cluster, not ancestry',
    },
    {
      id: 'melanin-marker',
      label: 'Melanin cluster',
      value: clampScore(traits.melanin),
      category: 'tribal',
      detail: 'Skin-patch lightness on this frame',
    },
    {
      id: 'iris-marker',
      label: 'Iris lattice',
      value: clampScore(traits.eyeColor),
      category: 'tribal',
      detail: 'Iris lightness and blue/green hue',
    },
    {
      id: 'structure-marker',
      label: 'Breadth index',
      value: breadth,
      category: 'tribal',
      detail: 'Nose width and lip fullness ratios',
    },
    {
      id: 'relief-marker',
      label: 'Relief index',
      value: relief,
      category: 'tribal',
      detail: 'Cheekbone and jaw geometry',
    },
  ]
}

export function scoreFace(landmarks, image) {
  if (!landmarks || landmarks.length < 140) {
    const error = new Error('no_face')
    error.code = 'NO_FACE'
    throw error
  }
  const geom = geometryFromLandmarks(landmarks, image)
  const colors = colorsFromImage(image, landmarks, geom)
  const traits = {
    melanin: colors.melanin,
    eyeColor: colors.eyeColor,
    hairPattern: colors.hairPattern,
    noseShape: geom.noseShape,
    lipFullness: geom.lipFullness,
    facialStructure: geom.facialStructure,
    jawLine: geom.jawLine,
    cheekboneStructure: geom.cheekboneStructure,
    tribe: 0,
  }
  traits.tribe = tribeScoreFromTraits(traits, geom.extra)
  return {
    traits,
    extra: geom.extra,
    geom,
    colors,
    landmarkCount: landmarks.length,
  }
}
