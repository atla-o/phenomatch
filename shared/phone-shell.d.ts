export const PHONE_DESIGN_WIDTH: number
export const PHONE_DESIGN_HEIGHT: number
export const PHONE_NARROW_MAX: number

export function computePhoneScale(
  viewWidth: number,
  viewHeight: number,
  options?: { maxScale?: number },
): number

export function readViewportSize(win?: Window): {
  width: number
  height: number
  offsetLeft: number
  offsetTop: number
}
