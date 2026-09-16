/**
 * Shared phenotype / type catalog for client + server.
 * Types are visible-identifier clusters, not medical or genetic labels.
 */

import {
  TRAIT_IDS,
  TRAIT_KEY_BY_ID,
  TRAIT_LABELS,
  TRAIT_OBJECT_KEYS,
  buildGenomeReadout,
  clampScore,
  describeTribalMarkers,
  tribeScoreFromTraits,
} from './face-traits.mjs'

export {
  TRAIT_IDS,
  TRAIT_KEY_BY_ID,
  TRAIT_LABELS,
  TRAIT_OBJECT_KEYS,
  buildGenomeReadout,
  clampScore,
  describeTribalMarkers,
  tribeScoreFromTraits,
}

function withTribe(traits) {
  return { ...traits, tribe: tribeScoreFromTraits(traits) }
}

export function buildVisualTraits(input) {
  const traits = typeof input.melanin === 'number' ? input : traitVectorFrom(input)
  return TRAIT_IDS.map((id) => {
    const key = TRAIT_KEY_BY_ID[id]
    return {
      id,
      label: TRAIT_LABELS[id],
      value: clampScore(traits[key]),
      category: id === 'tribe' ? 'tribal' : 'physical',
    }
  })
}

export function traitVectorFrom(input) {
  if (!input) return null
  if (Array.isArray(input)) {
    const byId = Object.fromEntries(input.map((trait) => [trait.id, trait.value]))
    return {
      melanin: Number(byId.melanin),
      eyeColor: Number(byId['eye-color']),
      hairPattern: Number(byId.hair),
      noseShape: Number(byId.nose),
      lipFullness: Number(byId.lips),
      facialStructure: Number(byId.facial),
      jawLine: Number(byId.jaw),
      cheekboneStructure: Number(byId.cheekbone),
      tribe: Number(byId.tribe),
    }
  }
  if (typeof input === 'object') {
    if (Array.isArray(input.traits)) return traitVectorFrom(input.traits)
    return {
      melanin: Number(input.melanin),
      eyeColor: Number(input.eyeColor ?? input.eye_color),
      hairPattern: Number(input.hairPattern ?? input.hair),
      noseShape: Number(input.noseShape ?? input.nose),
      lipFullness: Number(input.lipFullness ?? input.lips),
      facialStructure: Number(input.facialStructure ?? input.facial),
      jawLine: Number(input.jawLine ?? input.jaw),
      cheekboneStructure: Number(input.cheekboneStructure ?? input.cheekbone),
      tribe: Number(input.tribe),
    }
  }
  return null
}

export function hasAnalyzedTraits(input) {
  const traits = traitVectorFrom(input)
  if (!traits) return false
  const required = TRAIT_OBJECT_KEYS.filter((key) => key !== 'tribe')
  return required.every((key) => Number.isFinite(traits[key]))
}

export function normalizeTraitVector(input, extra) {
  const traits = traitVectorFrom(input)
  if (!hasAnalyzedTraits(traits)) {
    const error = new Error('traits_required')
    error.code = 'TRAITS_REQUIRED'
    throw error
  }
  const next = {}
  for (const key of TRAIT_OBJECT_KEYS) {
    if (key === 'tribe') continue
    const value = Number(traits[key])
    if (value < 0 || value > 100) {
      const error = new Error(`invalid_trait:${key}`)
      error.code = 'INVALID_TRAIT'
      throw error
    }
    next[key] = clampScore(value)
  }
  next.tribe = clampScore(tribeScoreFromTraits(next, extra || {}))
  return next
}

function defineType({ id, name, code, tagline, genealogyLineage, traits }) {
  const scored = withTribe(traits)
  return {
    id,
    name,
    code,
    tagline,
    genealogyLineage,
    traits: scored,
  }
}

