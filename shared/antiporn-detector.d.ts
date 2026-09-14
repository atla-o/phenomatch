export function isSkinPixel(r: number, g: number, b: number): boolean

export type FilterBox = { x: number; y: number; size: number; kind: 'explicit' | 'skin' }

export function detectNudity(
  image: { data: ArrayLike<number>; width: number; height: number },
  severity: number,
  sourceWidth: number,
  sourceHeight: number,
): { boxes: FilterBox[]; explicitLikely: boolean; skinRatio: number }

export function filterDecision(
  result: { boxes?: FilterBox[]; explicitLikely?: boolean; skinRatio?: number } | null,
  options?: { enabled?: boolean; hideOnExplicit?: boolean },
): { boxes: FilterBox[]; explicitLikely: boolean; hide: boolean; skinRatio: number }

export function rasterFromElement(
  el: {
    naturalWidth?: number
    videoWidth?: number
    width?: number
    naturalHeight?: number
    videoHeight?: number
    height?: number
    clientWidth?: number
    clientHeight?: number
  },
  maxWidth?: number,
): { image: ImageData; width: number; height: number } | null
