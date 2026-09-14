export const TRAIT_OBJECT_KEYS: string[]
export const TRAIT_IDS: string[]
export const TRAIT_KEY_BY_ID: Record<string, string>
export const TRAIT_ID_BY_KEY: Record<string, string>
export const TRAIT_LABELS: Record<string, string>
export const LM: Record<string, number>

export function clampScore(value: number): number
export function lerpScore(value: number, min: number, max: number): number
export function rgbToLab(r: number, g: number, b: number): { L: number; a: number; b: number }
export function samplePatch(
  image: { width: number; height: number; data: ArrayLike<number> },
  nx: number,
  ny: number,
  radius?: number,
): { r: number; g: number; b: number; n: number } | null

export type TraitVector = {
  melanin: number
  eyeColor: number
  hairPattern: number
  noseShape: number
  lipFullness: number
  facialStructure: number
  jawLine: number
  cheekboneStructure: number
  tribe: number
}

export type TribalExtra = {
  intercanthalIndex?: number
  mouthIndex?: number
  faceIndex?: number
  landmarkCount?: number
}

export function geometryFromLandmarks(
  landmarks: Array<{ x: number; y: number; z?: number }>,
  image?: { width: number; height: number },
): {
  faceWidth: number
  faceHeight: number
  extra: TribalExtra
  noseShape: number
  lipFullness: number
  facialStructure: number
  jawLine: number
  cheekboneStructure: number
}

export function colorsFromImage(
  image: { width: number; height: number; data: ArrayLike<number> },
  landmarks: Array<{ x: number; y: number; z?: number }>,
  geom?: { faceHeight?: number },
): { melanin: number; eyeColor: number; hairPattern: number; samples: Record<string, number> }

export function tribeScoreFromTraits(traits?: Partial<TraitVector>, extra?: TribalExtra): number
export function describeTribalMarkers(
  traits?: Partial<TraitVector>,
  extra?: TribalExtra,
  type?: { name?: string } | null,
): Array<{ id: string; label: string; value: number; category: 'tribal'; detail?: string }>
export function scoreFace(
  landmarks: Array<{ x: number; y: number; z?: number }>,
  image: { width: number; height: number; data: ArrayLike<number> },
): {
  traits: TraitVector
  extra: TribalExtra
  geom: ReturnType<typeof geometryFromLandmarks>
  colors: ReturnType<typeof colorsFromImage>
  landmarkCount: number
}
