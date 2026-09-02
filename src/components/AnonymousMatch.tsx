import { useEffect, useState } from 'react'
import type { Phenotype } from '../types'
import { joinAnonLive, type UmingleRoom } from '../api/client'
import { UmingleChat } from './UmingleChat'

type Props = {
  phenotype: Phenotype
  hasProfile: boolean
}

export function AnonymousMatch({ phenotype, hasProfile }: Props) {
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guestId, setGuestId] = useState<string | null>(null)
  const [room, setRoom] = useState<UmingleRoom | null>(null)

  const connect = async (skipPeerId?: string) => {
    setJoining(true)
    setError(null)
    try {
      const result = await joinAnonLive(phenotype, skipPeerId)
      setGuestId(result.guest.id)
      setRoom(result.room)
    } catch {
      setError('Could not start a live chat.')
    } finally {
      setJoining(false)
    }
  }

  useEffect(() => {
    if (!hasProfile) return
    void connect()
  }, [hasProfile, phenotype.id])

  if (!hasProfile) {
    return (
      <div className="match__empty">
        <p>Complete your phenotype scan in Pheno to use anon match.</p>
      </div>
    )
  }

  if (joining && !room) {
    return (
      <div className="match__empty">
        <p>Finding someone with a similar phenotype (50%+)…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="match__empty">
        <p>{error}</p>
        <button type="button" className="btn btn--outline" onClick={() => void connect()}>
          Try again
        </button>
      </div>
    )
  }

  if (!room || !guestId) {
    return (
      <div className="match__empty">
        <p>No similar phenotype online (50%+).</p>
        <button type="button" className="btn btn--outline" onClick={() => void connect()}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <UmingleChat
      room={room}
      guestId={guestId}
      onRoom={setRoom}
      onNext={() => void connect(room.peer?.guestId)}
    />
  )
}
