import type { Phenotype, Trait } from '../types'

type Props = {
  traits: Trait[]
  compact?: boolean
}

export function traitsWithGenealogy(phenotype: Phenotype): Trait[] {
  return [
    ...phenotype.traits.filter((trait) => trait.id !== 'genealogy'),
    {
      id: 'genealogy',
      label: 'Genealogy Likelihood',
      value: phenotype.genealogyLikelihood,
      category: 'physical',
      detail: phenotype.genealogyLineage,
    },
  ]
}

export function PhenotypeTraits({ traits, compact = false }: Props) {
  return (
    <ul className={`trait-list${compact ? ' trait-list--compact' : ''}`}>
      {traits.map((trait) => (
        <li key={trait.id} className="trait-item">
          <div className="trait-item__header">
            <span className="trait-item__label">{trait.label}</span>
            <span className="trait-item__value">{trait.value}%</span>
          </div>
          <div className="trait-item__bar">
            <div
              className={`trait-item__fill trait-item__fill--${trait.category}`}
              style={{ width: `${trait.value}%` }}
            />
          </div>
          {!compact && trait.detail && (
            <span className="trait-item__detail">{trait.detail}</span>
          )}
          {!compact && !trait.detail && (
            <span className="trait-item__category">{trait.category}</span>
          )}
        </li>
      ))}
    </ul>
  )
}
