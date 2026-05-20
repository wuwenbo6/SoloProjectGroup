import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { stitchAPI, workAPI } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material'
import ShareIcon from '@mui/icons-material/Share'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ColorLensIcon from '@mui/icons-material/ColorLens'

const StitchDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [stitch, setStitch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openShareDialog, setOpenShareDialog] = useState(false)
  const [workData, setWorkData] = useState({ title: '', description: '', image_url: '' })

  useEffect(() => {
    fetchStitch()
  }, [id])

  const fetchStitch = async () => {
    try {
      const response = await stitchAPI.getById(id)
      setStitch(response.data)
    } catch (err) {
      console.error('获取针法详情失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleShare = () => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    setOpenShareDialog(true)
  }

  const handleCreateWork = async () => {
    try {
      const work = await workAPI.create({
        ...workData,
        stitch_id: stitch.id
      })
      setOpenShareDialog(false)
      navigate(`/work/${work.data.id}`)
    } catch (err) {
      console.error('创建作品失败:', err)
    }
  }

  if (loading) {
    return <Typography>加载中...</Typography>
  }

  if (!stitch) {
    return <Typography>针法不存在</Typography>
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

      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ overflow: 'hidden' }}>
            <Box
              component="img"
              src={stitch.image_url || 'https://picsum.photos/600/400'}
              alt={stitch.name}
              sx={{ width: '100%', height: 'auto' }}
            />
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography variant="h4" gutterBottom>
            {stitch.name}
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
            {stitch.category && (
              <Chip label={stitch.category} color="primary" />
            )}
            {stitch.difficulty && (
              <Chip label={stitch.difficulty} color="secondary" />
            )}
          </Box>

          <Typography variant="body1" paragraph sx={{ mb: 3 }}>
            {stitch.description}
          </Typography>

          <Typography variant="subtitle2" color="text.secondary">
            创建者: {stitch.owner?.username}
          </Typography>

          <Button
            variant="contained"
            startIcon={<ShareIcon />}
            onClick={handleShare}
            sx={{ mt: 3 }}
            fullWidth
          >
            分享我的作品
          </Button>

          <Button
            component={Link}
            to={`/share/${stitch.id}`}
            variant="outlined"
            startIcon={<ColorLensIcon />}
            sx={{ mt: 2 }}
            fullWidth
          >
            查看针法分享
          </Button>
        </Grid>
      </Grid>

      {stitch.materials && (
        <Paper sx={{ mt: 4, p: 3 }}>
          <Typography variant="h6" gutterBottom>所需材料</Typography>
          <Typography variant="body1">{stitch.materials}</Typography>
        </Paper>
      )}

      {stitch.steps && (
        <Paper sx={{ mt: 4, p: 3 }}>
          <Typography variant="h6" gutterBottom>操作步骤</Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {stitch.steps}
          </Typography>
        </Paper>
      )}

      {stitch.tips && (
        <Paper sx={{ mt: 4, p: 3 }}>
          <Typography variant="h6" gutterBottom>技巧提示</Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {stitch.tips}
          </Typography>
        </Paper>
      )}

      <Dialog open={openShareDialog} onClose={() => setOpenShareDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>分享我的作品</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, mt: 1 }}>
            基于「{stitch.name}」针法，分享您的刺绣作品
          </Typography>
          <TextField
            fullWidth
            label="作品标题"
            sx={{ mb: 2, mt: 1 }}
            value={workData.title}
            onChange={(e) => setWorkData({ ...workData, title: e.target.value })}
          />
          <TextField
            fullWidth
            label="作品描述"
            multiline
            rows={3}
            value={workData.description}
            onChange={(e) => setWorkData({ ...workData, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenShareDialog(false)}>取消</Button>
          <Button variant="contained" onClick={handleCreateWork}>
            创建作品
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default StitchDetail
