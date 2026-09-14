const MEDIAPIPE_VERSION = '0.10.32'
const WASM_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

type FaceLandmarkerLike = {
  detect: (image: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement) => {
    faceLandmarks?: Array<Array<{ x: number; y: number; z?: number }>>
  }
  close?: () => void
}

type VisionModule = {
  FilesetResolver: {
    forVisionTasks: (path: string) => Promise<unknown>
  }
  FaceLandmarker: {
    createFromOptions: (
      fileset: unknown,
      options: Record<string, unknown>,
    ) => Promise<FaceLandmarkerLike>
  }
}

let landmarkerPromise: Promise<FaceLandmarkerLike> | null = null

async function loadVision(): Promise<VisionModule> {
  try {
    return (await import('@mediapipe/tasks-vision')) as unknown as VisionModule
  } catch {
    return (await import(
      /* @vite-ignore */ `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/+esm`
    )) as unknown as VisionModule
  }
}

async function createWithDelegate(vision: VisionModule, fileset: unknown, delegate: 'GPU' | 'CPU') {
  return vision.FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate,
    },
    runningMode: 'IMAGE',
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  })
}

export async function getFaceLandmarker(): Promise<FaceLandmarkerLike> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await loadVision()
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_CDN)
      try {
        return await createWithDelegate(vision, fileset, 'GPU')
      } catch {
        return createWithDelegate(vision, fileset, 'CPU')
      }
    })().catch((error) => {
      landmarkerPromise = null
      throw error
    })
  }
  return landmarkerPromise
}

export function detectLandmarks(
  landmarker: FaceLandmarkerLike,
  image: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
) {
  const result = landmarker.detect(image)
  return result.faceLandmarks?.[0] || null
}
