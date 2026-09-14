import type { Phenotype, Trait } from '../src/types'
import type { TraitVector, TribalExtra } from './face-traits.mjs'

export {
  TRAIT_IDS,
  TRAIT_KEY_BY_ID,
  TRAIT_LABELS,
  TRAIT_OBJECT_KEYS,
  clampScore,
  describeTribalMarkers,
  tribeScoreFromTraits,
} from './face-traits.mjs'

export type PhenotypeType = {
  id: string
  name: string
  code: string
  tagline: string
  genealogyLineage: string
  traits: TraitVector
}

export function buildVisualTraits(input: Partial<TraitVector> | Trait[]): Trait[]
export function traitVectorFrom(input: unknown): TraitVector | null
export function hasAnalyzedTraits(input: unknown): boolean
export function normalizeTraitVector(input: unknown, extra?: TribalExtra): TraitVector
export function traitDistance(a: unknown, b: unknown): number
export function nearestType(
  traits: unknown,
  suggestedTypeId?: string,
): { type: PhenotypeType; distance: number; confidence: number }
export function assignPhenotypeFromScan(
  input: unknown,
  options?: {
    suggestedTypeId?: string
    extra?: TribalExtra
    gene?: Partial<Phenotype>
    source?: string
  },
): Phenotype

export const phenotypeTypes: PhenotypeType[]
export const phenotypeTypeById: Record<string, PhenotypeType>
export const userPhenotype: Phenotype
export const matches: Array<{
  phenotype: Phenotype
  sharedTraits: string[]
  complementaryTraits: string[]
  distance: string
  age: number | null
  virginity: string
  genealogy: number
}>
export const filterOptions: {
  virginity: string[]
  genealogy: Array<{ label: string; min: number }>
  age: Array<{ label: string; min: number; max: number }>
}
export const ageRangeOptions: Array<{ label: string; min: number; max: number }>
export const genealogyOptions: Array<{ label: string; min: number }>
export const scanSteps: string[]
