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

type AnonymousPane = 'functions' | 'profile-match'

export function AnonymousMatch({ phenotype, hasProfile }: Props) {
  const [pane, setPane] = useState<AnonymousPane>('functions')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guestId, setGuestId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [room, setRoom] = useState<UmingleRoom | null>(null)

  if (!hasProfile) {
    return (
      <div className="match__empty">
        <p>Complete your phenotype scan in Pheno to use anon match.</p>
      </div>
    )
  }

  const runProfileMatch = async () => {
    setJoining(true)
    setError(null)
    try {
      const result = await joinUmingle(phenotype)
      setGuestId(result.guest.id)
      setDisplayName(result.guest.displayName)
      setMatches(result.matches)
      setPane('profile-match')
    } catch {
      setError('Could not run profile match. Matching API may be offline.')
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

  if (pane === 'functions') {
    return (
      <div className="anon">
        <h3 className="anon__title">Anon match</h3>
        <p className="anon__lede">No account. Guests are keyed to a phenotype cluster, not a login.</p>

        <div className="anon__functions">
          <h4 className="anon__functions-title">Functions</h4>
          <button
            type="button"
            className="match-function"
            onClick={() => void runProfileMatch()}
            disabled={joining}
          >
            <span className="match-function__name">Profile match</span>
            <span className="match-function__desc">
              Rank other guests by your phenotype profile, then chat. Requires a Pheno scan. No signup.
            </span>
            <span className="match-function__action">
              {joining ? 'Matching…' : 'Run profile match'}
            </span>
          </button>
        </div>
        {error && <p className="umingle__error">{error}</p>}
      </div>
    )
  }

  return (
    <div className="anon">
      <button type="button" className="umingle-chat__back" onClick={() => setPane('functions')}>
        Anon match
      </button>
      <h3 className="anon__title">Profile match</h3>
      <p className="umingle__status">
        {displayName} · {matches.length} nearby
      </p>

      {matches.length === 0 ? (
        <div className="match__empty">
          <p>No phenotype guests in the pool yet.</p>
        </div>
      ) : (
        <ul className="umingle__list" aria-label="Profile matches">
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
                <p className="umingle-card__anon">Anon guest · profile match</p>
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
    </div>
  )
}
