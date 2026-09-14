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
  onGoMatch: () => void
}

export function PhenoView({
  phenotype,
  hasProfile,
  onScanComplete,
  onGeneLinked,
  onGoMatch,
}: Props) {
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [justScanned, setJustScanned] = useState(false)
  const [geneBusy, setGeneBusy] = useState(false)
  const [geneError, setGeneError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const startScan = () => {
    setScanError(null)
    setJustScanned(false)
    setScanning(true)
  }

  const handleScanComplete = (result: Phenotype) => {
    setScanning(false)
    setJustScanned(true)
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

  const handleScanFail = (message: string) => {
    setScanning(false)
    setScanError(message)
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
    <section className="pheno" aria-label="Pheno">
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
          disabled={geneBusy || scanning}
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
          {scanning ? 'Scanning…' : hasProfile ? 'Rescan type' : 'Scan type'}
        </button>
      </div>

      {phenotype.geneLinked && phenotype.geneFileName && (
        <p className="status-note status-note--ok" role="status">
          Genealogy linked · {phenotype.geneFileName}
        </p>
      )}
      {geneError && (
        <p className="status-note status-note--error" role="alert">
          {geneError}
        </p>
      )}
      {scanError && (
        <p className="status-note status-note--error" role="alert">
          {scanError}
        </p>
      )}
      {justScanned && hasProfile && !scanning && (
        <p className="status-note status-note--ok" role="status">
          Profile ready. Match is unlocked.
        </p>
      )}

      {!hasProfile && !scanning && (
        <div className="pheno__intro">
          <p className="pheno__intro-copy">
            Scan visible identifiers — melanin, eye color, facial structure, tribe,
            and genealogy likelihood. Scores are cluster similarity, not a medical
            reading. Upload a gene file to link genealogy.
          </p>
          <button type="button" className="btn btn--outline" onClick={startScan}>
            Scan type
          </button>
        </div>
      )}

      {scanning && <ScanPanel onComplete={handleScanComplete} onFail={handleScanFail} />}

      {hasProfile && !scanning && (
        <>
          <div className="pheno__card">
            <h3 className="pheno__section-title">Visual traits</h3>
            <PhenotypeTraits traits={visualTraits(phenotype)} />
            {phenotype.tribalMarkers && phenotype.tribalMarkers.length > 0 && (
              <div className="pheno__markers" aria-label="Tribal markers">
                {phenotype.tribalMarkers.map((marker) => (
                  <span key={marker.id} className="pheno__marker">
                    {marker.label}
                    {marker.value != null ? ` ${marker.value}%` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="btn btn--outline" onClick={onGoMatch}>
            Open matches
          </button>
        </>
      )}
    </section>
  )
}
