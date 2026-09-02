export type Trait = {
  id: string
  label: string
  value: number
  category: 'physical' | 'tribal'
  detail?: string
}

export type Phenotype = {
  id: string
  name: string
  code: string
  tagline: string
  traits: Trait[]
  genealogyLikelihood: number
  genealogyLineage: string
}

export type VirginityStatus = 'virgin' | 'non-virgin' | 'undisclosed'

export type MatchType = 'cluster' | 'anonymous'
export type MatchCategory = MatchType

export type Match = {
  phenotype: Phenotype
  compatibility: number
  sharedTraits: string[]
  complementaryTraits: string[]
  distance: string
  age: number | null
  virginity: VirginityStatus
  genealogy: number
  matchType?: MatchType
  guestId?: string
  anonymous?: boolean
}

export type MatchFilters = {
  virginity: 'any' | VirginityStatus
  genealogyMin: number
  ageMin: number
  ageMax: number
}

export type AppView = 'pheno' | 'match'

export const defaultMatchFilters: MatchFilters = {
  virginity: 'any',
  genealogyMin: 0,
  ageMin: 18,
  ageMax: 45,
}
