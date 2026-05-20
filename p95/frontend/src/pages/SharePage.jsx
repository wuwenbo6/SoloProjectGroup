import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { stitchAPI, workAPI } from '../services/api'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Button,
  Chip,
  Avatar,
  Paper,
  CircularProgress,
  Pagination,
  Stack,
  Skeleton
} from '@mui/material'
import FavoriteIcon from '@mui/icons-material/Favorite'
import ShareIcon from '@mui/icons-material/Share'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

const SharePage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [stitch, setStitch] = useState(null)
  const [works, setWorks] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchData = useCallback(async (pageNum = 1) => {
    try {
      if (pageNum === 1) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }
      
      const [stitchRes, worksRes] = await Promise.all([
        stitchAPI.getById(id),
        workAPI.getAll({ stitch_id: id, page: pageNum, page_size: 12 })
      ])
      setStitch(stitchRes.data)
      setWorks(worksRes.data.items)
      setTotal(worksRes.data.total)
      setTotalPages(worksRes.data.total_pages)
      setPage(pageNum)
    } catch (err) {
      console.error('获取数据失败:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [id])

  useEffect(() => {
    fetchData(1)
  }, [fetchData])

  const handlePageChange = async (event, value) => {
    await fetchData(value)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLike = async (workId) => {
    try {
      await workAPI.like(workId)
      setWorks(prev => prev.map(w => 
        w.id === workId ? { ...w, likes_count: (w.likes_count || 0) + 1 } : w
      ))
    } catch (err) {
      console.error('点赞失败:', err)
    }
  }

  const renderSkeletons = () => (
    <Grid container spacing={3}>
      {[...Array(6)].map((_, index) => (
        <Grid item xs={12} sm={6} md={4} key={index}>
          <Card sx={{ height: '100%' }}>
            <Skeleton variant="rectangular" height={220} animation="wave" />
            <CardContent>
              <Skeleton variant="text" height={32} animation="wave" />
              <Skeleton variant="text" height={20} animation="wave" />
              <Skeleton variant="text" width="60%" height={24} animation="wave" />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )

  if (loading) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mb: 2 }}
        >
          返回
        </Button>
        <Paper sx={{ p: 4, mb: 4, textAlign: 'center' }}>
          <Skeleton variant="text" width="60%" height={40} sx={{ margin: '0 auto' }} />
          <Skeleton variant="text" width="40%" height={24} sx={{ margin: '8px auto 0' }} />
        </Paper>
        {renderSkeletons()}
      </Box>
    )
  }

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(-1)}
        sx={{ mb: 2 }}
      >
        返回
      </Button>

      <Paper sx={{ p: 4, mb: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          {stitch?.name} - 作品分享
        </Typography>
        <Typography variant="body1" color="text.secondary">
          共 {total} 个作品使用此针法创作
        </Typography>
      </Paper>

      {works.length > 0 ? (
        <>
          <Grid container spacing={3}>
            {works.map((work) => (
              <Grid item xs={12} sm={6} md={4} key={work.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardMedia
                    component="img"
                    height="200"
                    image={work.image_url || 'https://picsum.photos/400/200?random=' + work.id}
                    alt={work.title}
                    sx={{ objectFit: 'cover' }}
                  />
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" gutterBottom noWrap>
                      {work.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {work.description?.substring(0, 60) || '暂无描述'}
                      {work.description?.length > 60 && '...'}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 24, height: 24 }}>
                        {work.owner?.username?.charAt(0)}
                      </Avatar>
                      <Typography variant="body2">
                        {work.owner?.username}
                      </Typography>
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<FavoriteIcon />}
                      onClick={() => handleLike(work.id)}
                    >
                      {work.likes_count || 0}
                    </Button>
                    <Button size="small" startIcon={<ShareIcon />}>
                      {work.shares_count || 0}
                    </Button>
                    <Button
                      size="small"
                      component={Link}
                      to={`/work/${work.id}`}
                      sx={{ ml: 'auto' }}
                    >
                      查看详情
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {loadingMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          )}

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Stack spacing={2}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={handlePageChange}
                  color="primary"
                  size="large"
                  showFirstButton
                  showLastButton
                />
              </Stack>
            </Box>
          )}
        </>
      ) : (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            还没有作品分享
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            成为第一个分享此针法作品的人吧！
          </Typography>
          <Button
            variant="contained"
            component={Link}
            to={`/stitch/${id}`}
          >
            分享我的作品
          </Button>
        </Paper>
      )}
    </Box>
  )
}

export default SharePage
