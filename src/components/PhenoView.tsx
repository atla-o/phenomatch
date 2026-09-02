import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Phenotype } from '../types'
import { uploadGene } from '../api/client'
import { ScanPanel } from './ScanPanel'
import { PhenotypeTraits } from './PhenotypeTraits'

type Props = {
  phenotype: Phenotype
  hasProfile: boolean
  onScanComplete: (phenotype: Phenotype) => void
  onGeneLinked: (phenotype: Phenotype) => void
}

export function PhenoView({ phenotype, hasProfile, onScanComplete, onGeneLinked }: Props) {
  const [scanning, setScanning] = useState(false)
  const [geneBusy, setGeneBusy] = useState(false)
  const [geneError, setGeneError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const startScan = () => setScanning(true)

  const handleScanComplete = (result: Phenotype) => {
    setScanning(false)
    onScanComplete({
      ...result,
      geneLinked: result.geneLinked || phenotype.geneLinked,
      geneFileName: result.geneFileName || phenotype.geneFileName,
      genealogyLineage:
        result.geneFileName || !phenotype.geneFileName
          ? result.genealogyLineage
          : phenotype.genealogyLineage,
      genealogyLikelihood: Math.max(result.genealogyLikelihood, phenotype.genealogyLikelihood),
    })
  }

  const onGeneFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setGeneBusy(true)
    setGeneError(null)
    try {
      const next = await uploadGene(file)
      onGeneLinked(next)
    } catch {
      setGeneError('Could not link that gene file.')
    } finally {
      setGeneBusy(false)
    }
  }

  const geneControl = (
    <div className="pheno__gene">
      <input
        ref={fileRef}
        className="pheno__gene-input"
        type="file"
        accept=".vcf,.ged,.gedcom,.txt,.csv,.fasta,.fa"
        onChange={(event) => void onGeneFile(event)}
      />
      <button
        type="button"
        className="btn btn--outline"
        disabled={geneBusy}
        onClick={() => fileRef.current?.click()}
      >
        {geneBusy ? 'Linking genealogy…' : 'Upload gene'}
      </button>
      <p className="pheno__gene-hint">
        Link a genealogy or genotype file (VCF, GEDCOM, or similar) to your cluster.
      </p>
      {phenotype.geneLinked && phenotype.geneFileName && (
        <p className="pheno__gene-linked">Genealogy linked · {phenotype.geneFileName}</p>
      )}
      {geneError && <p className="pheno__gene-error">{geneError}</p>}
    </div>
  )

  return (
    <section className="pheno">
      {!hasProfile && !scanning && (
        <div className="pheno__intro">
          <p className="pheno__intro-copy">
            Scan visible identifiers on this Mac — melanin, eye color, facial
            structure, and tribe — then the matching API estimates your
            genealogy cluster. Upload a gene file to link genealogy.
          </p>
          <button type="button" className="btn btn--outline" onClick={startScan}>
            Scan phenotype
          </button>
          {geneControl}
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

          <div className="pheno__card">
            <h3 className="pheno__section-title">Upload gene</h3>
            {geneControl}
          </div>

          <button type="button" className="btn btn--outline" onClick={startScan}>
            Rescan type
          </button>
        </>
      )}
    </section>
  )
}
