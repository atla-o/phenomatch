/**
 * Antiporn skin / explicit box detector.
 * Ported from atla-o/antiporn `extension/detector.js` for Phenomatch Anon video.
 *
 * This is a heuristic region cover, not a medical or legal classifier.
 * Future upgrade path (do not block shipping): LSPD, C4Censor,
 * NSFW Data Source URLs, Falconsai/NSFWJS. Do not vendor those corpora here.
 */

export function isSkinPixel(r, g, b) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  const ycbcr = y > 38 && cb >= 72 && cb <= 132 && cr >= 128 && cr <= 178
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const v = max / 255
  const s = max === 0 ? 0 : (max - min) / max
  let h = 0
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min)) % 6
    else if (max === g) h = (b - r) / (max - min) + 2
    else h = (r - g) / (max - min) + 4
    h *= 60
    if (h < 0) h += 360
  }
  const hsv = v > 0.18 && v < 0.98 && s > 0.08 && s < 0.78 && (h <= 55 || h >= 340)
  const rgbRule = r > 70 && g > 30 && b > 15 && r > g && r > b && r - g > 8
  return ycbcr || (hsv && rgbRule)
}

function clusterRatio(cluster, pixels) {
  return cluster.count / Math.max(pixels, 1)
}

function clusterCenterY(cluster, height) {
  return (cluster.y0 + cluster.y1) / 2 / Math.max(height, 1)
}

export function detectNudity(image, severity, sourceWidth, sourceHeight, options = {}) {
  const localPreview = Boolean(options.localPreview)
  const { data, width: w, height: h } = image
  const pixels = w * h
  const mask = new Uint8Array(pixels)
  let skinCount = 0
  for (let i = 0; i < pixels; i++) {
    const o = i * 4
    if (data[o + 3] < 20) continue
    if (isSkinPixel(data[o], data[o + 1], data[o + 2])) {
      mask[i] = 1
      skinCount++
    }
  }
  const skinRatio = skinCount / pixels
  const visited = new Uint8Array(pixels)
  const clusters = []
  for (let i = 0; i < pixels; i++) {
    if (!mask[i] || visited[i]) continue
    let count = 0
    let x0 = w
    let y0 = h
    let x1 = 0
    let y1 = 0
    const stack = [i]
    visited[i] = 1
    while (stack.length) {
      const cur = stack.pop()
      count++
      const x = cur % w
      const y = (cur / w) | 0
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const n = ny * w + nx
          if (mask[n] && !visited[n]) {
            visited[n] = 1
            stack.push(n)
          }
        }
      }
    }
    if (count >= 8) clusters.push({ x0, y0, x1, y1, count })
  }
  clusters.sort((a, b) => b.count - a.count)
  const t = Math.max(0, Math.min(100, severity)) / 100
  const minRatio = (0.004 + t * 0.03) * (localPreview ? 1.6 : 1)
  const compactFloor = 0.22 + t * 0.28
  const multi = clusters.filter((c) => clusterRatio(c, pixels) >= 0.03).length >= 2
  const lowerHeavy = clusters.some(
    (c) => clusterCenterY(c, h) > 0.52 && clusterRatio(c, pixels) >= 0.04,
  )
  const explicitLikely =
    skinRatio >= 0.22 ||
    (clusters[0] && clusterRatio(clusters[0], pixels) >= 0.08 && skinRatio >= 0.12) ||
    multi
  // Face close-ups easily exceed skinRatio 0.22. A full hide needs lower-body
  // or multiple clusters — not a single upper/center skin patch.
  const strongExplicit = Boolean(lowerHeavy || (multi && skinRatio >= 0.16))
  const boxes = []
  const scaleX = sourceWidth / w
  const scaleY = sourceHeight / h
  const forceSignal = localPreview ? strongExplicit : explicitLikely
  for (const c of clusters) {
    const cw = c.x1 - c.x0 + 1
    const ch = c.y1 - c.y0 + 1
    const fill = c.count / Math.max(cw * ch, 1)
    const ratio = clusterRatio(c, pixels)
    const lowerBias = clusterCenterY(c, h) > 0.35 ? 1 : 0.75
    const hardScore = fill * lowerBias * Math.min(1, ratio / 0.05)
    const passSoft = ratio >= minRatio && fill >= 0.18
    const passHard = hardScore >= compactFloor && ratio >= minRatio
    const pass = t < 0.55 ? passSoft : passHard
    const force = forceSignal && ratio >= 0.012
    if (!pass && !force) continue
    const pw = cw * 1.08
    const ph = ch * 1.08
    const sizePx = Math.max(pw * scaleX, ph * scaleY)
    const mx = ((c.x0 + c.x1 + 1) / 2) * scaleX
    const my = ((c.y0 + c.y1 + 1) / 2) * scaleY
    boxes.push({
      x: mx - sizePx / 2,
      y: my - sizePx / 2,
      size: sizePx,
      kind: force || hardScore > 0.55 ? 'explicit' : 'skin',
    })
  }
  if (forceSignal && boxes.length === 0 && clusters[0]) {
    const c = clusters[0]
    const sizePx = Math.max((c.x1 - c.x0 + 1) * scaleX, (c.y1 - c.y0 + 1) * scaleY) * 1.15
    const mx = ((c.x0 + c.x1 + 1) / 2) * scaleX
    const my = ((c.y0 + c.y1 + 1) / 2) * scaleY
    boxes.push({ x: mx - sizePx / 2, y: my - sizePx / 2, size: sizePx, kind: 'explicit' })
  }
  return { boxes, explicitLikely, strongExplicit, skinRatio }
}

export function filterDecision(
  result,
  { enabled = true, hideOnExplicit = true, localPreview = false } = {},
) {
  if (!enabled || !result) {
    return { boxes: [], explicitLikely: false, strongExplicit: false, hide: false, skinRatio: 0 }
  }
  const strongExplicit = Boolean(result.strongExplicit)
  return {
    boxes: result.boxes || [],
    explicitLikely: Boolean(result.explicitLikely),
    strongExplicit,
    // Local self-preview never becomes a full Filtered wall. Remote still
    // hides, but only on stronger-than-skin-ratio signals.
    hide: Boolean(!localPreview && hideOnExplicit && strongExplicit),
    skinRatio: Number(result.skinRatio) || 0,
  }
}

export function rasterFromElement(el, maxWidth) {
  if (!el || typeof document === 'undefined') return null
  const sw = el.naturalWidth || el.videoWidth || el.width
  const sh = el.naturalHeight || el.videoHeight || el.height
  if (!sw || !sh) return null
  const scale = Math.min(1, (maxWidth || 120) / sw)
  const w = Math.max(8, Math.round(sw * scale))
  const h = Math.max(8, Math.round(sh * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  try {
    ctx.drawImage(el, 0, 0, w, h)
    return {
      image: ctx.getImageData(0, 0, w, h),
      width: el.clientWidth || sw,
      height: el.clientHeight || sh,
    }
  } catch {
    return null
  }
}
