import { useEffect, useRef, useState } from 'react'
import { scanSteps, userPhenotype, userTraits } from '../data/mock'

type Props = {
  onComplete: () => void
}

export function ScanPanel({ onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [detectedTraits, setDetectedTraits] = useState<typeof userTraits>([])
  const [genealogyRevealed, setGenealogyRevealed] = useState(false)
  const [phase, setPhase] = useState<'scanning' | 'complete'>('scanning')

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 800 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play()
          setCameraReady(true)
        }
      } catch {
        if (!cancelled) {
          setCameraError('Camera unavailable on this device. Using optical fallback.')
        }
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(p + 1.5, 100)
        const newStep = Math.floor((next / 100) * scanSteps.length)
        setStepIndex(Math.min(newStep, scanSteps.length - 1))

        const traitCount = Math.floor((next / 100) * userTraits.length)
        setDetectedTraits(userTraits.slice(0, traitCount))
        setGenealogyRevealed(next >= 88)

        if (next >= 100) {
          clearInterval(interval)
          setPhase('complete')
          setTimeout(onComplete, 800)
        }
        return next
      })
    }, 60)

    return () => clearInterval(interval)
  }, [onComplete])

  return (
    <div className="scan-panel">
      <div className="scan-panel__intro">
        <h3 className="scan-panel__heading">Phenotype scan</h3>
        <p className="scan-panel__desc">
          Local camera capture of visible identifiers — melanin, eye color, facial
          structure, and tribe — to estimate your genealogy cluster.
        </p>
        {cameraError && <p className="scan-panel__camera-note">{cameraError}</p>}
        {cameraReady && !cameraError && (
          <p className="scan-panel__camera-note">Live camera feed (this Mac).</p>
        )}
      </div>

      <div className="scan-panel__viewport">
        <div className="scan-panel__frame">
          <video
            ref={videoRef}
            className="scan-panel__camera"
            autoPlay
            playsInline
            muted
            aria-label="Live phenotype camera"
          />

          {!cameraReady && (
            <div className="scan-panel__silhouette" aria-hidden="true">
              <svg viewBox="0 0 200 260" fill="none">
                <ellipse cx="100" cy="95" rx="62" ry="72" stroke="currentColor" strokeWidth="1.5" />
                <path d="M55 200 Q100 240 145 200" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
          )}

          <div className={`scan-panel__grid${phase === 'complete' ? ' scan-panel__grid--done' : ''}`} aria-hidden="true" />

          {phase === 'scanning' && (
            <>
              <div className="scan-panel__sweep" aria-hidden="true" />
              <div className="scan-panel__corners" aria-hidden="true">
                <span /><span /><span /><span />
              </div>
            </>
          )}

          {detectedTraits.map((trait, i) => (
            <div
              key={trait.id}
              className="scan-panel__marker"
              style={{
                top: `${10 + i * 8}%`,
                left: i % 2 === 0 ? '6%' : 'auto',
                right: i % 2 === 1 ? '6%' : 'auto',
              }}
            >
              <span className="scan-panel__marker-dot" />
              <span className="scan-panel__marker-label">{trait.label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="scan-panel__status">
        {phase === 'complete' ? 'Scan complete' : scanSteps[stepIndex]}
      </p>

      <div className="scan-panel__progress">
        <div className="scan-panel__progress-bar">
          <div className="scan-panel__progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="scan-panel__progress-text">{Math.round(progress)}%</span>
      </div>

      {detectedTraits.length > 0 && (
        <ul className="scan-panel__detected">
          {detectedTraits.map((trait) => (
            <li key={trait.id} className="scan-panel__detected-item">
              <span className="scan-panel__detected-check">✓</span>
              {trait.label}
              <span className="scan-panel__detected-value">{trait.value}%</span>
            </li>
          ))}
          {genealogyRevealed && (
            <li className="scan-panel__detected-item">
              <span className="scan-panel__detected-check">✓</span>
              Genealogy likelihood
              <span className="scan-panel__detected-value">
                {userPhenotype.genealogyLikelihood}%
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
