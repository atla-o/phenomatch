import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Phenotype } from '../types'
import { uploadGene } from '../api/client'
import { ScanPanel } from './ScanPanel'
import { PhenotypeTraits, visualTraits } from './PhenotypeTraits'

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

  return (
    <section className="pheno">
      <input
        ref={fileRef}
        className="pheno__gene-input"
        type="file"
        accept=".vcf,.ged,.gedcom,.txt,.csv,.fasta,.fa"
        onChange={(event) => void onGeneFile(event)}
      />
      <div className="pheno__actions" role="toolbar" aria-label="Pheno actions">
        <button
          type="button"
          className={`pheno__action${geneBusy ? ' pheno__action--active' : ''}`}
          disabled={geneBusy}
          onClick={() => fileRef.current?.click()}
        >
          {geneBusy ? 'Linking…' : 'Upload gene'}
        </button>
        <button
          type="button"
          className={`pheno__action${scanning ? ' pheno__action--active' : ''}`}
          disabled={scanning}
          onClick={startScan}
        >
          Rescan type
        </button>
      </div>

      {phenotype.geneLinked && phenotype.geneFileName && (
        <p className="pheno__gene-linked">Genealogy linked · {phenotype.geneFileName}</p>
      )}
      {geneError && <p className="pheno__gene-error">{geneError}</p>}

      {!hasProfile && !scanning && (
        <div className="pheno__intro">
          <p className="pheno__intro-copy">
            Scan visible identifiers on this Mac — melanin, eye color, facial
            structure, tribe, and genealogy likelihood. Upload a gene file to
            link genealogy.
          </p>
        </div>
      )}

      {scanning && <ScanPanel onComplete={handleScanComplete} />}

      {hasProfile && !scanning && (
        <>
          <div className="pheno__card">
            <h3 className="pheno__section-title">Visual traits</h3>
            <PhenotypeTraits traits={visualTraits(phenotype)} />
          </div>
        </>
      )}
    </section>
  )
}
