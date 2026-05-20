import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { stitchAPI, uploadAPI } from '../services/api'
import { compressAndResizeImage, validateImage } from '../utils/imageUtils'
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Card,
  CardMedia,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import UploadIcon from '@mui/icons-material/Upload'
import CloseIcon from '@mui/icons-material/Close'

const StitchConsole = () => {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [myStitches, setMyStitches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [openDialog, setOpenDialog] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    difficulty: '',
    image_url: '',
    video_url: '',
    steps: '',
    materials: '',
    tips: '',
    is_public: true
  })

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    fetchMyStitches()
  }, [isAuthenticated, navigate])

  const fetchMyStitches = async () => {
    try {
      const response = await stitchAPI.getMy()
      setMyStitches(response.data)
    } catch (err) {
      setError('获取针法列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const [imagePreview, setImagePreview] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef(null)

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const validation = validateImage(file)
    if (!validation.valid) {
      setError(validation.error)
      return
    }

    try {
      setError('')
      setImageUploading(true)
      setUploadProgress(20)

      const compressedFile = await compressAndResizeImage(file, 1200, 900, 0.85)
      setUploadProgress(50)

      const reader = new FileReader()
      reader.onload = (event) => {
        setImagePreview(event.target.result)
      }
      reader.readAsDataURL(compressedFile)
      setUploadProgress(70)

      const response = await uploadAPI.uploadImage(compressedFile)
      setUploadProgress(100)
      
      setFormData(prev => ({
        ...prev,
        image_url: response.data.url
      }))
      
      setTimeout(() => setUploadProgress(0), 1000)
    } catch (err) {
      setError('图片上传失败，请重试')
      setUploadProgress(0)
    } finally {
      setImageUploading(false)
    }
  }

  const handleRemoveImage = () => {
    setFormData(prev => ({
      ...prev,
      image_url: ''
    }))
    setImagePreview('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name) {
      setError('请输入针法名称')
      return
    }

    try {
      setError('')
      setLoading(true)
      
      if (editMode && editingId) {
        await stitchAPI.update(editingId, formData)
        setSuccess('针法更新成功')
      } else {
        await stitchAPI.create(formData)
        setSuccess('针法创建成功')
      }
      
      resetForm()
      fetchMyStitches()
    } catch (err) {
      setError(err.response?.data?.detail || '操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (stitch) => {
    setEditingId(stitch.id)
    setEditMode(true)
    setFormData({
      name: stitch.name,
      description: stitch.description || '',
      category: stitch.category || '',
      difficulty: stitch.difficulty || '',
      image_url: stitch.image_url || '',
      video_url: stitch.video_url || '',
      steps: stitch.steps || '',
      materials: stitch.materials || '',
      tips: stitch.tips || '',
      is_public: stitch.is_public
    })
    setImagePreview(stitch.image_url || '')
    setOpenDialog(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除这个针法吗？')) return
    
    try {
      await stitchAPI.delete(id)
      fetchMyStitches()
      setSuccess('针法删除成功')
    } catch (err) {
      setError('删除失败')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      difficulty: '',
      image_url: '',
      video_url: '',
      steps: '',
      materials: '',
      tips: '',
      is_public: true
    })
    setEditMode(false)
    setEditingId(null)
    setOpenDialog(false)
    setImagePreview('')
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const categories = ['苏绣', '湘绣', '粤绣', '蜀绣', '汴绣', '其他']
  const difficulties = ['入门', '初级', '中级', '高级', '大师级']

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4">针法采集操作台</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          新建针法
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Typography variant="h6" sx={{ mb: 3 }}>我的针法</Typography>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : myStitches.length > 0 ? (
        <Grid container spacing={3}>
          {myStitches.map((stitch) => (
            <Grid item xs={12} sm={6} md={4} key={stitch.id}>
              <Card>
                <CardMedia
                  component="img"
                  height="180"
                  image={stitch.image_url || 'https://picsum.photos/400/180?random=' + stitch.id}
                  alt={stitch.name}
                />
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>{stitch.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {stitch.category} · {stitch.difficulty}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleEdit(stitch)}
                    >
                      编辑
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDelete(stitch.id)}
                    >
                      删除
                    </Button>
                  </Box>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            还没有创建任何针法，点击上方按钮开始创建
          </Typography>
        </Paper>
      )}

      <Dialog open={openDialog} onClose={resetForm} maxWidth="md" fullWidth>
        <DialogTitle>
          {editMode ? '编辑针法' : '新建针法'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="针法名称"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="描述"
                  name="description"
                  multiline
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>分类</InputLabel>
                  <Select
                    name="category"
                    value={formData.category}
                    label="分类"
                    onChange={handleChange}
                  >
                    {categories.map((c) => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>难度</InputLabel>
                  <Select
                    name="difficulty"
                    value={formData.difficulty}
                    label="难度"
                    onChange={handleChange}
                  >
                    {difficulties.map((d) => (
                      <MenuItem key={d} value={d}>{d}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {uploadProgress > 0 && (
                    <Box sx={{ width: '100%' }}>
                      <LinearProgress variant="determinate" value={uploadProgress} />
                      <Typography variant="caption" color="text.secondary">
                        处理中... {uploadProgress}%
                      </Typography>
                    </Box>
                  )}
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<UploadIcon />}
                      disabled={imageUploading}
                    >
                      {imageUploading ? '处理中...' : '上传图片'}
                      <input
                        ref={fileInputRef}
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </Button>
                    {formData.image_url && (
                      <Typography variant="body2" color="success.main">
                        ✓ 已上传图片
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      支持 JPG、PNG、GIF、WebP，最大 5MB
                    </Typography>
                  </Box>

                  {imagePreview && (
                    <Box sx={{ position: 'relative', display: 'inline-block', maxWidth: 300 }}>
                      <CardMedia
                        component="img"
                        image={imagePreview}
                        alt="预览"
                        sx={{
                          width: '100%',
                          height: 'auto',
                          borderRadius: 1,
                          objectFit: 'contain',
                          maxHeight: 200,
                          backgroundColor: '#f5f5f5'
                        }}
                      />
                      <IconButton
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          color: 'white',
                          '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' }
                        }}
                        onClick={handleRemoveImage}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </Box>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="视频链接"
                  name="video_url"
                  value={formData.video_url}
                  onChange={handleChange}
                  placeholder="可选"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="操作步骤"
                  name="steps"
                  multiline
                  rows={4}
                  value={formData.steps}
                  onChange={handleChange}
                  placeholder="按步骤描述针法操作..."
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="所需材料"
                  name="materials"
                  multiline
                  rows={2}
                  value={formData.materials}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="技巧提示"
                  name="tips"
                  multiline
                  rows={2}
                  value={formData.tips}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_public}
                      onChange={handleChange}
                      name="is_public"
                    />
                  }
                  label="公开此针法（其他用户可见）"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={resetForm}>取消</Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? '保存中...' : (editMode ? '更新' : '创建')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  )
}

export default StitchConsole
