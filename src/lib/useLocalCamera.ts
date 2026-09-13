import { useEffect, useState } from 'react'

export function useLocalCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active: MediaStream | null = null
    let cancelled = false

    const start = async () => {
      try {
        try {
          active = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            audio: true,
          })
        } catch {
          active = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false,
          })
        }
        if (cancelled) {
          active.getTracks().forEach((track) => track.stop())
          return
        }
        setStream(active)
        setReady(true)
      } catch {
        if (!cancelled) {
          setError('Camera is blocked or missing. Enable it in Chrome to send video.')
          setReady(false)
        }
      }
    }

    void start()
    return () => {
      cancelled = true
      active?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return { stream, error, ready }
}
