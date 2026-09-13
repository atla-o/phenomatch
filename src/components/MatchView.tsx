import { useEffect, useState } from 'react'
import type { Match, MatchCategory, MatchFilters, Phenotype } from '../types'
import { defaultMatchFilters } from '../types'
import { ageRangeOptions, genealogyOptions } from '../data/mock'
import { fetchMatches } from '../api/client'
import { loadLikes, loadPassedIds, saveLikes, savePassedIds } from '../storage'
import { CompatibilityRing } from './CompatibilityRing'
import { PhenotypeTraits, visualTraits } from './PhenotypeTraits'
import { AnonymousMatch } from './AnonymousMatch'

type Props = {
  hasProfile: boolean
  phenotype: Phenotype
  category: MatchCategory
  onCategoryChange: (category: MatchCategory) => void
  onGoPheno: () => void
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

export function MatchView({
  hasProfile,
  phenotype,
  category,
  onCategoryChange,
  onGoPheno,
}: Props) {
  return (
    <section className="match" aria-label="Match">
      <div className="match__categories" role="tablist" aria-label="Match category">
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={category === item.id}
            className={`match__category${category === item.id ? ' match__category--active' : ''}`}
            onClick={() => onCategoryChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {category === 'anonymous' ? (
        <AnonymousMatch
          phenotype={phenotype}
          hasProfile={hasProfile}
          onGoPheno={onGoPheno}
        />
      ) : (
        <DataMatch hasProfile={hasProfile} phenotype={phenotype} onGoPheno={onGoPheno} />
      )}
    </section>
  )
}

function ClusterFilters({
  filters,
  updateFilters,
  onReset,
}: {
  filters: MatchFilters
  updateFilters: (patch: Partial<MatchFilters>) => void
  onReset: () => void
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

      <button type="button" className="match__reset" onClick={onReset}>
        Reset filters
      </button>
    </details>
  )
}

function DataMatch({
  hasProfile,
  phenotype,
  onGoPheno,
}: {
  hasProfile: boolean
  phenotype: Phenotype
  onGoPheno: () => void
}) {
  const [filters, setFilters] = useState<MatchFilters>(defaultMatchFilters)
  const [matches, setMatches] = useState<Match[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [direction, setDirection] = useState<'left' | 'right' | null>(null)
  const [liked, setLiked] = useState<Match[]>(loadLikes)
  const [passedIds, setPassedIds] = useState<string[]>(loadPassedIds)
  const [flash, setFlash] = useState<string | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)

  useEffect(() => {
    saveLikes(liked)
  }, [liked])

  useEffect(() => {
    savePassedIds(passedIds)
  }, [passedIds])

  useEffect(() => {
    if (!hasProfile) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchMatches(filters, phenotype)
      .then((result) => {
        if (cancelled) return
        setMatches(result.matches)
        setTotal(result.total)
        setOffline(result.source === 'client-fallback')
        setPickedId(null)
      })
      .catch(() => {
        if (cancelled) return
        setError('Could not load matches.')
        setMatches([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [filters, hasProfile, phenotype, reloadKey])

  const hidden = new Set([...passedIds, ...liked.map((m) => m.phenotype.id)])
  const deck = matches.filter((m) => !hidden.has(m.phenotype.id))
  const match = deck.find((m) => m.phenotype.id === pickedId) ?? deck[0]

  const updateFilters = (patch: Partial<MatchFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
  }

  if (!hasProfile) {
    return (
      <div className="match__empty">
        <p>Scan your type in Pheno to unlock data matches.</p>
        <button type="button" className="btn btn--outline" onClick={onGoPheno}>
          Scan in Pheno
        </button>
      </div>
    )
  }

  const resolve = (dir: 'left' | 'right', action: 'like' | 'pass') => {
    if (!match || direction) return
    setDirection(dir)
    window.setTimeout(() => {
      if (action === 'like') {
        setLiked((prev) =>
          prev.some((item) => item.phenotype.id === match.phenotype.id)
            ? prev
            : [...prev, match],
        )
        setFlash(`Saved · ${match.phenotype.name}`)
      } else {
        setPassedIds((prev) =>
          prev.includes(match.phenotype.id) ? prev : [...prev, match.phenotype.id],
        )
      }
      setPickedId(null)
      setDirection(null)
    }, 280)
  }

  const swipe = (
    <div className="match__actions">
      <button
        type="button"
        className="match-action match-action--pass"
        onClick={() => resolve('left', 'pass')}
        disabled={!match || Boolean(direction)}
        aria-label="Pass on match"
      >
        ✕
      </button>
      <button
        type="button"
        className="match-action match-action--like"
        onClick={() => resolve('right', 'like')}
        disabled={!match || Boolean(direction)}
        aria-label="Save match"
      >
        ♡
      </button>
    </div>
  )

  const filtersPanel = (
    <ClusterFilters
      filters={filters}
      updateFilters={updateFilters}
      onReset={() => setFilters(defaultMatchFilters)}
    />
  )

  if (loading) {
    return (
      <>
        <p className="match__subtitle">Loading matches…</p>
        {filtersPanel}
      </>
    )
  }

  if (error) {
    return (
      <div className="match__empty">
        <p>{error}</p>
        <button
          type="button"
          className="btn btn--outline"
          onClick={() => setReloadKey((n) => n + 1)}
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <>
      <p className="match__subtitle">
        {deck.length} of {total} remaining
        {liked.length > 0 ? ` · ${liked.length} saved` : ''}
      </p>

      {offline && (
        <p className="status-note" role="status">
          Matching API unreachable. Showing the local catalog.
        </p>
      )}
      {flash && (
        <p className="status-note status-note--ok" role="status">
          {flash}
        </p>
      )}

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
            <PhenotypeTraits traits={visualTraits(match.phenotype)} compact />
          </details>
        </div>
      )}

      {!match && (
        <div className="match__empty">
          <p>
            {matches.length === 0
              ? 'No matches fit your current filters. Try adjusting your selection.'
              : 'You have gone through this set. Reset the deck or change filters.'}
          </p>
          {matches.length === 0 ? (
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => setFilters(defaultMatchFilters)}
            >
              Reset filters
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => {
                setPassedIds([])
                setPickedId(null)
              }}
            >
              Show again
            </button>
          )}
        </div>
      )}

      {swipe}
      {filtersPanel}

      {deck.length > 0 && (
        <ul className="match__list" aria-label="Data matches">
          {deck.map((m) => (
            <li key={m.phenotype.id}>
              <button
                type="button"
                className={`match__list-item${m.phenotype.id === match?.phenotype.id ? ' match__list-item--active' : ''}`}
                onClick={() => setPickedId(m.phenotype.id)}
              >
                <span className="match__list-code">{m.phenotype.code}</span>
                <span className="match__list-name">{m.phenotype.name}</span>
                <span className="match__list-meta">
                  {m.age != null ? `${m.age} · ` : ''}
                  {m.genealogy}%
                </span>
                <span className="match__list-score">{m.compatibility}%</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {liked.length > 0 && (
        <div className="match__saved">
          <h3 className="match__saved-title">Saved</h3>
          <ul className="match__list" aria-label="Saved matches">
            {liked.map((m) => (
              <li key={m.phenotype.id} className="match__list-item match__list-item--static">
                <span className="match__list-code">{m.phenotype.code}</span>
                <span className="match__list-name">{m.phenotype.name}</span>
                <span className="match__list-meta">{m.compatibility}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
