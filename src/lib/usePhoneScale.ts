import { useEffect } from 'react'
import { computePhoneScale, readViewportSize } from '../../shared/phone-shell.mjs'

export function usePhoneScale() {
  useEffect(() => {
    const root = document.documentElement

    const apply = () => {
      const { width, height } = readViewportSize(window)
      root.style.setProperty('--phone-scale', String(computePhoneScale(width, height)))
      window.scrollTo(0, 0)
    }

    apply()
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)
    const view = window.visualViewport
    view?.addEventListener('resize', apply)
    view?.addEventListener('scroll', apply)
    return () => {
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
      view?.removeEventListener('resize', apply)
      view?.removeEventListener('scroll', apply)
    }
  }, [])
}