export const phenotypeTypes = [
  defineType({
    id: 'baltic-9',
    name: 'Baltic Fringe IX',
    code: 'GN-BF9',
    tagline: 'Baltic fringe lineage — light features, high cheekbones',
    genealogyLineage: 'Baltic fringe, generation depth 7',
    traits: { melanin: 22, eyeColor: 92, hairPattern: 24, noseShape: 28, lipFullness: 32, facialStructure: 48, jawLine: 70, cheekboneStructure: 86 },
  }),
  defineType({
    id: 'nordic-atlantic-7',
    name: 'Nordic-Atlantic VII',
    code: 'GN-NA7',
    tagline: 'North Sea lineage you can identify with',
    genealogyLineage: 'Nordic-Atlantic, generation depth 4',
    traits: { melanin: 28, eyeColor: 78, hairPattern: 34, noseShape: 32, lipFullness: 38, facialStructure: 52, jawLine: 64, cheekboneStructure: 72 },
  }),
  defineType({
    id: 'north-sea-12',
    name: 'North Sea Coastal XII',
    code: 'GN-NS12',
    tagline: 'Coastal Nordic lineage, strong tribal identifiers',
    genealogyLineage: 'North Sea coastal, generation depth 5',
    traits: { melanin: 32, eyeColor: 74, hairPattern: 42, noseShape: 34, lipFullness: 40, facialStructure: 55, jawLine: 62, cheekboneStructure: 70 },
  }),
  defineType({
    id: 'central-euro-5',
    name: 'Central European V',
    code: 'GN-CE5',
    tagline: 'Mixed Central European lineage',
    genealogyLineage: 'Central European mixed, generation depth 3',
    traits: { melanin: 38, eyeColor: 55, hairPattern: 55, noseShape: 42, lipFullness: 45, facialStructure: 58, jawLine: 58, cheekboneStructure: 55 },
  }),
  defineType({
    id: 'alpine-4',
    name: 'Alpine Highland IV',
    code: 'GN-AH4',
    tagline: 'Alpine highland lineage — broader midface',
    genealogyLineage: 'Alpine highland, generation depth 4',
    traits: { melanin: 42, eyeColor: 48, hairPattern: 62, noseShape: 48, lipFullness: 48, facialStructure: 68, jawLine: 72, cheekboneStructure: 64 },
  }),
  defineType({
    id: 'mediterranean-3',
    name: 'Mediterranean Basin III',
    code: 'GN-MB3',
    tagline: 'Mediterranean coastal lineage',
    genealogyLineage: 'Mediterranean basin, generation depth 6',
    traits: { melanin: 48, eyeColor: 42, hairPattern: 72, noseShape: 58, lipFullness: 58, facialStructure: 62, jawLine: 60, cheekboneStructure: 58 },
  }),
  defineType({
    id: 'iberian-6',
    name: 'Iberian Atlantic VI',
    code: 'GN-IA6',
    tagline: 'Iberian Atlantic lineage',
    genealogyLineage: 'Iberian Atlantic, generation depth 5',
    traits: { melanin: 50, eyeColor: 38, hairPattern: 70, noseShape: 52, lipFullness: 55, facialStructure: 60, jawLine: 58, cheekboneStructure: 54 },
  }),
  defineType({
    id: 'pontic-20',
    name: 'Pontic Steppe XX',
    code: 'GN-PS20',
    tagline: 'Pontic steppe lineage — wide cheekbones',
    genealogyLineage: 'Pontic steppe, generation depth 6',
    traits: { melanin: 44, eyeColor: 50, hairPattern: 58, noseShape: 50, lipFullness: 44, facialStructure: 64, jawLine: 66, cheekboneStructure: 78 },
  }),
  defineType({
    id: 'levantine-8',
    name: 'Levantine Corridor VIII',
    code: 'GN-LC8',
    tagline: 'Levantine corridor lineage',
    genealogyLineage: 'Levantine corridor, generation depth 6',
    traits: { melanin: 54, eyeColor: 32, hairPattern: 78, noseShape: 68, lipFullness: 56, facialStructure: 58, jawLine: 62, cheekboneStructure: 60 },
  }),
  defineType({
    id: 'persian-19',
    name: 'Persian Plateau XIX',
    code: 'GN-PP19',
    tagline: 'Persian plateau lineage',
    genealogyLineage: 'Persian plateau, generation depth 5',
    traits: { melanin: 52, eyeColor: 36, hairPattern: 74, noseShape: 62, lipFullness: 52, facialStructure: 56, jawLine: 64, cheekboneStructure: 66 },
  }),
  defineType({
    id: 'maghreb-2',
    name: 'Maghreb Coastal II',
    code: 'GN-MC2',
    tagline: 'Maghreb coastal lineage',
    genealogyLineage: 'Maghreb coastal, generation depth 5',
    traits: { melanin: 56, eyeColor: 34, hairPattern: 76, noseShape: 64, lipFullness: 60, facialStructure: 60, jawLine: 61, cheekboneStructure: 57 },
  }),
  defineType({
    id: 'nile-1',
    name: 'Nile-Saharan I',
    code: 'GN-NS1',
    tagline: 'Nile-Saharan lineage',
    genealogyLineage: 'Nile-Saharan, generation depth 6',
    traits: { melanin: 72, eyeColor: 22, hairPattern: 82, noseShape: 58, lipFullness: 62, facialStructure: 55, jawLine: 60, cheekboneStructure: 58 },
  }),
  defineType({
    id: 'horn-10',
    name: 'Horn Plateau X',
    code: 'GN-HP10',
    tagline: 'Horn plateau lineage',
    genealogyLineage: 'Horn plateau, generation depth 7',
    traits: { melanin: 76, eyeColor: 20, hairPattern: 84, noseShape: 44, lipFullness: 58, facialStructure: 52, jawLine: 58, cheekboneStructure: 62 },
  }),
  defineType({
    id: 'sahel-13',
    name: 'Sahel Savannah XIII',
    code: 'GN-SS13',
    tagline: 'Sahel savannah lineage',
    genealogyLineage: 'Sahel savannah, generation depth 5',
    traits: { melanin: 80, eyeColor: 18, hairPattern: 86, noseShape: 70, lipFullness: 72, facialStructure: 60, jawLine: 62, cheekboneStructure: 55 },
  }),
  defineType({
    id: 'west-african-11',
    name: 'West African Gulf XI',
    code: 'GN-WG11',
    tagline: 'West African gulf lineage',
    genealogyLineage: 'West African gulf, generation depth 5',
    traits: { melanin: 86, eyeColor: 16, hairPattern: 88, noseShape: 78, lipFullness: 82, facialStructure: 64, jawLine: 58, cheekboneStructure: 52 },
  }),
  defineType({
    id: 'andean-14',
    name: 'Andean Highland XIV',
    code: 'GN-AH14',
    tagline: 'Andean highland lineage — high cheekbones',
    genealogyLineage: 'Andean highland, generation depth 6',
    traits: { melanin: 58, eyeColor: 28, hairPattern: 80, noseShape: 54, lipFullness: 50, facialStructure: 70, jawLine: 56, cheekboneStructure: 88 },
  }),
  defineType({
    id: 'amazon-15',
    name: 'Amazon Basin XV',
    code: 'GN-AB15',
    tagline: 'Amazon basin lineage',
    genealogyLineage: 'Amazon basin, generation depth 5',
    traits: { melanin: 64, eyeColor: 24, hairPattern: 82, noseShape: 60, lipFullness: 58, facialStructure: 66, jawLine: 54, cheekboneStructure: 72 },
  }),
  defineType({
    id: 'east-asian-16',
    name: 'East Asian Continental XVI',
    code: 'GN-EA16',
    tagline: 'East Asian continental lineage',
    genealogyLineage: 'East Asian continental, generation depth 6',
    traits: { melanin: 46, eyeColor: 30, hairPattern: 85, noseShape: 40, lipFullness: 42, facialStructure: 78, jawLine: 52, cheekboneStructure: 74 },
  }),
  defineType({
    id: 'island-pacific-17',
    name: 'Island Pacific XVII',
    code: 'GN-IP17',
    tagline: 'Island Pacific lineage',
    genealogyLineage: 'Island Pacific, generation depth 5',
    traits: { melanin: 62, eyeColor: 26, hairPattern: 84, noseShape: 66, lipFullness: 70, facialStructure: 72, jawLine: 60, cheekboneStructure: 68 },
  }),
  defineType({
    id: 'south-asian-18',
    name: 'South Asian Monsoon XVIII',
    code: 'GN-SA18',
    tagline: 'South Asian monsoon lineage',
    genealogyLineage: 'South Asian monsoon, generation depth 5',
    traits: { melanin: 60, eyeColor: 28, hairPattern: 86, noseShape: 56, lipFullness: 54, facialStructure: 58, jawLine: 58, cheekboneStructure: 56 },
  }),
]

