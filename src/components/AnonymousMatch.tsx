import { useCallback, useEffect, useRef, useState } from 'react'
import type { Match, Phenotype } from '../types'
import {
  heartbeatAnon,
  joinAnonLive,
  joinUmingleLobby,
  leaveAnon,
  openUmingleChat,
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

  const applyHeartbeat = useCallback(
    (result: {
      matches?: Match[]
      liveCount?: number
      similarCount?: number
      room?: UmingleRoom | null
      guest?: { id?: string; status?: string }
    }) => {
      if (result.guest?.id) setGuestId(result.guest.id)
      if (result.matches) setMatches(result.matches)
      if (result.liveCount != null) setLiveCount(result.liveCount)
      if (result.similarCount != null) setSimilarCount(result.similarCount)
      if (result.room && !result.room.endedAt) {
        setRoom(result.room)
        setWaiting(false)
        setError(null)
        return
      }
      if (result.guest?.status === 'seeking') setWaiting(true)
    },
    [],
  )

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
        if (result.guest.status === 'seeking') setWaiting(true)
        if (result.guest.status === 'seeking' || result.guest.status === 'connected') {
          void heartbeatAnon(result.guest.id).then(applyHeartbeat).catch(() => undefined)
        }
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
    const beat = () => {
      void heartbeatAnon(guestId).then(applyHeartbeat).catch(() => undefined)
    }
    beat()
    const timer = window.setInterval(beat, 4000)
    return () => window.clearInterval(timer)
  }, [applyHeartbeat, guestId])

  useEffect(() => {
    const goOffline = () => {
      const id = guestIdRef.current
      if (id) void leaveAnon(id, true, { keepalive: true }).catch(() => undefined)
    }
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      const id = guestIdRef.current
      if (id) void heartbeatAnon(id).then(applyHeartbeat).catch(() => undefined)
    }
    window.addEventListener('pagehide', goOffline)
    window.addEventListener('beforeunload', goOffline)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', goOffline)
      window.removeEventListener('beforeunload', goOffline)
      document.removeEventListener('visibilitychange', onVisibility)
      // React unmount (StrictMode, Data↔Anon, scaled-shell remounts) must not
      // force offline — that wipes presence so the other browser cannot pair.
    }
  }, [applyHeartbeat])

  const pollLive = useCallback(async (skipPeerId?: string, { markJoining = false } = {}) => {
    if (markJoining) setJoining(true)
    if (markJoining) setError(null)
    try {
      const result = await joinAnonLive(phenotype, skipPeerId)
      setGuestId(result.guest.id)
      setLiveCount(result.liveCount)
      setSimilarCount(result.similarCount)
      if (result.matches) setMatches(result.matches)
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
    void pollLive()
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

  const openPeer = async (peerGuestId?: string, compatibility?: number) => {
    if (!guestId || !peerGuestId || joining) return
    setJoining(true)
    setError(null)
    try {
      const next = await openUmingleChat(guestId, peerGuestId, compatibility)
      setRoom(next)
      setWaiting(false)
    } catch {
      setError('Could not open chat.')
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
          localStream={camera.stream}
          cameraError={camera.error}
          onEnableCamera={camera.retry}
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

  const live = Number.isFinite(Number(liveCount)) ? Number(liveCount) : 0
  const similar = Number.isFinite(Number(similarCount)) ? Number(similarCount) : 0
  const othersLive = Math.max(0, live - 1)
  const presenceLine =
    othersLive === 0
      ? 'You are the only person live.'
      : similar === 0
        ? `${othersLive} live now · none at 50%+ · will pair best available.`
        : `${othersLive} live now · ${similar} at 50%+.`

  return (
    <div className="anon">
      <div className="anon__intro">
        <p className="anon__lede">
          Anonymous live chat. Prefers 50%+ similarity; if you two are the only
          ones live, you still get a room (best available). Text works even if
          video is still connecting. Chrome camera over WebRTC — the Mac client
          is optional. Cluster similarity, not a medical score.
        </p>
        <p className="umingle__status" role="status">
          {loading ? 'Checking who is live…' : presenceLine}
        </p>
        {waiting ? (
          <div className="anon__waiting" role="status">
            <p>
              Waiting for someone to go live. Prefers 50%+; pairs best available
              so two people are not stranded. No fake peer video.
            </p>
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
        <p className="anon-chat__disclaimer">
          Antiporn filter is on by default once you connect. It covers likely
          NSFW regions. Not a medical or legal classifier.
        </p>
      </div>

      <div className="anon__preview">
        <div className="anon__preview-frame">
          {camera.stream ? (
            <FilteredVideo
              stream={camera.stream}
              muted
              mirrored
              localPreview
              filterOn={filter.enabled}
              severity={filter.severity}
              label="Your camera"
            />
          ) : (
            <div className="umingle-self__fallback anon__preview-fallback">
              <p>
                {camera.error ||
                  (camera.requesting ? 'Waiting for camera…' : 'Camera preview')}
              </p>
              <button type="button" className="btn btn--outline" onClick={camera.retry}>
                Enable camera
              </button>
            </div>
          )}
        </div>
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
        <ul className="anon__live-list" aria-label="Live phenotypes">
          {matches.map((item) => {
            const similarEnough = item.compatibility >= 50
            return (
              <li key={item.guestId ?? item.phenotype.id}>
                <button
                  type="button"
                  disabled={joining || !guestId || !item.guestId}
                  onClick={() => void openPeer(item.guestId, item.compatibility)}
                >
                  <span>{item.phenotype.name}</span>
                  <span>
                    {item.compatibility}% · {similarEnough ? '50%+' : 'best available'} · tap to chat
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
