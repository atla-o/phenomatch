export const CAMERA_CONSTRAINTS: MediaStreamConstraints[]

export function isAbortError(error: { name?: string } | null | undefined): boolean

export function isPermissionDenied(error: { name?: string } | null | undefined): boolean

export function cameraErrorMessage(error: { name?: string } | null | undefined): string

export function requestLocalCamera(options?: {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  enumerateDevices?: () => Promise<MediaDeviceInfo[]>
  wait?: (ms: number) => Promise<void>
  signal?: AbortSignal
}): Promise<MediaStream>
