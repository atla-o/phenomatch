import { useState } from 'react'
import type { Match, Phenotype } from '../types'
import {
  joinUmingle,
  openUmingleChat,
  type UmingleRoom,
} from '../api/client'
import { CompatibilityRing } from './CompatibilityRing'
import { UmingleChat } from './UmingleChat'

type Props = {
  phenotype: Phenotype
  hasProfile: boolean
}

export function UmingleView({ phenotype, hasProfile }: Props) {
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guestId, setGuestId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [source, setSource] = useState('')
  const [room, setRoom] = useState<UmingleRoom | null>(null)

  const enter = async () => {
    setJoining(true)
    setError(null)
    try {
      const result = await joinUmingle(hasProfile ? phenotype : undefined)
      setGuestId(result.guest.id)
      setDisplayName(result.guest.displayName)
      setMatches(result.matches)
      setSource(result.source)
    } catch {
      setError('Could not join Umingle. Matching API may be offline.')
    } finally {
      setJoining(false)
    }
  }

  const startChat = async (peerGuestId: string) => {
    if (!guestId) return
    const opened = await openUmingleChat(guestId, peerGuestId)
    setRoom(opened)
  }

  if (room && guestId) {
    return (
      <UmingleChat
        room={room}
        guestId={guestId}
        onRoom={setRoom}
        onBack={() => setRoom(null)}
      />
    )
  }

  return (
    <section className="umingle">
      <header className="umingle__page-header">
        <h2 className="umingle__page-title">Umingle</h2>
        <p className="umingle__subtitle">
          No account. Match by phenotype, then chat.
        </p>
      </header>

      {!guestId && (
        <div className="umingle__intro">
          <p className="umingle__intro-copy">
            Umingle is an anonymous match type. You are a guest keyed to a
            phenotype cluster — not a login. Chat the people whose visual
            traits, tribe, and genealogy line up with yours.
          </p>
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => void enter()}
            disabled={joining}
          >
            {joining ? 'Joining…' : 'Enter without an account'}
          </button>
          {error && <p className="umingle__error">{error}</p>}
        </div>
      )}

      {guestId && (
        <>
          <p className="umingle__status">
            {displayName} · {matches.length} nearby
            {source ? ` · ${source}` : ''}
          </p>

          {matches.length === 0 ? (
            <div className="match__empty">
              <p>No phenotype guests in the pool yet.</p>
            </div>
          ) : (
            <ul className="umingle__list" aria-label="Umingle matches">
              {matches.map((match) => (
                <li key={match.guestId ?? match.phenotype.id}>
                  <article className="umingle-card">
                    <div className="umingle-card__top">
                      <div className="match-card__avatar">
                        <span>{match.phenotype.code}</span>
                      </div>
                      <CompatibilityRing value={match.compatibility} />
                    </div>
                    <h3 className="match-card__name">{match.phenotype.name}</h3>
                    <p className="match-card__tagline">{match.phenotype.tagline}</p>
                    <p className="umingle-card__anon">Anonymous guest</p>
                    <button
                      type="button"
                      className="btn btn--outline"
                      onClick={() => match.guestId && void startChat(match.guestId)}
                    >
                      Chat
                    </button>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
