import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { UmingleRoom } from '../api/client'
import { fetchUmingleChat, sendUmingleMessage } from '../api/client'
import { loadAnonFilter, saveAnonFilter } from '../storage'
import { useAnonCall } from '../lib/useAnonCall'
import { FilteredVideo } from './FilteredVideo'

type Props = {
  room: UmingleRoom
  guestId: string
  localStream: MediaStream | null
  cameraError: string | null
  onEnableCamera?: () => void
  onRoom: (room: UmingleRoom) => void
  onSkip: () => void
  onLeave: () => void
  skipping?: boolean
}

export function UmingleChat({
  room,
  guestId,
  localStream,
  cameraError,
  onEnableCamera,
  onRoom,
  onSkip,
  onLeave,
  skipping = false,
}: Props) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [filter, setFilter] = useState(loadAnonFilter)
  const logRef = useRef<HTMLDivElement>(null)
  const { remoteStream, connection, signalError } = useAnonCall(room, guestId, localStream)

  useEffect(() => {
    saveAnonFilter(filter)
  }, [filter])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchUmingleChat(room.id, guestId).then(onRoom).catch(() => undefined)
    }, 800)
    return () => window.clearInterval(timer)
  }, [guestId, onRoom, room.id])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [room.messages.length])

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setSendError(null)
    try {
      const next = await sendUmingleMessage(room.id, guestId, text)
      onRoom(next)
      setDraft('')
    } catch {
      setSendError('Message did not send.')
    } finally {
      setSending(false)
    }
  }

  const peer = room.peer
  const peerName = peer?.displayName ?? 'Guest'
  const peerCode = peer?.phenotype.code ?? ''
  const similar = room.compatibility ?? peer?.compatibility
  const peerGone = Boolean(room.peerLeft || room.endedAt)
  const live = connection === 'connected' && Boolean(remoteStream) && !peerGone

  let remoteStatus = 'Connecting…'
  if (peerGone) remoteStatus = 'Peer left'
  else if (signalError) remoteStatus = signalError
  else if (connection === 'failed') remoteStatus = 'Video connection failed'
  else if (live) remoteStatus = 'Live'
  else if (!localStream && cameraError) remoteStatus = 'Waiting for your camera'
  else if (connection === 'connecting') remoteStatus = 'Connecting cameras…'

  return (
    <section className="umingle-chat umingle-chat--video" aria-label="Live video chat">
      <div className="umingle-chat__header">
        <button type="button" className="umingle-chat__back" onClick={onLeave}>
          Leave
        </button>
        <div>
          <h3 className="umingle-chat__name">{peerName}</h3>
          <p className="umingle-chat__meta">
            {peerCode}
            {similar != null ? ` · ${similar}% similar` : ''}
          </p>
        </div>
      </div>

      <div className="anon-chat__tools" aria-label="Porn filter">
        <button
          type="button"
          className={`anon-chat__toggle${filter.enabled ? ' anon-chat__toggle--on' : ''}`}
          aria-pressed={filter.enabled}
          onClick={() => setFilter((current) => ({ ...current, enabled: !current.enabled }))}
        >
          {filter.enabled ? 'Filter on' : 'Filter off'}
        </button>
        {filter.enabled && (
          <label className="anon-chat__severity">
            Severity
            <input
              type="range"
              min={0}
              max={100}
              value={filter.severity}
              onChange={(event) =>
                setFilter((current) => ({ ...current, severity: Number(event.target.value) }))
              }
            />
            <span>{filter.severity}</span>
          </label>
        )}
        <p className="anon-chat__disclaimer">
          Covers likely NSFW regions. Not a medical or legal classifier.
        </p>
      </div>

      <div className="umingle-stage">
        <div className="umingle-remote" aria-label="Peer video">
          <div className="umingle-remote__feed">
            {remoteStream && !peerGone ? (
              <FilteredVideo
                stream={remoteStream}
                filterOn={filter.enabled}
                severity={filter.severity}
                label="Peer camera"
              />
            ) : (
              <div className="umingle-remote__wait">
                <p>{remoteStatus}</p>
              </div>
            )}
            <span className={`umingle-remote__live${live ? '' : ' umingle-remote__live--wait'}`}>
              {live ? 'Live' : peerGone ? 'Left' : 'Wait'}
            </span>
            <button
              type="button"
              className="umingle-skip"
              onClick={onSkip}
              disabled={skipping}
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
            {localStream ? (
              <FilteredVideo
                stream={localStream}
                muted
                mirrored
                localPreview
                filterOn={filter.enabled}
                severity={filter.severity}
                label="Your camera"
              />
            ) : (
              <div className="umingle-self__fallback">
                <p>{cameraError || 'Waiting for camera…'}</p>
              </div>
            )}
          </div>
          <span>You</span>
        </div>
      </div>

      {(cameraError || signalError || peerGone) && (
        <div className="umingle__error" role="status">
          <p>
            {peerGone
              ? 'The other guest left. Skip to find someone else, or leave.'
              : cameraError || signalError}
          </p>
          {cameraError && onEnableCamera && (
            <button type="button" className="btn btn--outline" onClick={onEnableCamera}>
              Enable camera
            </button>
          )}
        </div>
      )}

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
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
        {sendError && (
          <p className="umingle__error" role="alert">
            {sendError}
          </p>
        )}
      </form>
    </section>
  )
}
