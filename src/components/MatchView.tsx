import { useEffect, useState } from 'react'
import type { Match, MatchCategory, MatchFilters, Phenotype } from '../types'
import { defaultMatchFilters } from '../types'
import { ageRangeOptions, genealogyOptions } from '../data/mock'
import { fetchMatches } from '../api/client'
import { CompatibilityRing } from './CompatibilityRing'
import { PhenotypeTraits, traitsWithGenealogy } from './PhenotypeTraits'
import { AnonymousMatch } from './AnonymousMatch'

type Props = {
  hasProfile: boolean
  phenotype: Phenotype
}

const categories: { id: MatchCategory; label: string }[] = [
  { id: 'data', label: 'Data' },
  { id: 'anonymous', label: 'Anon' },
]

const virginityLabels: Record<MatchFilters['virginity'], string> = {
  any: 'Any',
  virgin: 'Virgin',
  'non-virgin': 'Non-virgin',
  undisclosed: 'Undisclosed',
}

export function MatchView({ hasProfile, phenotype }: Props) {
  const [category, setCategory] = useState<MatchCategory>('data')

  return (
    <section className="match">
      <div className="match__categories" role="tablist" aria-label="Match category">
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={category === item.id}
            className={`match__category${category === item.id ? ' match__category--active' : ''}`}
            onClick={() => setCategory(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {category === 'anonymous' ? (
        <AnonymousMatch phenotype={phenotype} hasProfile={hasProfile} />
      ) : (
        <DataMatch hasProfile={hasProfile} />
      )}
    </section>
  )
}

function ClusterFilters({
  filters,
  updateFilters,
}: {
  filters: MatchFilters
  updateFilters: (patch: Partial<MatchFilters>) => void
}) {
  return (
    <details className="match__filters">
      <summary className="match__filters-title">Filters</summary>

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
    </details>
  )
}

function DataMatch({ hasProfile }: { hasProfile: boolean }) {
  const [filters, setFilters] = useState<MatchFilters>(defaultMatchFilters)
  const [matches, setMatches] = useState<Match[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [direction, setDirection] = useState<'left' | 'right' | null>(null)

  useEffect(() => {
    if (!hasProfile) return
    let cancelled = false
    setLoading(true)
    void fetchMatches(filters).then((result) => {
      if (cancelled) return
      setMatches(result.matches)
      setTotal(result.total)
      setActiveIndex(0)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [filters, hasProfile])

  const safeIndex = matches.length > 0 ? activeIndex % matches.length : 0
  const match = matches[safeIndex]

  const updateFilters = (patch: Partial<MatchFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
  }

  if (!hasProfile) {
    return (
      <div className="match__empty">
        <p>Complete your phenotype scan in Pheno to unlock data matches.</p>
      </div>
    )
  }

  const goNext = (dir: 'left' | 'right') => {
    if (matches.length === 0) return
    setDirection(dir)
    setTimeout(() => {
      setActiveIndex((i) => (i + 1) % matches.length)
      setDirection(null)
    }, 280)
  }

  const swipe = (
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
  )

  if (loading) {
    return (
      <>
        <p className="match__subtitle">Loading matches…</p>
        {swipe}
        <ClusterFilters filters={filters} updateFilters={updateFilters} />
      </>
    )
  }

  if (matches.length === 0) {
    return (
      <>
        <div className="match__empty">
          <p>No matches fit your current filters. Try adjusting your selection.</p>
        </div>
        {swipe}
        <ClusterFilters filters={filters} updateFilters={updateFilters} />
      </>
    )
  }

  return (
    <>
      <p className="match__subtitle">{matches.length} of {total} matches</p>

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
              {match.age != null && <span>{match.age} yrs</span>}
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
            <PhenotypeTraits traits={traitsWithGenealogy(match.phenotype)} compact />
          </details>
        </div>
      )}

      {swipe}

      <ClusterFilters filters={filters} updateFilters={updateFilters} />

      <ul className="match__list" aria-label="Data matches">
        {matches.map((m, i) => (
          <li key={m.phenotype.id}>
            <button
              type="button"
              className={`match__list-item${i === safeIndex ? ' match__list-item--active' : ''}`}
              onClick={() => setActiveIndex(i)}
            >
              <span className="match__list-code">{m.phenotype.code}</span>
              <span className="match__list-name">{m.phenotype.name}</span>
              <span className="match__list-meta">{m.age != null ? `${m.age} · ` : ''}{m.genealogy}%</span>
              <span className="match__list-score">{m.compatibility}%</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
