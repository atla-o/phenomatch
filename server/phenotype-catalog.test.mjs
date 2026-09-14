import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assignPhenotypeFromScan,
  hasAnalyzedTraits,
  nearestType,
  phenotypeTypes,
  traitDistance,
} from '../shared/phenotype-catalog.mjs'
import { tribeScoreFromTraits } from '../shared/face-traits.mjs'

describe('phenotype catalog', () => {
  it('has enough types for distinct real faces', () => {
    assert.ok(phenotypeTypes.length >= 16)
    const ids = new Set(phenotypeTypes.map((type) => type.id))
    assert.equal(ids.size, phenotypeTypes.length)
    for (const type of phenotypeTypes) {
      assert.ok(type.code)
      assert.ok(type.tagline)
      assert.match(type.tagline, /lineage/i)
      assert.ok(type.genealogyLineage)
      assert.equal(typeof type.traits.tribe, 'number')
      assert.equal(type.traits.tribe, tribeScoreFromTraits(type.traits))
    }
  })

  it('maps two different trait vectors to different types', () => {
    const fair = nearestType({
      melanin: 24,
      eyeColor: 88,
      hairPattern: 28,
      noseShape: 30,
      lipFullness: 34,
      facialStructure: 50,
      jawLine: 68,
      cheekboneStructure: 82,
      tribe: tribeScoreFromTraits({
        melanin: 24,
        eyeColor: 88,
        hairPattern: 28,
        noseShape: 30,
        lipFullness: 34,
        facialStructure: 50,
        jawLine: 68,
        cheekboneStructure: 82,
      }),
    })
    const deep = nearestType({
      melanin: 88,
      eyeColor: 14,
      hairPattern: 90,
      noseShape: 80,
      lipFullness: 84,
      facialStructure: 66,
      jawLine: 56,
      cheekboneStructure: 50,
      tribe: tribeScoreFromTraits({
        melanin: 88,
        eyeColor: 14,
        hairPattern: 90,
        noseShape: 80,
        lipFullness: 84,
        facialStructure: 66,
        jawLine: 56,
        cheekboneStructure: 50,
      }),
    })
    assert.notEqual(fair.type.id, deep.type.id)
    assert.ok(fair.distance < traitDistance(fair.type.traits, deep.type.traits))
    assert.match(fair.type.id, /baltic|nordic|north-sea/)
    assert.match(deep.type.id, /west-african|sahel|nile/)
  })

  it('uses tribe in nearest-type ranking', () => {
    const base = {
      melanin: 48,
      eyeColor: 42,
      hairPattern: 72,
      noseShape: 58,
      lipFullness: 58,
      facialStructure: 62,
      jawLine: 60,
      cheekboneStructure: 58,
    }
    const withTribe = { ...base, tribe: tribeScoreFromTraits(base) }
    const matched = nearestType(withTribe)
    assert.equal(matched.type.id, 'mediterranean-3')
    const farTribe = { ...withTribe, tribe: 0 }
    assert.ok(traitDistance(farTribe, matched.type.traits) > traitDistance(withTribe, matched.type.traits))
  })

  it('assignPhenotypeFromScan writes type, traits, and tribal markers', () => {
    const phenotype = assignPhenotypeFromScan({
      melanin: 86,
      eyeColor: 16,
      hairPattern: 88,
      noseShape: 78,
      lipFullness: 82,
      facialStructure: 64,
      jawLine: 58,
      cheekboneStructure: 52,
    })
    assert.equal(phenotype.id, 'west-african-11')
    assert.equal(phenotype.code, 'GN-WG11')
    const tribe = phenotype.traits.find((trait) => trait.id === 'tribe')
    assert.ok(tribe?.value)
    assert.match(String(tribe.detail), /heritage cluster/)
    assert.ok(phenotype.tribalMarkers.some((marker) => marker.id === 'tribe'))
    assert.equal(hasAnalyzedTraits(phenotype.traits), true)
    assert.equal(phenotype.genomeReadout?.headline, 'West African Gulf XI')
    assert.match(phenotype.genomeReadout?.note || '', /Guessed from this face/)
    assert.match(phenotype.genomeReadout?.note || '', /Not measured alleles/)
    assert.ok(phenotype.genomeReadout?.markers.some((marker) => marker.id === 'PM-TRIBE-01'))
    const again = assignPhenotypeFromScan({
      melanin: 86,
      eyeColor: 16,
      hairPattern: 88,
      noseShape: 78,
      lipFullness: 82,
      facialStructure: 64,
      jawLine: 58,
      cheekboneStructure: 52,
    })
    assert.deepEqual(again.genomeReadout, phenotype.genomeReadout)
  })
})
