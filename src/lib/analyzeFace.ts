import { scoreFace } from '../../shared/face-traits.mjs'
import { detectLandmarks, getFaceLandmarker } from './faceLandmarker'

export type AnalyzedFace = ReturnType<typeof scoreFace> & {
  source: 'camera' | 'still'
}

export function canvasFromVideo(video: HTMLVideoElement) {
  const canvas = document.createElement('canvas')
  const width = video.videoWidth || 640
  const height = video.videoHeight || 480
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas_unavailable')
  ctx.drawImage(video, 0, 0, width, height)
  return canvas
}

export async function canvasFromFile(file: File) {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas_unavailable')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvas
}

export function imageDataOf(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas_unavailable')
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export async function analyzeCanvas(canvas: HTMLCanvasElement, source: 'camera' | 'still'): Promise<AnalyzedFace> {
  const landmarker = await getFaceLandmarker()
  const landmarks = detectLandmarks(landmarker, canvas)
  if (!landmarks) {
    const error = new Error('no_face')
    error.name = 'NoFaceError'
    throw error
  }
  const scored = scoreFace(landmarks, imageDataOf(canvas))
  return { ...scored, source }
}

export async function analyzeVideoFrame(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight) {
    const error = new Error('no_face')
    error.name = 'NoFaceError'
    throw error
  }
  return analyzeCanvas(canvasFromVideo(video), 'camera')
}
