import { useEffect, useRef, useState } from 'react'
import type { Phenotype, Trait } from '../types'
import { submitPhenotypeScan } from '../api/client'
import { scanSteps } from '../data/mock'
import { analyzeCanvas, analyzeVideoFrame, canvasFromFile } from '../lib/analyzeFace'
import { cameraErrorMessage, isPermissionDenied, requestLocalCamera } from '../lib/localCamera'

type Props = {
  onComplete: (phenotype: Phenotype) => void
  onFail?: (message: string) => void
}

type Phase = 'preparing' | 'scanning' | 'complete' | 'error'

const REVEAL_STEPS = [
  { key: 'facialStructure' as const, label: 'Measuring bone spacing…', progress: 48 },
  { key: 'jawLine' as const, label: 'Reading jaw width…', progress: 56 },
  { key: 'cheekboneStructure' as const, label: 'Reading cheekbone width…', progress: 64 },
  { key: 'hairPattern' as const, label: 'Scoring hair thickness…', progress: 72 },
  { key: 'noseShape' as const, label: 'Measuring cartilage length…', progress: 80 },
  { key: 'melanin' as const, label: 'Reading feature shade…', progress: 86 },
  { key: 'eyeColor' as const, label: 'Sampling iris shade…', progress: 90 },
  { key: 'lipFullness' as const, label: 'Measuring lip fullness…', progress: 93 },
  { key: 'tribe' as const, label: 'Inferring tribal identifiers…', progress: 96 },
]

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function traitIdForKey(key: (typeof REVEAL_STEPS)[number]['key']) {
  if (key === 'eyeColor') return 'eye-color'
  if (key === 'hairPattern') return 'hair'
  if (key === 'noseShape') return 'nose'
  if (key === 'lipFullness') return 'lips'
  if (key === 'facialStructure') return 'facial'
  if (key === 'jawLine') return 'jaw'
  if (key === 'cheekboneStructure') return 'cheekbone'
  return key
}

