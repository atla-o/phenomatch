import { useEffect } from 'react'
import { computePhoneScale, readViewportSize } from '../../shared/phone-shell.mjs'

function applyPhoneScale() {
  const root = document.documentElement
  const { width, height, offsetLeft, offsetTop } = readViewportSize(window)
  root.style.setProperty('--phone-scale', String(computePhoneScale(width, height)))
  root.style.setProperty('--vv-w', `${width}px`)
  root.style.setProperty('--vv-h', `${height}px`)
  root.style.setProperty('--vv-x', `${offsetLeft}px`)
  root.style.setProperty('--vv-y', `${offsetTop}px`)
  window.scrollTo(0, 0)
}

export function usePhoneScale() {
  useEffect(() => {
    applyPhoneScale()
    window.addEventListener('resize', applyPhoneScale)
    window.addEventListener('orientationchange', applyPhoneScale)
    const view = window.visualViewport
    view?.addEventListener('resize', applyPhoneScale)
    view?.addEventListener('scroll', applyPhoneScale)
    return () => {
      window.removeEventListener('resize', applyPhoneScale)
      window.removeEventListener('orientationchange', applyPhoneScale)
      view?.removeEventListener('resize', applyPhoneScale)
      view?.removeEventListener('scroll', applyPhoneScale)
    }
  }, [])
}
