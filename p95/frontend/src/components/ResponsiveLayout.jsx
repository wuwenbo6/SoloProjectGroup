import React from 'react'
import { Box, Container, useTheme, useMediaQuery } from '@mui/material'

export const ResponsiveContainer = ({
  children,
  maxWidth = 'lg',
  sx = {},
  disablePadding = false
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isTablet = useMediaQuery(theme.breakpoints.down('md'))

  return (
    <Container
      maxWidth={maxWidth}
      sx={{
        px: disablePadding ? 0 : (isMobile ? 1 : 2),
        py: disablePadding ? 0 : (isMobile ? 1 : 2),
        ...sx
      }}
    >
      {children}
    </Container>
  )
}

export const ResponsiveGrid = ({
  children,
  spacing = 2,
  columns = { xs: 1, sm: 2, md: 3, lg: 4 },
  sx = {}
}) => {
  const theme = useTheme()

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: `repeat(${columns.xs || 1}, 1fr)`,
          sm: `repeat(${columns.sm || 2}, 1fr)`,
          md: `repeat(${columns.md || 3}, 1fr)`,
          lg: `repeat(${columns.lg || 4}, 1fr)`
        },
        gap: spacing,
        ...sx
      }}
    >
      {children}
    </Box>
  )
}

export const MobileCard = ({ children, sx = {} }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  return (
    <Box
      sx={{
        borderRadius: isMobile ? 1 : 2,
        boxShadow: isMobile ? 1 : 2,
        bgcolor: 'background.paper',
        overflow: 'hidden',
        ...sx
      }}
    >
      {children}
    </Box>
  )
}

export const TouchFriendlyButton = ({ children, sx = {}, ...props }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  return (
    <Box
      component="button"
      sx={{
        minHeight: isMobile ? 44 : 'auto',
        minWidth: isMobile ? 44 : 'auto',
        ...sx
      }}
      {...props}
    >
      {children}
    </Box>
  )
}

export default {
  ResponsiveContainer,
  ResponsiveGrid,
  MobileCard,
  TouchFriendlyButton
}
