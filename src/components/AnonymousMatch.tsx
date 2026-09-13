import { useEffect, useState } from 'react'
import type { Match, Phenotype } from '../types'
import {
  joinAnonLive,
  joinUmingleLobby,
  openUmingleChat,
  type UmingleRoom,
} from '../api/client'
import { UmingleChat } from './UmingleChat'

type Props = {
  phenotype: Phenotype
  hasProfile: boolean
  onGoPheno: () => void
}

export function AnonymousMatch({ phenotype, hasProfile, onGoPheno }: Props) {
  const [loading, setLoading] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guestId, setGuestId] = useState<string | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [room, setRoom] = useState<UmingleRoom | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!hasProfile) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void joinUmingleLobby(phenotype)
      .then((result) => {
        if (cancelled) return
        setGuestId(result.guest.id)
        setMatches(result.matches)
      })
      .catch(() => {
        if (cancelled) return
        setError('Could not join the anonymous lobby.')
        setMatches([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [hasProfile, phenotype, reloadKey])

  const goLive = async (skipPeerId?: string) => {
    setJoining(true)
    setError(null)
    try {
      const result = await joinAnonLive(phenotype, skipPeerId)
      setGuestId(result.guest.id)
      setRoom(result.room)
      if (!result.room) {
        setError('No similar phenotype online (50%+).')
      }
    } catch {
      setError('Could not start a live chat.')
    } finally {
      setJoining(false)
    }
  }

  const openPeer = async (peerGuestId?: string) => {
    if (!guestId || !peerGuestId) return
    setJoining(true)
    setError(null)
    try {
      const next = await openUmingleChat(guestId, peerGuestId)
      setRoom(next)
    } catch {
      setError('Could not open that chat.')
    } finally {
      setJoining(false)
    }
  }

  if (room && guestId) {
    return (
      <div className="anon anon--chat">
        <UmingleChat
          room={room}
          guestId={guestId}
          onRoom={setRoom}
          onSkip={() => void goLive(room.peer?.guestId)}
          onLeave={() => {
            setRoom(null)
            setError(null)
          }}
          skipping={joining}
        />
      </div>
    )
  }

  if (!hasProfile) {
    return (
      <div className="match__empty">
        <p>Scan your type in Pheno to use anonymous live chat.</p>
        <button type="button" className="btn btn--outline" onClick={onGoPheno}>
          Scan in Pheno
        </button>
      </div>
    )
  }

  const similar = matches.filter((item) => item.compatibility >= 50)

  return (
    <div className="anon">
      <div className="anon__intro">
        <p className="anon__lede">
          Join as a guest and talk with a similar cluster. Text works here. A
          camera feed is optional and stays on the Mac client when one exists.
          This is phenotype similarity, not a medical score.
        </p>
        <button
          type="button"
          className="btn btn--outline"
          disabled={joining || loading}
          onClick={() => void goLive()}
        >
          {joining ? 'Connecting…' : 'Go live'}
        </button>
      </div>

      {error && (
        <div className="status-note status-note--error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="match__reset"
            onClick={() => {
              setError(null)
              setReloadKey((n) => n + 1)
            }}
          >
            Try again
          </button>
        </div>
      )}

      {loading && <p className="umingle__status">Finding similar phenotypes…</p>}

      {!loading && similar.length === 0 && !error && (
        <div className="match__empty">
          <p>No similar phenotype in the lobby (50%+).</p>
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => setReloadKey((n) => n + 1)}
          >
            Refresh lobby
          </button>
        </div>
      )}

      {!loading && similar.length > 0 && (
        <ul className="umingle__list" aria-label="Similar phenotypes">
          {similar.map((item) => (
            <li key={item.guestId ?? item.phenotype.id}>
              <button
                type="button"
                className="umingle-card"
                disabled={joining}
                onClick={() => void openPeer(item.guestId)}
              >
                <div className="umingle-card__top">
                  <strong>{item.phenotype.name}</strong>
                  <span className="umingle-card__anon">{item.compatibility}%</span>
                </div>
                <p>{item.phenotype.tagline}</p>
                <span className="match-function__action">Open chat</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
