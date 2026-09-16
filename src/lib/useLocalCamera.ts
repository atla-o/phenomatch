import { useCallback, useEffect, useState } from 'react'
import { cameraErrorMessage, isAbortError, requestLocalCamera } from './localCamera'

export function useLocalCamera({ audio = true }: { audio?: boolean } = {}) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [requesting, setRequesting] = useState(true)
  const [retryKey, setRetryKey] = useState(0)

  const retry = useCallback(() => {
    setError(null)
    setReady(false)
    setRequesting(true)
    setRetryKey((key) => key + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active: MediaStream | null = null

    const start = async () => {
      try {
        active = await requestLocalCamera({ signal: controller.signal, audio })
        if (controller.signal.aborted) {
          active?.getTracks().forEach((track) => track.stop())
          return
        }
        setStream(active)
        setReady(true)
        setError(null)
      } catch (err) {
        if (controller.signal.aborted || isAbortError(err as { name?: string })) return
        setStream(null)
        setReady(false)
        setError(cameraErrorMessage(err as { name?: string }))
      } finally {
        if (!controller.signal.aborted) setRequesting(false)
      }
    }

    void start()
    return () => {
      controller.abort()
      active?.getTracks().forEach((track) => track.stop())
    }
  }, [retryKey, audio])

  return { stream, error, ready, requesting, retry }
}
