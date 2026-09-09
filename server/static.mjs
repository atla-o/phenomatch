import fs from 'node:fs'
import path from 'node:path'

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

export function resolveStaticDir(cwd = process.cwd()) {
  return path.resolve(process.env.STATIC_DIR || path.join(cwd, 'dist'))
}

export function staticIndexPath(root = resolveStaticDir()) {
  return path.join(root, 'index.html')
}

export function hasStaticUi(root = resolveStaticDir()) {
  try {
    return fs.statSync(staticIndexPath(root)).isFile()
  } catch {
    return false
  }
}

export function resolveStaticPath(root, urlPath) {
  let decoded
  try {
    decoded = decodeURIComponent(urlPath || '/')
  } catch {
    return null
  }

  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')
  const dest = path.resolve(root, relative)
  const rootAbs = path.resolve(root)
  const prefix = rootAbs.endsWith(path.sep) ? rootAbs : `${rootAbs}${path.sep}`
  if (dest !== rootAbs && !dest.startsWith(prefix)) return null
  return dest
}

function mimeFor(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
}

function existingFile(filePath) {
  try {
    const stat = fs.statSync(filePath)
    if (stat.isFile()) return filePath
    if (stat.isDirectory()) {
      const nested = path.join(filePath, 'index.html')
      if (fs.statSync(nested).isFile()) return nested
    }
  } catch {
    /* missing */
  }
  return null
}

export function serveStatic(req, res, urlPath, root = resolveStaticDir()) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  if (!hasStaticUi(root)) return false

  const resolved = resolveStaticPath(root, urlPath)
  const filePath = (resolved && existingFile(resolved)) || existingFile(staticIndexPath(root))
  if (!filePath) return false

  const ext = path.extname(filePath).toLowerCase()
  const headers = {
    'content-type': mimeFor(filePath),
    'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
  }

  if (req.method === 'HEAD') {
    res.writeHead(200, headers)
    res.end()
    return true
  }

  res.writeHead(200, headers)
  fs.createReadStream(filePath).pipe(res)
  return true
}
