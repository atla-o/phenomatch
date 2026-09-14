export function videoConstraints({ audio = true } = {}) {
  const constraints = [
    {
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio,
    },
    { video: { facingMode: 'user' }, audio },
    { video: true, audio },
  ]
  constraints.push(audio ? { video: true } : { video: true, audio: false })
  return constraints
}

export const CAMERA_CONSTRAINTS = videoConstraints({ audio: true })

export function isAbortError(error) {
  return error?.name === 'AbortError'
}

export function isPermissionDenied(error) {
  const name = error?.name || ''
  return name === 'NotAllowedError' || name === 'PermissionDeniedError'
}

export function cameraErrorMessage(error) {
  const name = error?.name || ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera permission denied. Click Enable camera to try again.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera found. Connect a camera or pick another device.'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Camera is in use by another app. Close it and click Enable camera.'
  }
  if (name === 'SecurityError') {
    return 'Camera is blocked on this page. Allow camera for this site.'
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'This camera does not support the requested settings. Trying a simpler request…'
  }
  if (name === 'AbortError') {
    return 'Camera request was interrupted. Click Enable camera to try again.'
  }
  return 'Camera is blocked or missing. Enable it in Chrome to send video.'
}

function abortedError() {
  return Object.assign(new Error('aborted'), { name: 'AbortError' })
}

async function tryGetUserMedia(getUserMedia, constraints, signal, wait) {
  try {
    return await getUserMedia(constraints)
  } catch (error) {
    if (!isAbortError(error) || signal?.aborted) throw error
    await wait(160)
    if (signal?.aborted) throw abortedError()
    return getUserMedia(constraints)
  }
}

/**
 * @param {{
 *   getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
 *   enumerateDevices?: () => Promise<MediaDeviceInfo[]>,
 *   wait?: (ms: number) => Promise<void>,
 *   signal?: AbortSignal,
 *   audio?: boolean,
 * }} [options]
 * @returns {Promise<MediaStream>}
 */
export async function requestLocalCamera({
  getUserMedia,
  enumerateDevices,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  signal,
  audio = true,
} = {}) {
  const gum =
    getUserMedia ||
    (typeof navigator !== 'undefined' &&
      navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices))
  if (!gum) {
    throw Object.assign(new Error('Camera is not available in this browser.'), {
      name: 'NotFoundError',
    })
  }

  // React StrictMode opens then immediately stops the first stream. A short
  // delay lets that cleanup finish so remount does not hit AbortError / busy.
  await wait(80)
  if (signal?.aborted) throw abortedError()

  let lastError
  for (const constraints of videoConstraints({ audio })) {
    if (signal?.aborted) throw abortedError()
    try {
      return await tryGetUserMedia(gum, constraints, signal, wait)
    } catch (error) {
      lastError = error
      if (isPermissionDenied(error) || (isAbortError(error) && signal?.aborted)) throw error
    }
  }

  const listDevices =
    enumerateDevices ||
    (typeof navigator !== 'undefined' &&
      navigator.mediaDevices?.enumerateDevices?.bind(navigator.mediaDevices))
  if (listDevices) {
    try {
      const devices = await listDevices()
      const cameras = devices.filter((device) => device.kind === 'videoinput' && device.deviceId)
      for (const camera of cameras) {
        if (signal?.aborted) throw abortedError()
        try {
          return await tryGetUserMedia(
            gum,
            { video: { deviceId: { exact: camera.deviceId } }, audio: false },
            signal,
            wait,
          )
        } catch (error) {
          lastError = error
          if (isPermissionDenied(error) || (isAbortError(error) && signal?.aborted)) throw error
        }
      }
    } catch (error) {
      if (isPermissionDenied(error) || (isAbortError(error) && signal?.aborted)) throw error
      lastError = error
    }
  }

  throw lastError || Object.assign(new Error('Camera is blocked or missing.'), { name: 'NotFoundError' })
}
