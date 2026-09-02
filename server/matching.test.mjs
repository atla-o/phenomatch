import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyMatchFilters, queryMatches, clusterScore } from './matching.mjs'
import { matches, userPhenotype } from './catalog.mjs'

describe('applyMatchFilters', () => {
  it('filters by virginity', () => {
    const virgin = applyMatchFilters(matches, { virginity: 'virgin' })
    assert.equal(virgin.length, 1)
    assert.equal(virgin[0].phenotype.id, 'north-sea-12')
  })

  it('filters by genealogy minimum', () => {
    const high = applyMatchFilters(matches, { genealogyMin: 90 })
    assert.equal(high.length, 1)
    assert.equal(high[0].genealogy, 91)
  })

  it('filters by age range', () => {
    const young = applyMatchFilters(matches, { ageMin: 18, ageMax: 24 })
    assert.equal(young.length, 1)
    assert.equal(young[0].age, 24)
  })

  it('combines virginity, genealogy, and age', () => {
    const result = applyMatchFilters(matches, {
      virginity: 'non-virgin',
      genealogyMin: 80,
      ageMin: 25,
      ageMax: 30,
    })
    assert.equal(result.length, 1)
    assert.equal(result[0].phenotype.id, 'mediterranean-3')
  })

  it('returns none when filters exclude everyone', () => {
    const result = applyMatchFilters(matches, {
      virginity: 'virgin',
      genealogyMin: 90,
      ageMin: 40,
      ageMax: 45,
    })
    assert.equal(result.length, 0)
  })
})

describe('cluster ranking', () => {
  it('scores visual traits, tribe, and genealogy', () => {
    const northSea = matches.find((m) => m.phenotype.id === 'north-sea-12')
    const baltic = matches.find((m) => m.phenotype.id === 'baltic-9')
    assert.ok(clusterScore(userPhenotype, northSea) > clusterScore(userPhenotype, baltic))
  })

  it('returns ranked matches after filters', () => {
    const ranked = queryMatches(userPhenotype, matches, { virginity: 'any', genealogyMin: 0, ageMin: 18, ageMax: 99 })
    assert.equal(ranked.length, matches.length)
    const scores = ranked.map((m) => m.compatibility)
    const sorted = [...scores].sort((a, b) => b - a)
    assert.deepEqual(scores, sorted)
  })
})