export const phenotypeTypeById = Object.fromEntries(phenotypeTypes.map((type) => [type.id, type]))

const TRAIT_WEIGHTS = {
  melanin: 0.75,
  'eye-color': 0.55,
  hair: 1.2,
  nose: 1.2,
  lips: 0.65,
  facial: 1.25,
  jaw: 1.25,
  cheekbone: 1.25,
  tribe: 1.4,
}

export function traitDistance(a, b) {
  const left = typeof a.melanin === 'number' ? a : traitVectorFrom(a)
  const right = typeof b.melanin === 'number' ? b : traitVectorFrom(b)
  let sum = 0
  let weightSum = 0
  for (const id of TRAIT_IDS) {
    const key = TRAIT_KEY_BY_ID[id]
    const weight = TRAIT_WEIGHTS[id] || 1
    const delta = (Number(left?.[key]) || 0) - (Number(right?.[key]) || 0)
    sum += weight * delta * delta
    weightSum += weight
  }
  return Math.sqrt(sum / weightSum)
}

export function nearestType(traits, suggestedTypeId) {
  const vector = typeof traits.melanin === 'number' ? traits : traitVectorFrom(traits)
  let best = null
  for (const type of phenotypeTypes) {
    const distance = traitDistance(vector, type.traits)
    const candidate = { type, distance }
    if (!best || distance < best.distance) best = candidate
  }
  if (suggestedTypeId && suggestedTypeId !== best.type.id) {
    const suggested = phenotypeTypeById[suggestedTypeId]
    if (suggested) {
      const distance = traitDistance(vector, suggested.traits)
      if (distance <= best.distance + 2.5) {
        best = { type: suggested, distance }
      }
    }
  }
  const confidence = clampScore(100 - best.distance * 1.05)
  return { type: best.type, distance: Number(best.distance.toFixed(3)), confidence }
}

