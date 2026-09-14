/** Fixed phone frame. The shell is designed at this size, then scaled to the viewport. */

export const PHONE_DESIGN_WIDTH = 390
export const PHONE_DESIGN_HEIGHT = 844
export const PHONE_NARROW_MAX = 480

export function computePhoneScale(viewWidth, viewHeight, options = {}) {
  const width = Number(viewWidth)
  const height = Number(viewHeight)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 1
  }
  const explicit = Number(options.maxScale)
  const maxScale = Number.isFinite(explicit)
    ? explicit
    : width <= PHONE_NARROW_MAX
      ? Number.POSITIVE_INFINITY
      : 1
  return Math.min(width / PHONE_DESIGN_WIDTH, height / PHONE_DESIGN_HEIGHT, maxScale)
}

export function readViewportSize(win = globalThis) {
  const view = win?.visualViewport
  return {
    width: Number(view?.width || win?.innerWidth) || PHONE_DESIGN_WIDTH,
    height: Number(view?.height || win?.innerHeight) || PHONE_DESIGN_HEIGHT,
  }
}
