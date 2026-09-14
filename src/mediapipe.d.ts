declare module '@mediapipe/tasks-vision' {
  export const FilesetResolver: {
    forVisionTasks: (path: string) => Promise<unknown>
  }
  export const FaceLandmarker: {
    createFromOptions: (
      fileset: unknown,
      options: Record<string, unknown>,
    ) => Promise<{
      detect: (image: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement) => {
        faceLandmarks?: Array<Array<{ x: number; y: number; z?: number }>>
      }
      close?: () => void
    }>
  }
}
