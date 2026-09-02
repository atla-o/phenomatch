/**
 * Matching: filter by virginity / genealogy / age, then rank by
 * visual traits + tribe overlap + genealogy cluster proximity.
 */

function traitValue(traits, id) {
  return traits.find((t) => t.id === id)?.value ?? 0
}

function closeness(a, b) {
  return 100 - Math.min(100, Math.abs(a - b))
}

export function applyMatchFilters(matches, filters = {}) {
  const virginity = filters.virginity ?? 'any'
  const genealogyMin = Number(filters.genealogyMin ?? 0)
  const ageMin = Number(filters.ageMin ?? 18)
  const ageMax = Number(filters.ageMax ?? 99)

  return matches.filter((match) => {
    if (virginity !== 'any' && match.virginity !== virginity) return false
    if (match.genealogy < genealogyMin) return false
    if (match.age < ageMin || match.age > ageMax) return false
    return true
  })
}

const VISUAL_TRAIT_IDS = [
  'melanin',
  'eye-color',
  'hair',
  'nose',
  'lips',
  'facial',
  'jaw',
  'cheekbone',
]

export function clusterScore(userPhenotype, match) {
  const userTraits = userPhenotype.traits ?? []
  const candidateTraits = match.phenotype?.traits ?? []

  const visual =
    VISUAL_TRAIT_IDS.reduce((sum, id) => {
      return sum + closeness(traitValue(userTraits, id), traitValue(candidateTraits, id))
    }, 0) / VISUAL_TRAIT_IDS.length

  const tribe = closeness(traitValue(userTraits, 'tribe'), traitValue(candidateTraits, 'tribe'))
  const genealogy = closeness(userPhenotype.genealogyLikelihood ?? 0, match.genealogy ?? 0)

  return Math.round(visual * 0.5 + tribe * 0.25 + genealogy * 0.25)
}

export function rankMatches(userPhenotype, matches) {
  return [...matches]
    .map((match) => ({
      ...match,
      compatibility: clusterScore(userPhenotype, match),
    }))
    .sort((a, b) => b.compatibility - a.compatibility)
}

export function queryMatches(userPhenotype, catalogMatches, filters) {
  const filtered = applyMatchFilters(catalogMatches, filters)
  return rankMatches(userPhenotype, filtered)
}
