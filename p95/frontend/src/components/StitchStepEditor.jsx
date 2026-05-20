import React, { useState, useCallback } from 'react'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Grid,
  Card,
  CardMedia,
  Divider,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fab
} from '@mui/material'
import {
  Add,
  Delete,
  DragIndicator,
  ArrowUpward,
  ArrowDownward,
  Image as ImageIcon,
  Save
} from '@mui/icons-material'
import { stitchAPI } from '../services/api'
import { uploadAPI } from '../services/api'

const StitchStepEditor = ({ stitchId, initialSteps = [], onSave }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  
  const [steps, setSteps] = useState(initialSteps.map((step, index) => ({
    id: step.id,
    title: step.title || `步骤 ${index + 1}`,
    description: step.description || '',
    image_url: step.image_url || '',
    tips: step.tips || '',
    order: step.order || index + 1
  })))
  
  const [saving, setSaving] = useState(false)
  const [uploadingImageIndex, setUploadingImageIndex] = useState(null)

  const addStep = () => {
    const newStep = {
      title: `步骤 ${steps.length + 1}`,
      description: '',
      image_url: '',
      tips: '',
      order: steps.length + 1
    }
    setSteps([...steps, newStep])
  }

  const removeStep = (index) => {
    const newSteps = steps.filter((_, i) => i !== index)
    newSteps.forEach((step, i) => {
      step.order = i + 1
    })
    setSteps(newSteps)
  }

  const moveStep = (index, direction) => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === steps.length - 1) return

    const newSteps = [...steps]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    
    const temp = newSteps[index]
    newSteps[index] = newSteps[targetIndex]
    newSteps[targetIndex] = temp
    
    newSteps.forEach((step, i) => {
      step.order = i + 1
    })
    
    setSteps(newSteps)
  }

  const updateStep = (index, field, value) => {
    const newSteps = [...steps]
    newSteps[index][field] = value
    setSteps(newSteps)
  }

  const handleImageUpload = async (index, file) => {
    if (!file) return
    
    setUploadingImageIndex(index)
    
    try {
      const imageUrl = await uploadAPI.uploadImage(file)
      updateStep(index, 'image_url', imageUrl)
    } catch (err) {
      console.error('上传图片失败:', err)
    } finally {
      setUploadingImageIndex(null)
    }
  }

  const handleSave = async () => {
    if (!stitchId) {
      if (onSave) {
        onSave(steps)
      }
      return
    }

    setSaving(true)
    try {
      await stitchAPI.saveSteps(stitchId, steps)
      if (onSave) {
        onSave(steps)
      }
    } catch (err) {
      console.error('保存步骤失败:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          针法步骤编辑 ({steps.length} 步)
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={addStep}
          size="small"
        >
          添加步骤
        </Button>
      </Box>

      {steps.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            还没有添加任何步骤
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            点击上方"添加步骤"按钮，开始创建详细的针法步骤演示
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={addStep}
            sx={{ mt: 2 }}
          >
            添加第一个步骤
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {steps.map((step, index) => (
            <Grid item xs={12} key={index}>
              <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <DragIndicator sx={{ color: 'grey.400', mb: 1 }} />
                    <Fab size="small" color="primary" sx={{ width: 48, height: 48 }}>
                      {index + 1}
                    </Fab>
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={8}>
                        <TextField
                          fullWidth
                          label="步骤标题"
                          value={step.title}
                          onChange={(e) => updateStep(index, 'title', e.target.value)}
                          size="small"
                          required
                        />
                      </Grid>
                      <Grid item xs={12} sm={4} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => moveStep(index, 'up')}
                          disabled={index === 0}
                        >
                          <ArrowUpward />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => moveStep(index, 'down')}
                          disabled={index === steps.length - 1}
                        >
                          <ArrowDownward />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeStep(index)}
                        >
                          <Delete />
                        </IconButton>
                      </Grid>
                    </Grid>

                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ mt: 2 }}>
                          <TextField
                            fullWidth
                            multiline
                            rows={4}
                            label="步骤描述"
                            value={step.description}
                            onChange={(e) => updateStep(index, 'description', e.target.value)}
                            placeholder="详细描述这一步的操作方法..."
                            size="small"
                          />
                        </Box>

                        <Box sx={{ mt: 2 }}>
                          <TextField
                            fullWidth
                            multiline
                            rows={2}
                            label="技巧提示 (可选)"
                            value={step.tips}
                            onChange={(e) => updateStep(index, 'tips', e.target.value)}
                            placeholder="这一步的注意事项或小技巧..."
                            size="small"
                          />
                        </Box>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            步骤图片 (可选)
                          </Typography>
                          {step.image_url ? (
                            <Card sx={{ position: 'relative' }}>
                              <CardMedia
                                component="img"
                                height={isMobile ? 150 : 200}
                                image={step.image_url}
                                alt={step.title}
                                sx={{ objectFit: 'cover' }}
                              />
                              <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="error"
                                  onClick={() => updateStep(index, 'image_url', '')}
                                >
                                  删除
                                </Button>
                              </Box>
                            </Card>
                          ) : (
                            <Paper
                              sx={{
                                p: 3,
                                textAlign: 'center',
                                border: '2px dashed',
                                borderColor: 'divider',
                                bgcolor: 'grey.50',
                                cursor: 'pointer'
                              }}
                              component="label"
                            >
                              <input
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) {
                                    handleImageUpload(index, file)
                                  }
                                }}
                              />
                              <ImageIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                              <Typography variant="body2" color="text.secondary">
                                {uploadingImageIndex === index ? '上传中...' : '点击上传步骤图片'}
                              </Typography>
                            </Paper>
                          )}
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {steps.length > 0 && (
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<Save />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : '保存步骤'}
          </Button>
        </Box>
      )}
    </Box>
  )
}

export default StitchStepEditor
