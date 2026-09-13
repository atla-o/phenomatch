import { useCallback, useEffect, useRef, useState } from 'react'
import type { Match, Phenotype } from '../types'
import {
  heartbeatAnon,
  joinAnonLive,
  joinUmingleLobby,
  leaveAnon,
  type UmingleRoom,
} from '../api/client'
import { useLocalCamera } from '../lib/useLocalCamera'
import { loadAnonFilter } from '../storage'
import { FilteredVideo } from './FilteredVideo'
import { UmingleChat } from './UmingleChat'

type Props = {
  phenotype: Phenotype
  hasProfile: boolean
  onGoPheno: () => void
}

export function AnonymousMatch({ phenotype, hasProfile, onGoPheno }: Props) {
  const [loading, setLoading] = useState(false)
  const [joining, setJoining] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guestId, setGuestId] = useState<string | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [liveCount, setLiveCount] = useState(0)
  const [similarCount, setSimilarCount] = useState(0)
  const [room, setRoom] = useState<UmingleRoom | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const camera = useLocalCamera()
  const filter = loadAnonFilter()
  const guestIdRef = useRef<string | null>(null)
  guestIdRef.current = guestId

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
        setLiveCount(result.liveCount)
        setSimilarCount(result.similarCount)
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

  useEffect(() => {
    if (!guestId) return
    const timer = window.setInterval(() => {
      void heartbeatAnon(guestId)
        .then((result) => {
          setMatches(result.matches)
          setLiveCount(result.liveCount)
          setSimilarCount(result.similarCount)
          if (result.room && !result.room.endedAt) {
            setRoom(result.room)
            setWaiting(false)
            setError(null)
          }
        })
        .catch(() => undefined)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [guestId])

  useEffect(() => {
    return () => {
      const id = guestIdRef.current
      if (id) void leaveAnon(id, true).catch(() => undefined)
    }
  }, [])

  const pollLive = useCallback(async (skipPeerId?: string, { markJoining = false } = {}) => {
    if (markJoining) setJoining(true)
    if (markJoining) setError(null)
    try {
      const result = await joinAnonLive(phenotype, skipPeerId)
      setGuestId(result.guest.id)
      setLiveCount(result.liveCount)
      setSimilarCount(result.similarCount)
      if (result.room) {
        setRoom(result.room)
        setWaiting(false)
        setError(null)
      } else {
        setRoom(null)
        setWaiting(true)
      }
    } catch {
      if (markJoining) setError('Could not start a live chat.')
      setWaiting(false)
    } finally {
      if (markJoining) setJoining(false)
    }
  }, [phenotype])

  useEffect(() => {
    if (!waiting || room) return
    const timer = window.setInterval(() => {
      void pollLive()
    }, 2000)
    return () => window.clearInterval(timer)
  }, [pollLive, room, waiting])

  const cancelWait = async () => {
    setWaiting(false)
    if (guestId) {
      try {
        await leaveAnon(guestId, false)
      } catch {
        /* still leave the waiting UI */
      }
    }
  }

  if (room && guestId) {
    return (
      <div className="anon anon--chat">
        <UmingleChat
          room={room}
          guestId={guestId}
          localStream={camera.stream}
          cameraError={camera.error}
          onRoom={setRoom}
          onSkip={() => void pollLive(room.peer?.guestId, { markJoining: true })}
          onLeave={() => {
            if (guestId) void leaveAnon(guestId, false).catch(() => undefined)
            setRoom(null)
            setWaiting(false)
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

  const othersLive = Math.max(0, liveCount - 1)
  const presenceLine =
    othersLive === 0
      ? 'You are the only person live.'
      : similarCount === 0
        ? `${othersLive} live now · none at 50%+ similarity.`
        : `${othersLive} live now · ${similarCount} at 50%+.`

  return (
    <div className="anon">
      <div className="anon__intro">
        <p className="anon__lede">
          Anonymous live chat with a similar phenotype (50%+). Chrome uses your
          camera over WebRTC — the Mac client is optional. This is cluster
          similarity, not a medical score.
        </p>
        <p className="umingle__status" role="status">
          {loading ? 'Checking who is live…' : presenceLine}
        </p>
        {waiting ? (
          <div className="anon__waiting" role="status">
            <p>Waiting for someone similar (50%+) to go live. No fake peer video.</p>
            <button type="button" className="btn btn--outline" onClick={() => void cancelWait()}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn--outline"
            disabled={joining || loading}
            onClick={() => void pollLive(undefined, { markJoining: true })}
          >
            {joining ? 'Connecting…' : 'Go live'}
          </button>
        )}
      </div>

      <div className="anon__preview">
        <div className="anon__preview-frame">
          {camera.stream ? (
            <FilteredVideo
              stream={camera.stream}
              muted
              mirrored
              filterOn={filter.enabled}
              severity={filter.severity}
              label="Your camera"
            />
          ) : (
            <div className="umingle-self__fallback">
              <p>{camera.error || 'Camera preview'}</p>
            </div>
          )}
        </div>
        <p className="anon-chat__disclaimer">
          Antiporn filter is on by default once you connect. It covers likely
          NSFW regions. Not a medical or legal classifier.
        </p>
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

      {!loading && matches.length > 0 && (
        <ul className="umingle__list" aria-label="Live similar phenotypes">
          {matches.map((item) => (
            <li key={item.guestId ?? item.phenotype.id} className="umingle-card umingle-card--static">
              <div className="umingle-card__top">
                <strong>{item.phenotype.name}</strong>
                <span className="umingle-card__anon">{item.compatibility}%</span>
              </div>
              <p>{item.phenotype.tagline}</p>
              <span className="umingle__status">Live now</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
