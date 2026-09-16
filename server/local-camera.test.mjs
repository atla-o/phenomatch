import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CAMERA_CONSTRAINTS,
  cameraErrorMessage,
  isAbortError,
  isPermissionDenied,
  requestLocalCamera,
} from '../shared/local-camera.mjs'

describe('local camera request', () => {
  it('maps permission vs missing-device errors', () => {
    assert.equal(isPermissionDenied({ name: 'NotAllowedError' }), true)
    assert.equal(isAbortError({ name: 'AbortError' }), true)
    assert.match(cameraErrorMessage({ name: 'NotAllowedError' }), /permission denied/i)
    assert.match(cameraErrorMessage({ name: 'NotFoundError' }), /No camera found/)
    assert.match(cameraErrorMessage({ name: 'NotReadableError' }), /in use/)
  })

  it('requests video-only constraints when audio is false', async () => {
    const tried = []
    const stream = { id: 'scan' }
    const result = await requestLocalCamera({
      audio: false,
      wait: async () => undefined,
      getUserMedia: async (constraints) => {
        tried.push(constraints)
        return stream
      },
    })
    assert.equal(result, stream)
    assert.equal(tried[0].audio, false)
    assert.equal(tried.every((item) => item.audio !== true), true)
  })

  it('falls back from facingMode + size to video:true', async () => {
    const tried = []
    const stream = { id: 'ok' }
    const result = await requestLocalCamera({
      wait: async () => undefined,
      getUserMedia: async (constraints) => {
        tried.push(constraints)
        if (constraints.video !== true) {
          throw Object.assign(new Error('overconstrained'), { name: 'OverconstrainedError' })
        }
        return stream
      },
    })
    assert.equal(result, stream)
    assert.deepEqual(tried[0], CAMERA_CONSTRAINTS[0])
    assert.equal(tried.at(-1).video, true)
  })

  it('retries AbortError once then uses the next constraint', async () => {
    let aborts = 0
    const stream = { id: 'recovered' }
    const result = await requestLocalCamera({
      wait: async () => undefined,
      getUserMedia: async (constraints) => {
        if (constraints.audio === true && typeof constraints.video === 'object') {
          aborts += 1
          throw Object.assign(new Error('aborted'), { name: 'AbortError' })
        }
        return stream
      },
    })
    assert.equal(result, stream)
    assert.ok(aborts >= 1)
  })

  it('does not keep prompting after permission denied', async () => {
    let calls = 0
    await assert.rejects(
      () =>
        requestLocalCamera({
          wait: async () => undefined,
          getUserMedia: async () => {
            calls += 1
            throw Object.assign(new Error('denied'), { name: 'NotAllowedError' })
          },
        }),
      (error) => error.name === 'NotAllowedError',
    )
    assert.equal(calls, 1)
  })

  it('uses enumerateDevices + deviceId when constraints fail', async () => {
    const stream = { id: 'device' }
    const result = await requestLocalCamera({
      wait: async () => undefined,
      getUserMedia: async (constraints) => {
        if (constraints.video?.deviceId?.exact === 'cam-2') return stream
        throw Object.assign(new Error('missing'), { name: 'NotFoundError' })
      },
      enumerateDevices: async () => [
        { kind: 'audioinput', deviceId: 'mic' },
        { kind: 'videoinput', deviceId: 'cam-2' },
      ],
    })
    assert.equal(result, stream)
  })

  it('stops when the remount abort signal fires', async () => {
    const controller = new AbortController()
    await assert.rejects(
      () =>
        requestLocalCamera({
          signal: controller.signal,
          wait: async () => {
            controller.abort()
          },
          getUserMedia: async () => ({ id: 'late' }),
        }),
      (error) => error.name === 'AbortError',
    )
  })
})
