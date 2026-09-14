import type { Phenotype } from '../types'

type Props = {
  phenotype: Phenotype
}

export function HeritageReadout({ phenotype }: Props) {
  const readout = phenotype.genomeReadout
  const fit = readout?.clusterFit ?? phenotype.scanConfidence ?? phenotype.genealogyLikelihood
  return (
    <div className="heritage">
      <p className="heritage__kicker">Heritage type</p>
      <div className="heritage__title-row">
        <h3 className="heritage__name">{phenotype.name}</h3>
        <span className="heritage__code">{phenotype.code}</span>
      </div>
      <p className="heritage__fit">{fit}% cluster fit · {phenotype.tagline}</p>
      {readout && (
        <div className="genome" aria-label="Illustrative guessed heritage markers">
          <p className="genome__kicker">Guessed markers</p>
          <div className="genome-strip" aria-hidden="true">
            {readout.bands.map((band) => (
              <span
                key={band.id}
                className={`genome-strip__band genome-strip__band--${band.group}`}
                style={{ flexGrow: Math.max(1, Math.round(band.value / 12)) }}
                title={`${band.id} ${band.value}%`}
              />
            ))}
          </div>
          <ul className="genome-markers">
            {readout.markers.map((marker) => (
              <li key={marker.id} className="genome-markers__row">
                <span className="genome-markers__id">{marker.id}</span>
                <span className="genome-markers__label">{marker.label}</span>
                <span className="genome-markers__call">{marker.call}</span>
                <span className="genome-markers__value">{marker.value}%</span>
              </li>
            ))}
          </ul>
          <p className="genome-note">{readout.note}</p>
        </div>
      )}
    </div>
  )
}
