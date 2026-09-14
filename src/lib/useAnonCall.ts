import { useCallback, useEffect, useRef, useState } from 'react'
import type { UmingleRoom, UmingleSignal } from '../api/client'
import {
  cachedIceServers,
  fetchAnonSignals,
  fetchIceServers,
  postAnonSignal,
  restartAnonCall,
} from '../api/client'
import { isOfferer } from './antiporn'
import {
  CONNECT_FAIL_COPY,
  ICE_FAIL_MS,
  ICE_RENEGOTIATE_MS,
  SIGNAL_POLL_MS,
} from '../../shared/anon-live.mjs'

function asInit(payload: Record<string, unknown>): RTCSessionDescriptionInit {
  return {
    type: payload.type as RTCSdpType,
    sdp: String(payload.sdp || ''),
  }
}

function mergeSignals(left: UmingleSignal[], right: UmingleSignal[]) {
  const byId = new Map<string, UmingleSignal>()
  for (const item of [...left, ...right]) {
    if (item?.id) byId.set(item.id, item)
  }
  return [...byId.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
}

type CallSession = {
  pc: RTCPeerConnection
  remote: MediaStream
  remoteReady: boolean
  iceQueue: RTCIceCandidateInit[]
  seen: Set<string>
  renegotiated: boolean
}

export function useAnonCall(
  room: UmingleRoom | null,
  guestId: string,
  localStream: MediaStream | null,
  onRoom?: (room: UmingleRoom) => void,
) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [connection, setConnection] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle')
  const [signalError, setSignalError] = useState<string | null>(null)
  const [polledSignals, setPolledSignals] = useState<UmingleSignal[]>([])
  const [polledCallId, setPolledCallId] = useState<string>('')
  const sessionRef = useRef<CallSession | null>(null)
  const roomId = room?.id || ''
  const callId = polledCallId || room?.callId || ''
  const peerId = room?.peer?.guestId || ''
  const ended = Boolean(room?.peerLeft || room?.endedAt)
  const roomSignals = room?.callId && room.callId === callId ? room.signals || [] : []
  const signals = mergeSignals(roomSignals, polledSignals)
  const signalKey = signals.map((item) => item.id).join('|')

  useEffect(() => {
    void fetchIceServers()
  }, [])

  useEffect(() => {
    if (!room?.callId) return
    setPolledCallId((current) => current || room.callId || '')
  }, [room?.callId])

  useEffect(() => {
    if (!roomId || !guestId || ended) return
    let cancelled = false

    const pull = async () => {
      try {
        const snap = await fetchAnonSignals(roomId, guestId)
        if (cancelled) return
        setPolledSignals(snap.signals || [])
        if (snap.callId) setPolledCallId(snap.callId)
      } catch {
        /* next poll */
      }
    }

    void pull()
    const timer = window.setInterval(() => {
      void pull()
    }, SIGNAL_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [ended, guestId, roomId])

  useEffect(() => {
    if (!roomId || !peerId || ended || !localStream) {
      sessionRef.current = null
      setRemoteStream(null)
      setConnection('idle')
      return
    }

    let cancelled = false
    const pc = new RTCPeerConnection({ iceServers: cachedIceServers() })
    const remote = new MediaStream()
    const session: CallSession = {
      pc,
      remote,
      remoteReady: false,
      iceQueue: [],
      seen: new Set(),
      renegotiated: false,
    }
    sessionRef.current = session
    setRemoteStream(null)
    setSignalError(null)
    setConnection('connecting')

    const syncState = () => {
      if (cancelled) return
      const ice = pc.iceConnectionState
      const conn = pc.connectionState
      if (conn === 'connected' || ice === 'connected' || ice === 'completed') {
        setConnection('connected')
        setSignalError(null)
        return
      }
      if (conn === 'failed' || ice === 'failed') {
        setConnection('failed')
        setSignalError(CONNECT_FAIL_COPY)
      }
    }

    pc.ontrack = (event) => {
      const tracks = event.streams[0]?.getTracks() ?? [event.track]
      for (const track of tracks) {
        if (!remote.getTracks().some((existing) => existing.id === track.id)) {
          remote.addTrack(track)
        }
      }
      setRemoteStream(remote)
    }
    pc.onconnectionstatechange = syncState
    pc.oniceconnectionstatechange = syncState
    pc.onicecandidate = (event) => {
      if (!event.candidate || cancelled) return
      void postAnonSignal(roomId, guestId, 'ice', event.candidate.toJSON() as Record<string, unknown>).catch(
        () => {
          if (!cancelled) setSignalError('Could not send a connection candidate.')
        },
      )
    }

    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream)
    }

    const postOffer = async (iceRestart = false) => {
      if (iceRestart) {
        const offer = await pc.createOffer({ iceRestart: true })
        await pc.setLocalDescription(offer)
        await postAnonSignal(roomId, guestId, 'offer', { type: offer.type, sdp: offer.sdp })
        return
      }
      if (pc.signalingState === 'have-local-offer' && pc.localDescription) {
        await postAnonSignal(roomId, guestId, 'offer', {
          type: pc.localDescription.type,
          sdp: pc.localDescription.sdp,
        })
        return
      }
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await postAnonSignal(roomId, guestId, 'offer', { type: offer.type, sdp: offer.sdp })
    }

    const start = async () => {
      try {
        if (isOfferer(guestId, peerId)) {
          await postOffer(false)
        }
      } catch {
        if (!cancelled) {
          setSignalError('Could not start the video connection.')
          setConnection('failed')
        }
      }
    }

    void start()

    const renegotiateTimer = window.setTimeout(() => {
      if (cancelled || pc.connectionState === 'connected') return
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') return
      if (!isOfferer(guestId, peerId) || session.renegotiated) return
      session.renegotiated = true
      void postOffer(true).catch(() => undefined)
    }, ICE_RENEGOTIATE_MS)

    const failTimer = window.setTimeout(() => {
      if (cancelled) return
      if (pc.connectionState === 'connected') return
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') return
      setConnection('failed')
      setSignalError(CONNECT_FAIL_COPY)
    }, ICE_FAIL_MS)

    return () => {
      cancelled = true
      window.clearTimeout(renegotiateTimer)
      window.clearTimeout(failTimer)
      if (sessionRef.current?.pc === pc) sessionRef.current = null
      pc.close()
    }
  }, [callId, ended, guestId, localStream, peerId, roomId])

  useEffect(() => {
    const session = sessionRef.current
    if (!session || !roomId || ended) return
    let cancelled = false

    const flushIce = async () => {
      session.remoteReady = true
      while (session.iceQueue.length) {
        const next = session.iceQueue.shift()
        if (!next) continue
        try {
          await session.pc.addIceCandidate(next)
        } catch {
          /* stale */
        }
      }
    }

    const apply = async (signal: UmingleSignal) => {
      if (signal.fromGuestId === guestId || session.seen.has(signal.id)) return
      session.seen.add(signal.id)
      try {
        if (signal.type === 'offer') {
          if (session.pc.signalingState === 'have-local-offer') return
          await session.pc.setRemoteDescription(asInit(signal.payload))
          await flushIce()
          const answer = await session.pc.createAnswer()
          await session.pc.setLocalDescription(answer)
          await postAnonSignal(roomId, guestId, 'answer', {
            type: answer.type,
            sdp: answer.sdp,
          })
        } else if (signal.type === 'answer') {
          if (session.pc.signalingState !== 'have-local-offer') return
          await session.pc.setRemoteDescription(asInit(signal.payload))
          await flushIce()
        } else if (signal.type === 'ice') {
          const candidate = signal.payload as RTCIceCandidateInit
          if (!session.remoteReady) {
            session.iceQueue.push(candidate)
            return
          }
          await session.pc.addIceCandidate(candidate)
        }
      } catch {
        if (!cancelled) setSignalError('Could not apply a WebRTC signal.')
      }
    }

    void (async () => {
      for (const signal of signals) {
        if (cancelled) return
        await apply(signal)
      }
    })()

    return () => {
      cancelled = true
    }
    // signalKey tracks new payloads; `signals` is read from this render.
    // callId remounts the PC so replay must run again on the new session.
  }, [callId, ended, guestId, roomId, signalKey])

  const retry = useCallback(async () => {
    if (!roomId || !guestId) return null
    setSignalError(null)
    setConnection('connecting')
    try {
      const next = await restartAnonCall(roomId, guestId)
      setPolledSignals([])
      setPolledCallId(next.callId || `retry-${Date.now()}`)
      onRoom?.(next)
      return next
    } catch {
      setConnection('failed')
      setSignalError(CONNECT_FAIL_COPY)
      return null
    }
  }, [guestId, onRoom, roomId])

  return { remoteStream, connection, signalError, retry }
}
