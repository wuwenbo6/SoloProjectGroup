import React, { useState, useEffect, useRef } from 'react'
import { Box, CircularProgress, Skeleton } from '@mui/material'

const LazyImage = ({
  src,
  alt,
  width = '100%',
  height = 200,
  objectFit = 'cover',
  onLoad,
  sx = {},
  skeletonVariant = 'rectangular'
}) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: '50px',
        threshold: 0.1
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const handleLoad = () => {
    setIsLoaded(true)
    if (onLoad) {
      onLoad()
    }
  }

  const handleError = () => {
    setHasError(true)
    setIsLoaded(true)
  }

  return (
    <Box
      ref={imgRef}
      sx={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        ...sx
      }}
    >
      {(!isLoaded || !isInView) && (
        <Skeleton
          variant={skeletonVariant}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
          }}
        />
      )}

      {isInView && !hasError && (
        <Box
          component="img"
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          sx={{
            width: '100%',
            height: '100%',
            objectFit,
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out'
          }}
        />
      )}

      {hasError && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'grey.100'
          }}
        >
          <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
            <Box sx={{ fontSize: 40, mb: 1 }}>🖼️</Box>
            <Box sx={{ fontSize: '0.875rem' }}>图片加载失败</Box>
          </Box>
        </Box>
      )}
    </Box>
  )
}

export default LazyImage
