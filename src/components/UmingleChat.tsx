import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { UmingleRoom } from '../api/client'
import { fetchUmingleChat, sendUmingleMessage } from '../api/client'

type Props = {
  room: UmingleRoom
  guestId: string
  onRoom: (room: UmingleRoom) => void
  onSkip: () => void
  skipping?: boolean
}

export function UmingleChat({ room, guestId, onRoom, onSkip, skipping = false }: Props) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchUmingleChat(room.id, guestId).then(onRoom).catch(() => undefined)
    }, 1500)
    return () => window.clearInterval(timer)
  }, [guestId, onRoom, room.id])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [room.messages.length])

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play()
          setCameraReady(true)
        }
      } catch {
        if (!cancelled) setCameraReady(false)
      }
    }

    void startCamera()
    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const next = await sendUmingleMessage(room.id, guestId, text)
      onRoom(next)
      setDraft('')
    } finally {
      setSending(false)
    }
  }

  const peer = room.peer
  const peerName = peer?.displayName ?? 'Guest'
  const peerCode = peer?.phenotype.code ?? ''
  const similar = room.compatibility ?? peer?.compatibility

  return (
    <section className="umingle-chat umingle-chat--video" aria-label="Live video chat">
      <div className="umingle-stage">
        <div className="umingle-remote" aria-label="Peer video">
          <div className="umingle-remote__feed">
            <div className="umingle-remote__silhouette" aria-hidden="true">
              <svg viewBox="0 0 200 260" fill="none">
                <ellipse cx="100" cy="95" rx="62" ry="72" stroke="currentColor" strokeWidth="1.5" />
                <path d="M55 200 Q100 240 145 200" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <span className="umingle-remote__live">Live</span>
            <button
              type="button"
              className="umingle-skip"
              onClick={onSkip}
              disabled={!peer || skipping}
            >
              Skip
            </button>
          </div>
          <div className="umingle-remote__meta">
            <strong>{peerName}</strong>
            <span>
              {peerCode}
              {similar != null ? ` · ${similar}% similar` : ''}
            </span>
          </div>
        </div>

        <div className="umingle-self">
          <div className="umingle-self__frame">
            <video
              ref={videoRef}
              className="umingle-self__video"
              muted
              playsInline
              autoPlay
              aria-label="Your camera"
            />
            {!cameraReady && (
              <div className="umingle-self__fallback" aria-hidden="true">
                <svg viewBox="0 0 200 260" fill="none">
                  <ellipse cx="100" cy="95" rx="62" ry="72" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M55 200 Q100 240 145 200" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
            )}
          </div>
          <span>You</span>
        </div>
      </div>

      <div className="umingle-chat__log umingle-chat__log--compact" ref={logRef} role="log">
        {room.messages.length === 0 && (
          <p className="umingle-chat__empty">Text while on video.</p>
        )}
        {room.messages.map((message) => (
          <div
            key={message.id}
            className={`umingle-bubble${message.mine ? ' umingle-bubble--mine' : ''}`}
          >
            {message.text}
          </div>
        ))}
      </div>

      <form className="umingle-chat__compose" onSubmit={send}>
        <label className="umingle-chat__label" htmlFor="umingle-draft">
          Message
        </label>
        <div className="umingle-chat__row">
          <input
            id="umingle-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Text while on video…"
            autoComplete="off"
          />
          <button type="submit" className="btn btn--solid" disabled={sending}>
            Send
          </button>
        </div>
      </form>
    </section>
  )
}
