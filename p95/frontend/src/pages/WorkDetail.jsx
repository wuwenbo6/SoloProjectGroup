import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { workAPI, commentAPI } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Button,
  Avatar,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  IconButton,
  Badge,
  Snackbar,
  Alert
} from '@mui/material'
import FavoriteIcon from '@mui/icons-material/Favorite'
import ShareIcon from '@mui/icons-material/Share'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SendIcon from '@mui/icons-material/Send'
import DeleteIcon from '@mui/icons-material/Delete'
import RefreshIcon from '@mui/icons-material/Refresh'
import CommentIcon from '@mui/icons-material/Comment'

const WorkDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [work, setWork] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [newCommentsCount, setNewCommentsCount] = useState(0)
  const [lastCommentTime, setLastCommentTime] = useState(null)
  const [notification, setNotification] = useState({ open: false, message: '', type: 'success' })
  const [submittingComment, setSubmittingComment] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pollIntervalRef = useRef(null)

  const fetchData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsRefreshing(true)
      const [workRes, commentsRes] = await Promise.all([
        workAPI.getById(id),
        commentAPI.getByWork(id)
      ])
      setWork(workRes.data)
      
      const newComments = commentsRes.data
      if (newComments.length > comments.length && lastCommentTime) {
        const latestCommentTime = new Date(newComments[0]?.created_at).getTime()
        if (latestCommentTime > lastCommentTime) {
          const count = newComments.filter(
            c => new Date(c.created_at).getTime() > lastCommentTime
          ).length
          setNewCommentsCount(prev => prev + count)
        }
      }
      
      setComments(newComments)
      if (newComments.length > 0) {
        setLastCommentTime(new Date(newComments[0].created_at).getTime())
      }
    } catch (err) {
      console.error('获取数据失败:', err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [id, comments.length, lastCommentTime])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    pollIntervalRef.current = setInterval(() => {
      fetchData(false)
    }, 10000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [fetchData])

  const handleRefreshComments = () => {
    fetchData(true)
    setNewCommentsCount(0)
  }

  const handleLike = async () => {
    try {
      await workAPI.like(work.id)
      setWork(prev => ({
        ...prev,
        likes_count: (prev.likes_count || 0) + 1
      }))
    } catch (err) {
      console.error('点赞失败:', err)
    }
  }

  const handleShare = async () => {
    try {
      await workAPI.share(work.id)
      setWork(prev => ({
        ...prev,
        shares_count: (prev.shares_count || 0) + 1
      }))
    } catch (err) {
      console.error('分享失败:', err)
    }
  }

  const handleSubmitComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim() || !isAuthenticated || submittingComment) return

    try {
      setSubmittingComment(true)
      const response = await commentAPI.create({
        content: newComment,
        work_id: work.id
      })
      setComments(prev => [response.data, ...prev])
      setNewComment('')
      setLastCommentTime(new Date(response.data.created_at).getTime())
      setNotification({
        open: true,
        message: '评论发表成功！',
        type: 'success'
      })
    } catch (err) {
      console.error('评论失败:', err)
      setNotification({
        open: true,
        message: '评论发表失败，请重试',
        type: 'error'
      })
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleDeleteComment = async (commentId) => {
    try {
      await commentAPI.delete(commentId)
      setComments(prev => prev.filter(c => c.id !== commentId))
      setNotification({
        open: true,
        message: '评论已删除',
        type: 'success'
      })
    } catch (err) {
      console.error('删除评论失败:', err)
      setNotification({
        open: true,
        message: '删除失败，请重试',
        type: 'error'
      })
    }
  }

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }))
  }

  if (loading) {
    return <Typography>加载中...</Typography>
  }

  if (!work) {
    return <Typography>作品不存在</Typography>
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
        <Grid item xs={12} md={7}>
          <Paper sx={{ overflow: 'hidden' }}>
            <Box
              component="img"
              src={work.image_url || 'https://picsum.photos/700/500'}
              alt={work.title}
              sx={{ width: '100%', height: 'auto' }}
            />
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Typography variant="h4" gutterBottom>
            {work.title}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <Avatar sx={{ width: 32, height: 32 }}>
              {work.owner?.username?.charAt(0)}
            </Avatar>
            <Typography variant="subtitle1">
              {work.owner?.username}
            </Typography>
          </Box>

          {work.stitch && (
            <Chip
              label={`针法: ${work.stitch.name}`}
              component={Link}
              to={`/stitch/${work.stitch.id}`}
              clickable
              sx={{ mb: 3 }}
            />
          )}

          <Typography variant="body1" paragraph sx={{ mb: 3 }}>
            {work.description}
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Button
              startIcon={<FavoriteIcon />}
              onClick={handleLike}
              variant="outlined"
            >
              点赞 ({work.likes_count || 0})
            </Button>
            <Button
              startIcon={<ShareIcon />}
              onClick={handleShare}
              variant="outlined"
            >
              分享 ({work.shares_count || 0})
            </Button>
          </Box>

          <Typography variant="caption" color="text.secondary">
            创建于: {new Date(work.created_at).toLocaleDateString('zh-CN')}
          </Typography>
        </Grid>
      </Grid>

      <Paper sx={{ mt: 4, p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CommentIcon />
            评论 ({comments.length})
          </Typography>
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={handleRefreshComments}
            disabled={isRefreshing}
          >
            {isRefreshing ? '刷新中...' : '刷新'}
            {newCommentsCount > 0 && (
              <Badge
                badgeContent={newCommentsCount}
                color="error"
                sx={{ ml: 1 }}
              />
            )}
          </Button>
        </Box>

        {newCommentsCount > 0 && (
          <Alert
            severity="info"
            sx={{ mb: 2, cursor: 'pointer' }}
            onClick={handleRefreshComments}
          >
            有 {newCommentsCount} 条新评论，点击查看
          </Alert>
        )}

        {isAuthenticated ? (
          <Box component="form" onSubmit={handleSubmitComment} sx={{ mb: 4 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="写下您的评论..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              sx={{ mb: 2 }}
              disabled={submittingComment}
            />
            <Button
              type="submit"
              variant="contained"
              endIcon={<SendIcon />}
              disabled={!newComment.trim() || submittingComment}
            >
              {submittingComment ? '发表中...' : '发表评论'}
            </Button>
          </Box>
        ) : (
          <Paper variant="outlined" sx={{ p: 2, mb: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              请 <Link to="/login">登录</Link> 后发表评论
            </Typography>
          </Paper>
        )}

        {comments.length > 0 ? (
          <List>
            {comments.map((comment, index) => (
              <React.Fragment key={comment.id}>
                {index > 0 && <Divider variant="inset" component="li" />}
                <ListItem alignItems="flex-start" secondaryAction={
                  user && user.id === comment.user_id && (
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleDeleteComment(comment.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )
                }>
                  <ListItemAvatar>
                    <Avatar>
                      {comment.user?.username?.charAt(0)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2">
                          {comment.user?.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(comment.created_at).toLocaleString('zh-CN')}
                        </Typography>
                      </Box>
                    }
                    secondary={comment.content}
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        ) : (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="body2" color="text.secondary">
              暂无评论，来发表第一条评论吧！
            </Typography>
          </Box>
        )}
      </Paper>

      <Snackbar
        open={notification.open}
        autoHideDuration={3000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.type}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default WorkDetail
