import { useState } from 'react'
import type { Phenotype } from '../types'
import { ScanPanel } from './ScanPanel'
import { PhenotypeTraits } from './PhenotypeTraits'

type Props = {
  phenotype: Phenotype
  hasProfile: boolean
  onScanComplete: (phenotype: Phenotype) => void
}

export function PhenoView({ phenotype, hasProfile, onScanComplete }: Props) {
  const [scanning, setScanning] = useState(false)

  const startScan = () => setScanning(true)

  const handleScanComplete = (result: Phenotype) => {
    setScanning(false)
    onScanComplete(result)
  }

  return (
    <section className="pheno">
      <header className="pheno__page-header">
        <h2 className="pheno__page-title">Pheno</h2>
      </header>

      {!hasProfile && !scanning && (
        <div className="pheno__intro">
          <p className="pheno__intro-copy">
            Scan visible identifiers on this Mac — melanin, eye color, facial
            structure, and tribe — then the cloud matching API estimates your
            genealogy cluster.
          </p>
          <button type="button" className="btn btn--outline" onClick={startScan}>
            Scan phenotype
          </button>
        </div>
      )}

      {scanning && <ScanPanel onComplete={handleScanComplete} />}

      {hasProfile && !scanning && (
        <>
          <div className="pheno__identity-card">
            <div className="pheno__avatar">
              <span className="pheno__avatar-code">{phenotype.code}</span>
            </div>
            <div className="pheno__identity">
              <h3 className="pheno__name">{phenotype.name}</h3>
              <p className="pheno__tagline">{phenotype.tagline}</p>
            </div>
          </div>

          <div className="pheno__card">
            <h3 className="pheno__section-title">Genealogy likelihood</h3>
            <div className="genealogy-score">
              <span className="genealogy-score__value">{phenotype.genealogyLikelihood}%</span>
              <div className="genealogy-score__bar">
                <div
                  className="genealogy-score__fill"
                  style={{ width: `${phenotype.genealogyLikelihood}%` }}
                />
              </div>
            </div>
            <p className="genealogy-score__lineage">{phenotype.genealogyLineage}</p>
          </div>

          <div className="pheno__card">
            <h3 className="pheno__section-title">Visual traits</h3>
            <PhenotypeTraits traits={phenotype.traits} />
          </div>

          <div className="pheno__card">
            <h3 className="pheno__section-title">Genealogy cluster</h3>
            <p className="pheno__insight">
              Matching is based on genealogy, not a named phenotype type. Your
              visual traits — including tribal markers — place you in the{' '}
              {phenotype.name} cluster at {phenotype.genealogyLikelihood}%
              likelihood. Compatible matches share lineage overlap and tribal
              identification.
            </p>
          </div>

          <button type="button" className="btn btn--outline" onClick={startScan}>
            Rescan phenotype
          </button>
        </>
      )}
    </section>
  )
}
