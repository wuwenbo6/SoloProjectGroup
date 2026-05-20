import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Chip,
  LinearProgress,
  Button,
  CircularProgress,
  useTheme,
  useMediaQuery
} from '@mui/material'
import { stitchAPI } from '../services/api'

const SimilarStitches = ({ stitchId, maxResults = 6 }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  
  const [similarStitches, setSimilarStitches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (stitchId) {
      fetchSimilarStitches()
    }
  }, [stitchId])

  const fetchSimilarStitches = async () => {
    try {
      setLoading(true)
      const response = await stitchAPI.getSimilar(stitchId, {
        limit: maxResults,
        min_similarity: 0.1
      })
      setSimilarStitches(response.data)
    } catch (err) {
      console.error('获取相似针法失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const getSimilarityColor = (similarity) => {
    if (similarity >= 0.7) return 'success'
    if (similarity >= 0.4) return 'primary'
    if (similarity >= 0.2) return 'warning'
    return 'default'
  }

  const getSimilarityLabel = (similarity) => {
    if (similarity >= 0.7) return '非常相似'
    if (similarity >= 0.4) return '比较相似'
    if (similarity >= 0.2) return '部分相似'
    return '略有相似'
  }

  if (loading) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={24} />
        <Typography variant="body2" sx={{ mt: 1 }}>
          正在查找相似针法...
        </Typography>
      </Paper>
    )
  }

  if (similarStitches.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          暂无相似针法推荐
        </Typography>
      </Paper>
    )
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        相似针法推荐
      </Typography>

      <Grid container spacing={2}>
        {similarStitches.map((stitch) => (
          <Grid item xs={12} sm={6} md={4} key={stitch.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {stitch.image_url ? (
                <CardMedia
                  component="img"
                  height={isMobile ? 120 : 140}
                  image={stitch.image_url}
                  alt={stitch.name}
                  sx={{ objectFit: 'cover' }}
                />
              ) : (
                <Box
                  sx={{
                    height: isMobile ? 120 : 140,
                    bgcolor: 'grey.100',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    无图片
                  </Typography>
                </Box>
              )}

              <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                <Typography variant="subtitle1" gutterBottom noWrap sx={{ fontWeight: 'medium' }}>
                  {stitch.name}
                </Typography>

                <Box sx={{ mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      相似度
                    </Typography>
                    <Chip
                      label={getSimilarityLabel(stitch.similarity)}
                      size="small"
                      color={getSimilarityColor(stitch.similarity)}
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.65rem' }}
                    />
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={stitch.similarity * 100}
                    color={getSimilarityColor(stitch.similarity)}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}>
                    {Math.round(stitch.similarity * 100)}%
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {stitch.category && (
                    <Chip label={stitch.category} size="small" variant="outlined" />
                  )}
                  {stitch.difficulty && (
                    <Chip label={stitch.difficulty} size="small" variant="outlined" color="primary" />
                  )}
                </Box>
              </CardContent>

              <Box sx={{ p: 1, pt: 0 }}>
                <Button
                  fullWidth
                  size="small"
                  variant="outlined"
                  onClick={() => window.location.href = `#/stitch/${stitch.id}`}
                >
                  查看详情
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

export default SimilarStitches
