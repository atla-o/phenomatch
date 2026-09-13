import { useEffect, useRef, useState } from 'react'
import type { UmingleRoom, UmingleSignal } from '../api/client'
import { postAnonSignal } from '../api/client'
import { isOfferer } from './antiporn'

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]

function asInit(payload: Record<string, unknown>): RTCSessionDescriptionInit {
  return {
    type: payload.type as RTCSdpType,
    sdp: String(payload.sdp || ''),
  }
}

type CallSession = {
  pc: RTCPeerConnection
  remote: MediaStream
  remoteReady: boolean
  iceQueue: RTCIceCandidateInit[]
  seen: Set<string>
}

export function useAnonCall(
  room: UmingleRoom | null,
  guestId: string,
  localStream: MediaStream | null,
) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [connection, setConnection] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle')
  const [signalError, setSignalError] = useState<string | null>(null)
  const sessionRef = useRef<CallSession | null>(null)
  const roomId = room?.id || ''
  const callId = room?.callId || ''
  const peerId = room?.peer?.guestId || ''
  const ended = Boolean(room?.peerLeft || room?.endedAt)
  const signals = room?.signals || []
  const signalKey = signals.map((item) => item.id).join('|')

  useEffect(() => {
    if (!roomId || !peerId || ended || !localStream) {
      sessionRef.current = null
      setRemoteStream(null)
      setConnection('idle')
      return
    }

    let cancelled = false
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    const remote = new MediaStream()
    const session: CallSession = {
      pc,
      remote,
      remoteReady: false,
      iceQueue: [],
      seen: new Set(),
    }
    sessionRef.current = session
    setRemoteStream(null)
    setSignalError(null)
    setConnection('connecting')

    pc.ontrack = (event) => {
      const tracks = event.streams[0]?.getTracks() ?? [event.track]
      for (const track of tracks) {
        if (!remote.getTracks().some((existing) => existing.id === track.id)) {
          remote.addTrack(track)
        }
      }
      setRemoteStream(remote)
    }
    pc.onconnectionstatechange = () => {
      if (cancelled) return
      if (pc.connectionState === 'connected') setConnection('connected')
      if (pc.connectionState === 'failed') setConnection('failed')
      if (pc.connectionState === 'disconnected') setConnection('connecting')
    }
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

    const start = async () => {
      try {
        if (isOfferer(guestId, peerId)) {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          await postAnonSignal(roomId, guestId, 'offer', { type: offer.type, sdp: offer.sdp })
        }
      } catch {
        if (!cancelled) {
          setSignalError('Could not start the video connection.')
          setConnection('failed')
        }
      }
    }

    void start()

    return () => {
      cancelled = true
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
          if (session.pc.currentRemoteDescription) return
          await session.pc.setRemoteDescription(asInit(signal.payload))
          await flushIce()
          const answer = await session.pc.createAnswer()
          await session.pc.setLocalDescription(answer)
          await postAnonSignal(roomId, guestId, 'answer', {
            type: answer.type,
            sdp: answer.sdp,
          })
        } else if (signal.type === 'answer') {
          if (!session.pc.currentRemoteDescription) {
            await session.pc.setRemoteDescription(asInit(signal.payload))
            await flushIce()
          }
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
  }, [ended, guestId, roomId, signalKey])

  return { remoteStream, connection, signalError }
}
