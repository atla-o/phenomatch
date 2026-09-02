import { useMemo, useState } from 'react'
import type { Match, MatchFilters } from '../types'
import { defaultMatchFilters } from '../types'
import { ageRangeOptions, genealogyOptions } from '../data/mock'
import { CompatibilityRing } from './CompatibilityRing'
import { PhenotypeTraits } from './PhenotypeTraits'

type Props = {
  matches: Match[]
  hasProfile: boolean
}

function filterMatches(matches: Match[], filters: MatchFilters): Match[] {
  return matches.filter((m) => {
    if (filters.virginity !== 'any' && m.virginity !== filters.virginity) return false
    if (m.genealogy < filters.genealogyMin) return false
    if (m.age < filters.ageMin || m.age > filters.ageMax) return false
    return true
  })
}

const virginityLabels: Record<MatchFilters['virginity'], string> = {
  any: 'Any',
  virgin: 'Virgin',
  'non-virgin': 'Non-virgin',
  undisclosed: 'Undisclosed',
}

export function MatchView({ matches, hasProfile }: Props) {
  const [filters, setFilters] = useState<MatchFilters>(defaultMatchFilters)
  const [activeIndex, setActiveIndex] = useState(0)
  const [direction, setDirection] = useState<'left' | 'right' | null>(null)

  const filtered = useMemo(() => filterMatches(matches, filters), [matches, filters])

  const safeIndex = filtered.length > 0 ? activeIndex % filtered.length : 0
  const match = filtered[safeIndex]

  const updateFilters = (patch: Partial<MatchFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setActiveIndex(0)
  }

  if (!hasProfile) {
    return (
      <section className="match">
        <header className="match__page-header">
          <h2 className="match__page-title">Match</h2>
        </header>
        <div className="match__empty">
          <p>Complete your phenotype scan in Pheno to unlock matches.</p>
        </div>
      </section>
    )
  }

  const goNext = (dir: 'left' | 'right') => {
    if (filtered.length === 0) return
    setDirection(dir)
    setTimeout(() => {
      setActiveIndex((i) => (i + 1) % filtered.length)
      setDirection(null)
    }, 280)
  }

  return (
    <section className="match">
      <header className="match__page-header">
        <h2 className="match__page-title">Match</h2>
        <p className="match__subtitle">
          {filtered.length} of {matches.length} matches
        </p>
      </header>

      <div className="match__filters">
        <h3 className="match__filters-title">Filters</h3>

        <div className="filter-group">
          <span className="filter-group__label">Virginity</span>
          <div className="filter-group__options" role="group" aria-label="Virginity filter">
            {(['any', 'virgin', 'non-virgin', 'undisclosed'] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`filter-option${filters.virginity === v ? ' filter-option--active' : ''}`}
                onClick={() => updateFilters({ virginity: v })}
              >
                {virginityLabels[v]}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-group__label">Genealogy</span>
          <div className="filter-group__options" role="group" aria-label="Genealogy filter">
            {genealogyOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                className={`filter-option${filters.genealogyMin === opt.min ? ' filter-option--active' : ''}`}
                onClick={() => updateFilters({ genealogyMin: opt.min })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-group__label">Age</span>
          <div className="filter-group__options" role="group" aria-label="Age filter">
            {ageRangeOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                className={`filter-option${filters.ageMin === opt.min && filters.ageMax === opt.max ? ' filter-option--active' : ''}`}
                onClick={() => updateFilters({ ageMin: opt.min, ageMax: opt.max })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="match__empty">
          <p>No matches fit your current filters. Try adjusting your selection.</p>
        </div>
      ) : (
        <>
          <ul className="match__list" aria-label="Matches">
            {filtered.map((m, i) => (
              <li key={m.phenotype.id}>
                <button
                  type="button"
                  className={`match__list-item${i === safeIndex ? ' match__list-item--active' : ''}`}
                  onClick={() => setActiveIndex(i)}
                >
                  <span className="match__list-code">{m.phenotype.code}</span>
                  <span className="match__list-name">{m.phenotype.name}</span>
                  <span className="match__list-meta">{m.age} · {m.genealogy}%</span>
                  <span className="match__list-score">{m.compatibility}%</span>
                </button>
              </li>
            ))}
          </ul>

          {match && (
            <div
              className={`match-card${direction ? ` match-card--exit-${direction}` : ''}`}
              key={match.phenotype.id}
            >
              <div className="match-card__top">
                <div className="match-card__avatar">
                  <span>{match.phenotype.code}</span>
                </div>
                <CompatibilityRing value={match.compatibility} />
              </div>

              <div className="match-card__info">
                <h3 className="match-card__name">{match.phenotype.name}</h3>
                <p className="match-card__tagline">{match.phenotype.tagline}</p>
                <div className="match-card__meta">
                  <span>{match.age} yrs</span>
                  <span>{match.distance} away</span>
                  <span>Genealogy {match.genealogy}%</span>
                  <span>{match.phenotype.genealogyLineage}</span>
                  <span>{virginityLabels[match.virginity]}</span>
                </div>
              </div>

              <div className="match-card__compat">
                <div className="compat-block">
                  <h4>Shared traits</h4>
                  <ul>
                    {match.sharedTraits.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
                <div className="compat-block">
                  <h4>Complementary</h4>
                  <ul>
                    {match.complementaryTraits.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <details className="match-card__traits">
                <summary>Full trait breakdown</summary>
                <PhenotypeTraits traits={match.phenotype.traits} compact />
              </details>
            </div>
          )}

          <div className="match__actions">
            <button
              type="button"
              className="match-action match-action--pass"
              onClick={() => goNext('left')}
              aria-label="Pass on match"
            >
              ✕
            </button>
            <button
              type="button"
              className="match-action match-action--like"
              onClick={() => goNext('right')}
              aria-label="Like match"
            >
              ♡
            </button>
          </div>
        </>
      )}
    </section>
  )
}