export function ScanPanel({ onComplete, onFail }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [phase, setPhase] = useState<Phase>('preparing')
  const [status, setStatus] = useState(scanSteps[0])
  const [progress, setProgress] = useState(4)
  const [error, setError] = useState<string | null>(null)
  const [detectedTraits, setDetectedTraits] = useState<Trait[]>([])
  const [result, setResult] = useState<Phenotype | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [stillFile, setStillFile] = useState<File | null>(null)
  const onCompleteRef = useRef(onComplete)
  const onFailRef = useRef(onFail)
  onCompleteRef.current = onComplete
  onFailRef.current = onFail

  const retry = () => {
    setError(null)
    setPhase('preparing')
    setProgress(4)
    setStatus(scanSteps[0])
    setDetectedTraits([])
    setResult(null)
    setStillFile(null)
    setRetryKey((key) => key + 1)
  }

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    const video = videoRef.current

    const fail = (message: string, fatal = false) => {
      if (cancelled) return
      setPhase('error')
      setError(message)
      if (fatal) onFailRef.current?.(message)
    }

    const attachStream = async (next: MediaStream) => {
      stream = next
      if (!video) return
      video.srcObject = next
      await video.play()
      if (!cancelled) setCameraReady(true)
    }

    const run = async () => {
      try {
        setPhase('preparing')
        setProgress(8)
        setStatus('Opening camera…')

        if (stillFile) {
          setCameraReady(false)
          setStatus('Loading optical pipeline…')
          setProgress(22)
          const canvas = await canvasFromFile(stillFile)
          if (cancelled) return
          setStatus('Finding a face…')
          setProgress(36)
          const analyzed = await analyzeCanvas(canvas, 'still')
          if (cancelled) return
          await finish(analyzed)
          return
        }

        try {
          const next = await requestLocalCamera({ audio: false })
          if (cancelled) {
            next.getTracks().forEach((track) => track.stop())
            return
          }
          await attachStream(next)
        } catch (err) {
          fail(cameraErrorMessage(err as { name?: string }))
          return
        }

        setStatus('Loading optical pipeline…')
        setProgress(22)
        setPhase('scanning')

        const started = Date.now()
        let analyzed = null
        while (!cancelled && Date.now() - started < 12000) {
          setStatus('Finding a face…')
          setProgress(36)
          try {
            if (videoRef.current) {
              analyzed = await analyzeVideoFrame(videoRef.current)
              break
            }
          } catch (err) {
            if ((err as { name?: string }).name !== 'NoFaceError') throw err
          }
          await wait(280)
        }
        if (cancelled) return
        if (!analyzed) {
          fail('No face in view. Center your face and retry, or use a photo.')
          return
        }
        await finish(analyzed)
      } catch (err) {
        if (cancelled) return
        const name = (err as { name?: string; message?: string }).name || ''
        const message = String((err as { message?: string }).message || err)
        if (name === 'NoFaceError' || message === 'no_face') {
          fail('No face in view. Center your face and retry, or use a photo.')
          return
        }
        if (isPermissionDenied(err as { name?: string })) {
          fail(cameraErrorMessage(err as { name?: string }))
          return
        }
        fail('Could not finish the phenotype scan. Retry or use a photo.')
      }
    }

    const finish = async (analyzed: Awaited<ReturnType<typeof analyzeVideoFrame>>) => {
      setPhase('scanning')
      const previewTraits: Trait[] = []
      for (const step of REVEAL_STEPS) {
        if (cancelled) return
        setStatus(step.label)
        setProgress(step.progress)
        const id = traitIdForKey(step.key)
        previewTraits.push({
          id,
          label: id === 'tribe' ? 'Tribe' : step.label.replace('…', ''),
          value: analyzed.traits[step.key],
          category: id === 'tribe' ? 'tribal' : 'physical',
        })
        setDetectedTraits([...previewTraits])
        await wait(120)
      }

      setStatus('Assigning catalog type…')
      setProgress(97)
      const phenotype = await submitPhenotypeScan({
        traits: analyzed.traits,
        metrics: {
          extra: {
            intercanthalIndex: analyzed.extra.intercanthalIndex,
            mouthIndex: analyzed.extra.mouthIndex,
            faceIndex: analyzed.extra.faceIndex,
            boneIndex: analyzed.extra.boneIndex,
            cartilage: analyzed.extra.cartilage,
            hairThickness: analyzed.extra.hairThickness,
            midfaceScore: analyzed.extra.midfaceScore,
          },
          landmarkCount: analyzed.landmarkCount,
          source: analyzed.source,
        },
      })
      if (cancelled) return
      if (!phenotype?.id) {
        fail('Could not finish the phenotype scan.', true)
        return
      }
      setResult(phenotype)
      const tribe = phenotype.traits.find((trait) => trait.id === 'tribe')
      setDetectedTraits(
        [
          {
            id: 'type',
            label: phenotype.name,
            category: 'tribal' as const,
            displayValue: phenotype.code,
          },
          tribe,
          ...(phenotype.tribalMarkers || []).filter((marker) => marker.id !== 'tribe'),
        ].filter(Boolean) as Trait[],
      )
      setStatus('Scan complete')
      setProgress(100)
      setPhase('complete')
      window.setTimeout(() => {
        if (!cancelled) onCompleteRef.current(phenotype)
      }, 700)
    }

    void run()
    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
      if (video) video.srcObject = null
    }
  }, [retryKey, stillFile])

  return (
    <div className="scan-panel">
      <input
        ref={fileRef}
        className="pheno__gene-input"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          setError(null)
          setPhase('preparing')
          setDetectedTraits([])
          setStillFile(file)
          setRetryKey((key) => key + 1)
        }}
      />
      <div className="scan-panel__intro">
        <h3 className="scan-panel__heading">Phenotype scan</h3>
        <p className="scan-panel__desc">
          Camera frames score bone spacing, cartilage, hair, and shade —
          then map onto a heritage type. Cluster fit, not a medical or
          genetic test.
        </p>
        {cameraReady && phase !== 'error' && (
          <p className="scan-panel__camera-note">Live camera feed on this device.</p>
        )}
        {stillFile && (
          <p className="scan-panel__camera-note">Analyzing a captured still.</p>
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

          {detectedTraits.slice(0, 6).map((trait, i) => (
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

      <p className="scan-panel__status" role="status">
        {phase === 'error' ? error : phase === 'complete' ? 'Scan complete' : status}
      </p>

      <div className="scan-panel__progress">
        <div className="scan-panel__progress-bar">
          <div className="scan-panel__progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="scan-panel__progress-text">{Math.round(progress)}%</span>
      </div>

      {phase === 'error' && (
        <div className="scan-panel__actions">
          <button type="button" className="btn btn--outline" onClick={retry}>
            Retry
          </button>
          <button type="button" className="btn btn--outline" onClick={() => fileRef.current?.click()}>
            Use a photo
          </button>
        </div>
      )}

      {detectedTraits.length > 0 && (
        <ul className="scan-panel__detected">
          {detectedTraits.map((trait) => (
            <li key={trait.id} className="scan-panel__detected-item">
              <span className="scan-panel__detected-check">✓</span>
              {trait.label}
              <span className="scan-panel__detected-value">
                {trait.displayValue ?? (trait.value != null ? `${trait.value}%` : '')}
              </span>
            </li>
          ))}
        </ul>
      )}

      {result?.tribalMarkers && phase === 'complete' && (
        <p className="scan-panel__camera-note">
          Tribal markers computed from this face and used to assign {result.name}.
        </p>
      )}
    </div>
  )
}
