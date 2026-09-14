import { useEffect, useRef, useState } from 'react'
import { detectNudity, filterDecision, rasterFromElement } from '../lib/antiporn'

type Box = { x: number; y: number; size: number; kind: 'explicit' | 'skin' }

type Props = {
  stream: MediaStream | null
  muted?: boolean
  mirrored?: boolean
  filterOn: boolean
  severity: number
  label: string
  className?: string
}

export function FilteredVideo({
  stream,
  muted = false,
  mirrored = false,
  filterOn,
  severity,
  label,
  className = '',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [boxes, setBoxes] = useState<Box[]>([])
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    if (stream) {
      void video.play().catch(() => undefined)
    }
  }, [stream])

  useEffect(() => {
    if (!filterOn) {
      setBoxes([])
      setHidden(false)
      const video = videoRef.current
      if (video && video.paused && stream) void video.play().catch(() => undefined)
      return
    }

    let frame = 0
    let last = 0
    const tick = (time: number) => {
      if (time - last > 280) {
        last = time
        const video = videoRef.current
        if (video && video.readyState >= 2) {
          const raster = rasterFromElement(video, 120)
          if (raster) {
            const detected = detectNudity(raster.image, severity, raster.width, raster.height)
            const decision = filterDecision(detected, { enabled: true, hideOnExplicit: true })
            setBoxes(decision.boxes)
            setHidden(decision.hide)
            if (decision.hide) video.pause()
            else if (video.paused) void video.play().catch(() => undefined)
          }
        }
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [filterOn, severity, stream])

  return (
    <div className={`filtered-video${className ? ` ${className}` : ''}`}>
      <video
        ref={videoRef}
        className={`filtered-video__video${mirrored ? ' filtered-video__video--mirror' : ''}`}
        muted={muted}
        playsInline
        autoPlay
        aria-label={label}
      />
      {filterOn && (
        <div className="filtered-video__overlay" aria-hidden="true">
          {boxes.map((box, index) => (
            <span
              key={`${box.kind}-${index}-${Math.round(box.x)}-${Math.round(box.y)}`}
              className={`filtered-video__box${box.kind === 'explicit' ? ' filtered-video__box--explicit' : ''}`}
              style={{
                left: `${box.x}px`,
                top: `${box.y}px`,
                width: `${box.size}px`,
                height: `${box.size}px`,
              }}
            />
          ))}
        </div>
      )}
      {filterOn && hidden && (
        <div className="filtered-video__wall">
          <span>Filtered</span>
        </div>
      )}
    </div>
  )
}
