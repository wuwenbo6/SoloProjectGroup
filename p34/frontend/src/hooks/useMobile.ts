import { useState, useEffect } from 'react'

interface UseMobileOptions {
  breakpoints?: {
    sm: number
    md: number
    lg: number
  }
}

export interface MobileInfo {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isIOS: boolean
  isAndroid: boolean
  isTouch: boolean
  isPortrait: boolean
  isLandscape: boolean
  screenWidth: number
  screenHeight: number
}

const DEFAULT_BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
}

export const useMobile = (options?: UseMobileOptions): MobileInfo => {
  const breakpoints = { ...DEFAULT_BREAKPOINTS, ...options?.breakpoints }

  const [screenInfo, setScreenInfo] = useState<MobileInfo>(() => {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isAndroid = /Android/.test(navigator.userAgent)

    return {
      isMobile: window.innerWidth < breakpoints.md,
      isTablet: window.innerWidth >= breakpoints.md && window.innerWidth < breakpoints.lg,
      isDesktop: window.innerWidth >= breakpoints.lg,
      isIOS,
      isAndroid,
      isTouch,
      isPortrait: window.innerHeight > window.innerWidth,
      isLandscape: window.innerWidth > window.innerHeight,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
    }
  })

  useEffect(() => {
    const handleResize = () => {
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isAndroid = /Android/.test(navigator.userAgent)

      setScreenInfo({
        isMobile: window.innerWidth < breakpoints.md,
        isTablet: window.innerWidth >= breakpoints.md && window.innerWidth < breakpoints.lg,
        isDesktop: window.innerWidth >= breakpoints.lg,
        isIOS,
        isAndroid,
        isTouch,
        isPortrait: window.innerHeight > window.innerWidth,
        isLandscape: window.innerWidth > window.innerHeight,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
      })
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [breakpoints.md, breakpoints.lg])

  return screenInfo
}

export const useVirtualKeyboard = () => {
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const handleResize = () => {
      if (visualViewport) {
        const heightDiff = window.innerHeight - visualViewport.height
        if (heightDiff > 100) {
          setKeyboardVisible(true)
          setKeyboardHeight(heightDiff)
        } else {
          setKeyboardVisible(false)
          setKeyboardHeight(0)
        }
      }
    }

    visualViewport?.addEventListener('resize', handleResize)
    return () => {
      visualViewport?.removeEventListener('resize', handleResize)
    }
  }, [])

  return { keyboardVisible, keyboardHeight }
}
