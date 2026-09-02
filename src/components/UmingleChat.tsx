import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { UmingleRoom } from '../api/client'
import { fetchUmingleChat, sendUmingleMessage } from '../api/client'

type Props = {
  room: UmingleRoom
  guestId: string
  onRoom: (room: UmingleRoom) => void
  onBack: () => void
}

export function UmingleChat({ room, guestId, onRoom, onBack }: Props) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchUmingleChat(room.id, guestId).then(onRoom).catch(() => undefined)
    }, 1500)
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
    try {
      const next = await sendUmingleMessage(room.id, guestId, text)
      onRoom(next)
      setDraft('')
    } finally {
      setSending(false)
    }
  }

  const peerName = room.peer?.displayName ?? 'Guest'
  const peerCode = room.peer?.phenotype.code ?? ''

  return (
    <section className="umingle-chat">
      <header className="umingle-chat__header">
        <button type="button" className="umingle-chat__back" onClick={onBack}>
          Back
        </button>
        <div>
          <h3 className="umingle-chat__name">{peerName}</h3>
          <p className="umingle-chat__meta">{peerCode} · anonymous match</p>
        </div>
      </header>

      <div className="umingle-chat__log" ref={logRef}>
        {room.messages.length === 0 && (
          <p className="umingle-chat__empty">Start the chat. This is a profile match — no account.</p>
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
            placeholder="Say something"
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