export function assignPhenotypeFromScan(input, { suggestedTypeId, extra, gene, source } = {}) {
  const traits = normalizeTraitVector(input, extra)
  const { type, distance, confidence } = nearestType(traits, suggestedTypeId)
  const visual = buildVisualTraits(traits)
  const tribeTrait = visual.find((trait) => trait.id === 'tribe')
  if (tribeTrait) {
    tribeTrait.detail = `${type.name} · heritage cluster from bone, hair, cartilage, and shade`
  }
  const genealogyLikelihood = Math.max(
    confidence,
    gene?.geneLinked ? Number(gene.genealogyLikelihood) || 0 : 0,
  )
  let genealogyLineage = type.genealogyLineage
  if (gene?.geneFileName) {
    genealogyLineage = genealogyLineage.includes(gene.geneFileName)
      ? gene.genealogyLineage || genealogyLineage
      : `${genealogyLineage} · linked ${gene.geneFileName}`
  }
  const assigned = {
    id: type.id,
    name: type.name,
    code: type.code,
    tagline: type.tagline,
    traits: visual,
    genealogyLikelihood,
    genealogyLineage,
    tribalMarkers: describeTribalMarkers(traits, extra, type),
    genomeReadout: buildGenomeReadout(traits, extra, type, confidence),
    scanConfidence: confidence,
    scan: {
      source: source || 'camera',
      distance,
      landmarkCount: extra?.landmarkCount || null,
    },
  }
  if (gene?.geneLinked) {
    assigned.geneLinked = true
    assigned.geneFileName = gene.geneFileName
  }
  return assigned
}

