export type IceServer = {
  urls: string | string[]
  username?: string
  credential?: string
}

export const DEFAULT_STUN_SERVERS: IceServer[]
export const DEFAULT_ICE_SERVERS: IceServer[]

export function sanitizeIceServers(list: unknown): IceServer[] | null
export function parseIceServersJson(raw: unknown): IceServer[] | null
export function iceServersFromEnv(env?: Record<string, string | undefined>): IceServer[]
export function hasTurnServer(servers: IceServer[] | null | undefined): boolean
