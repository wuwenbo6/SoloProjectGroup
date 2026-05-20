import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { workAPI } from '../services/api'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Button,
  Paper,
  CircularProgress,
  Chip,
  Pagination,
  Stack,
  Skeleton,
  Alert
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import VisibilityIcon from '@mui/icons-material/Visibility'
import FavoriteIcon from '@mui/icons-material/Favorite'

const UserWorks = () => {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [works, setWorks] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    fetchWorks(1)
  }, [isAuthenticated, navigate])

  const fetchWorks = async (pageNum, append = false) => {
    try {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError('')
      
      const response = await workAPI.getMy({ page: pageNum, page_size: 12 })
      const { items, total: totalItems, total_pages } = response.data
      
      if (append) {
        setWorks(prev => [...prev, ...items])
      } else {
        setWorks(items)
      }
      setTotal(totalItems)
      setTotalPages(total_pages)
      setPage(pageNum)
    } catch (err) {
      console.error('获取作品列表失败:', err)
      setError('加载作品列表失败，请重试')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const handlePageChange = async (event, value) => {
    await fetchWorks(value, false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除这个作品吗？')) return
    
    try {
      setDeletingId(id)
      await workAPI.delete(id)
      setWorks(prev => prev.filter(w => w.id !== id))
      setTotal(prev => prev - 1)
    } catch (err) {
      console.error('删除失败:', err)
      setError('删除失败，请重试')
    } finally {
      setDeletingId(null)
    }
  }

  const renderSkeletons = () => (
    <Grid container spacing={3}>
      {[...Array(6)].map((_, index) => (
        <Grid item xs={12} sm={6} md={4} key={index}>
          <Card>
            <Skeleton variant="rectangular" height={200} animation="wave" />
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          我的作品
        </Typography>
        {total > 0 && (
          <Typography variant="body2" color="text.secondary">
            共 {total} 个作品
          </Typography>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        renderSkeletons()
      ) : works.length > 0 ? (
        <>
          <Grid container spacing={3}>
            {works.map((work) => (
              <Grid item xs={12} sm={6} md={4} key={work.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardMedia
                    component="img"
                    height="180"
                    image={work.image_url || 'https://picsum.photos/400/180?random=' + work.id}
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
                    {work.stitch && (
                      <Chip
                        label={`针法: ${work.stitch.name}`}
                        size="small"
                        variant="outlined"
                        component={Link}
                        to={`/stitch/${work.stitch.id}`}
                        clickable
                      />
                    )}
                  </CardContent>
                  <CardActions>
                    <Button size="small" startIcon={<FavoriteIcon />} disabled>
                      {work.likes_count || 0}
                    </Button>
                    <Button
                      size="small"
                      startIcon={<VisibilityIcon />}
                      component={Link}
                      to={`/work/${work.id}`}
                    >
                      查看
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={deletingId === work.id ? <CircularProgress size={16} /> : <DeleteIcon />}
                      onClick={() => handleDelete(work.id)}
                      disabled={deletingId === work.id}
                      sx={{ ml: 'auto' }}
                    >
                      删除
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
            还没有作品
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            去针法库看看，分享您的第一个作品吧！
          </Typography>
          <Button variant="contained" component={Link} to="/">
            浏览针法库
          </Button>
        </Paper>
      )}
    </Box>
  )
}

export default UserWorks