export const userPhenotype = {
  id: 'nordic-atlantic-7',
  name: 'Nordic-Atlantic VII',
  code: 'GN-NA7',
  tagline: 'North Sea lineage you can identify with',
  traits: buildVisualTraits({
    melanin: 72,
    eyeColor: 67,
    hairPattern: 55,
    noseShape: 48,
    lipFullness: 52,
    facialStructure: 61,
    jawLine: 58,
    cheekboneStructure: 64,
    tribe: 84,
  }),
  genealogyLikelihood: 78,
  genealogyLineage: 'Nordic-Atlantic, generation depth 4',
}

export const matches = [
  {
    phenotype: {
      id: 'mediterranean-3',
      name: 'Mediterranean Basin III',
      code: 'GN-MB3',
      tagline: 'Mediterranean coastal lineage',
      traits: buildVisualTraits({
        melanin: 45,
        eyeColor: 52,
        hairPattern: 68,
        noseShape: 71,
        lipFullness: 63,
        facialStructure: 74,
        jawLine: 66,
        cheekboneStructure: 59,
        tribe: 79,
      }),
      genealogyLikelihood: 91,
      genealogyLineage: 'Mediterranean basin, generation depth 6',
    },
    sharedTraits: ['Overlapping tribal markers', 'Complementary melanin range'],
    complementaryTraits: ['Adjacent genealogy clusters with compatible depth'],
    distance: '2.3 mi',
    age: 27,
    virginity: 'non-virgin',
    genealogy: 91,
  },
  {
    phenotype: {
      id: 'north-sea-12',
      name: 'North Sea Coastal XII',
      code: 'GN-NS12',
      tagline: 'Coastal Nordic lineage, strong tribal identifiers',
      traits: buildVisualTraits({
        melanin: 68,
        eyeColor: 74,
        hairPattern: 82,
        noseShape: 44,
        lipFullness: 49,
        facialStructure: 58,
        jawLine: 62,
        cheekboneStructure: 71,
        tribe: 91,
      }),
      genealogyLikelihood: 85,
      genealogyLineage: 'North Sea coastal, generation depth 5',
    },
    sharedTraits: ['Matched eye color range', 'Same genealogy cluster'],
    complementaryTraits: ['Higher tribal confidence reinforces your lineage estimate'],
    distance: '4.1 mi',
    age: 24,
    virginity: 'virgin',
    genealogy: 85,
  },
  {
    phenotype: {
      id: 'central-euro-5',
      name: 'Central European V',
      code: 'GN-CE5',
      tagline: 'Mixed Central European lineage',
      traits: buildVisualTraits({
        melanin: 81,
        eyeColor: 59,
        hairPattern: 47,
        noseShape: 55,
        lipFullness: 57,
        facialStructure: 66,
        jawLine: 53,
        cheekboneStructure: 48,
        tribe: 62,
      }),
      genealogyLikelihood: 72,
      genealogyLineage: 'Central European mixed, generation depth 3',
    },
    sharedTraits: ['Close melanin index', 'Similar facial structure'],
    complementaryTraits: ['Bridging genealogy between Atlantic and continental lines'],
    distance: '6.8 mi',
    age: 31,
    virginity: 'undisclosed',
    genealogy: 72,
  },
  {
    phenotype: {
      id: 'baltic-9',
      name: 'Baltic Fringe IX',
      code: 'GN-BF9',
      tagline: 'Baltic fringe lineage — light features, high cheekbones',
      traits: buildVisualTraits({
        melanin: 33,
        eyeColor: 93,
        hairPattern: 56,
        noseShape: 62,
        lipFullness: 41,
        facialStructure: 71,
        jawLine: 77,
        cheekboneStructure: 83,
        tribe: 88,
      }),
      genealogyLikelihood: 63,
      genealogyLineage: 'Baltic fringe, generation depth 7',
    },
    sharedTraits: ['Strong tribal overlap', 'Rare eye color lattice match'],
    complementaryTraits: ['Deeper generation depth extends your lineage tree'],
    distance: '8.2 mi',
    age: 29,
    virginity: 'non-virgin',
    genealogy: 63,
  },
  {
    phenotype: {
      ...phenotypeTypeById['west-african-11'],
      traits: buildVisualTraits(phenotypeTypeById['west-african-11'].traits),
      genealogyLikelihood: 70,
    },
    sharedTraits: ['Overlapping melanin cluster', 'Shared tribal markers'],
    complementaryTraits: ['Adjacent gulf cluster with compatible depth'],
    distance: '5.4 mi',
    age: 34,
    virginity: 'non-virgin',
    genealogy: 70,
  },
  {
    phenotype: {
      ...phenotypeTypeById['east-asian-16'],
      traits: buildVisualTraits(phenotypeTypeById['east-asian-16'].traits),
      genealogyLikelihood: 74,
    },
    sharedTraits: ['Close facial index', 'Dark hair cluster'],
    complementaryTraits: ['Continental cluster adjacent to your type'],
    distance: '7.1 mi',
    age: 36,
    virginity: 'undisclosed',
    genealogy: 74,
  },
  {
    phenotype: {
      ...phenotypeTypeById['levantine-8'],
      traits: buildVisualTraits(phenotypeTypeById['levantine-8'].traits),
      genealogyLikelihood: 68,
    },
    sharedTraits: ['Warm melanin overlap', 'Nasal identifier cluster'],
    complementaryTraits: ['Corridor cluster with compatible tribal markers'],
    distance: '9.0 mi',
    age: 38,
    virginity: 'non-virgin',
    genealogy: 68,
  },
  {
    phenotype: {
      ...phenotypeTypeById['andean-14'],
      traits: buildVisualTraits(phenotypeTypeById['andean-14'].traits),
      genealogyLikelihood: 66,
    },
    sharedTraits: ['High zygomatic relief', 'Mid melanin cluster'],
    complementaryTraits: ['Highland cluster with distinct tribal markers'],
    distance: '11.2 mi',
    age: 41,
    virginity: 'non-virgin',
    genealogy: 66,
  },
]

export const filterOptions = {
  virginity: ['any', 'virgin', 'non-virgin', 'undisclosed'],
  genealogy: [
    { label: 'Any', min: 0 },
    { label: '60%+', min: 60 },
    { label: '70%+', min: 70 },
    { label: '80%+', min: 80 },
    { label: '90%+', min: 90 },
  ],
  age: [
    { label: '18–24', min: 18, max: 24 },
    { label: '25–30', min: 25, max: 30 },
    { label: '31–40', min: 31, max: 40 },
    { label: 'Any age', min: 18, max: 99 },
  ],
}

export const ageRangeOptions = filterOptions.age
export const genealogyOptions = filterOptions.genealogy

export const scanSteps = [
  'Opening camera…',
  'Loading optical pipeline…',
  'Finding a face…',
  'Measuring bone spacing…',
  'Scoring hair thickness…',
  'Measuring cartilage length…',
  'Reading feature shade…',
  'Inferring tribal identifiers…',
  'Assigning heritage type…',
  'Saving cluster profile…',
]
