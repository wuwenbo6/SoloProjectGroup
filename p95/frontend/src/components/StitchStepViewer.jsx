import React, { useState, useEffect } from 'react'
import {
  Box,
  Grid,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Typography,
  Paper,
  Card,
  CardMedia,
  IconButton,
  useTheme,
  useMediaQuery,
  Chip,
  Zoom,
  Fab,
  Dialog,
  DialogContent
} from '@mui/material'
import {
  NavigateBefore,
  NavigateNext,
  ZoomIn,
  PlayArrow,
  Pause,
  LightbulbOutlined
} from '@mui/icons-material'
import { stitchAPI } from '../services/api'

const StitchStepViewer = ({ stitchId, steps: initialSteps }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isTablet = useMediaQuery(theme.breakpoints.down('md'))
  
  const [activeStep, setActiveStep] = useState(0)
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAutoPlaying, setIsAutoPlaying] = useState(false)
  const [imageZoomOpen, setImageZoomOpen] = useState(false)
  const [zoomImageUrl, setZoomImageUrl] = useState('')

  useEffect(() => {
    if (initialSteps && initialSteps.length > 0) {
      setSteps(initialSteps)
      setLoading(false)
    } else if (stitchId) {
      fetchSteps()
    }
  }, [stitchId, initialSteps])

  useEffect(() => {
    let interval = null
    if (isAutoPlaying && activeStep < steps.length - 1) {
      interval = setInterval(() => {
        setActiveStep(prev => prev + 1)
      }, 5000)
    } else if (activeStep === steps.length - 1) {
      setIsAutoPlaying(false)
    }
    return () => clearInterval(interval)
  }, [isAutoPlaying, activeStep, steps.length])

  const fetchSteps = async () => {
    try {
      const response = await stitchAPI.getSteps(stitchId)
      setSteps(response.data)
    } catch (err) {
      console.error('获取步骤失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1)
    }
  }

  const handleStepClick = (index) => {
    setActiveStep(index)
  }

  const handleImageZoom = (imageUrl) => {
    setZoomImageUrl(imageUrl)
    setImageZoomOpen(true)
  }

  const toggleAutoPlay = () => {
    setIsAutoPlaying(!isAutoPlaying)
  }

  const currentStep = steps[activeStep]

  if (loading) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography>加载步骤中...</Typography>
      </Paper>
    )
  }

  if (steps.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          暂无步骤演示
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          该针法还没有添加详细的操作步骤
        </Typography>
      </Paper>
    )
  }

  if (isMobile) {
    return (
      <Box>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            步骤 {activeStep + 1} / {steps.length}
          </Typography>
          <IconButton onClick={toggleAutoPlay} color={isAutoPlaying ? 'primary' : 'default'}>
            {isAutoPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
        </Box>

        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Zoom in={true}>
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                {currentStep?.title}
              </Typography>

              {currentStep?.image_url && (
                <Card sx={{ mb: 2, cursor: 'pointer' }} onClick={() => handleImageZoom(currentStep.image_url)}>
                  <CardMedia
                    component="img"
                    height={isMobile ? 200 : 300}
                    image={currentStep.image_url}
                    alt={currentStep.title}
                    sx={{ objectFit: 'cover' }}
                  />
                  <Box sx={{ position: 'relative' }}>
                    <Fab
                      size="small"
                      sx={{ position: 'absolute', bottom: 8, right: 8, opacity: 0.8 }}
                      onClick={() => handleImageZoom(currentStep.image_url)}
                    >
                      <ZoomIn />
                    </Fab>
                  </Box>
                </Card>
              )}

              {currentStep?.description && (
                <Typography variant="body1" paragraph sx={{ mb: 2 }}>
                  {currentStep.description}
                </Typography>
              )}

              {currentStep?.tips && (
                <Paper sx={{ p: 2, bgcolor: 'info.light', color: 'info.contrastText' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <LightbulbOutlined />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        小贴士
                      </Typography>
                      <Typography variant="body2">{currentStep.tips}</Typography>
                    </Box>
                  </Box>
                </Paper>
              )}
            </Box>
          </Zoom>
        </Paper>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<NavigateBefore />}
            onClick={handleBack}
            disabled={activeStep === 0}
          >
            上一步
          </Button>
          
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {steps.map((_, index) => (
              <Chip
                key={index}
                label={index + 1}
                size="small"
                color={index === activeStep ? 'primary' : 'default'}
                onClick={() => handleStepClick(index)}
                sx={{ cursor: 'pointer', minWidth: 32 }}
              />
            ))}
          </Box>

          <Button
            variant="contained"
            endIcon={<NavigateNext />}
            onClick={handleNext}
            disabled={activeStep === steps.length - 1}
          >
            下一步
          </Button>
        </Box>

        <Dialog
          open={imageZoomOpen}
          onClose={() => setImageZoomOpen(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogContent sx={{ p: 0 }}>
            <Box
              component="img"
              src={zoomImageUrl}
              sx={{ width: '100%', height: 'auto', display: 'block' }}
              alt="放大查看"
            />
          </DialogContent>
        </Dialog>
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          步骤演示 ({steps.length} 步)
        </Typography>
        <Button
          variant={isAutoPlaying ? 'contained' : 'outlined'}
          startIcon={isAutoPlaying ? <Pause /> : <PlayArrow />}
          onClick={toggleAutoPlay}
          size="small"
        >
          {isAutoPlaying ? '暂停演示' : '自动演示'}
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Stepper
            activeStep={activeStep}
            orientation="vertical"
            sx={{ '& .MuiStepLabel-root': { cursor: 'pointer' } }}
          >
            {steps.map((step, index) => (
              <Step key={step.id || index} onClick={() => handleStepClick(index)}>
                <StepLabel>
                  <Typography variant="subtitle2" sx={{ fontWeight: index === activeStep ? 'bold' : 'normal' }}>
                    {step.title}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Zoom in={true} key={activeStep}>
            <Paper sx={{ p: 3, minHeight: 400 }}>
              <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold', mb: 3 }}>
                步骤 {activeStep + 1}: {currentStep?.title}
              </Typography>

              {currentStep?.image_url && (
                <Card sx={{ mb: 3, cursor: 'pointer', maxWidth: 500 }} onClick={() => handleImageZoom(currentStep.image_url)}>
                  <CardMedia
                    component="img"
                    height={300}
                    image={currentStep.image_url}
                    alt={currentStep.title}
                    sx={{ objectFit: 'cover' }}
                  />
                  <Box sx={{ position: 'relative' }}>
                    <Fab
                      size="small"
                      sx={{ position: 'absolute', bottom: 16, right: 16, opacity: 0.8 }}
                      onClick={(e) => { e.stopPropagation(); handleImageZoom(currentStep.image_url); }}
                    >
                      <ZoomIn />
                    </Fab>
                  </Box>
                </Card>
              )}

              {currentStep?.description && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    操作说明
                  </Typography>
                  <Typography variant="body1" paragraph>
                    {currentStep.description}
                  </Typography>
                </Box>
              )}

              {currentStep?.tips && (
                <Paper sx={{ p: 3, bgcolor: 'info.light', color: 'info.contrastText' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <LightbulbOutlined fontSize="large" />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        技巧提示
                      </Typography>
                      <Typography variant="body1">{currentStep.tips}</Typography>
                    </Box>
                  </Box>
                </Paper>
              )}
            </Paper>
          </Zoom>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Button
              variant="outlined"
              startIcon={<NavigateBefore />}
              onClick={handleBack}
              disabled={activeStep === 0}
              size="large"
            >
              上一步
            </Button>
            <Button
              variant="contained"
              endIcon={<NavigateNext />}
              onClick={handleNext}
              disabled={activeStep === steps.length - 1}
              size="large"
            >
              下一步
            </Button>
          </Box>
        </Grid>
      </Grid>

      <Dialog
        open={imageZoomOpen}
        onClose={() => setImageZoomOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogContent sx={{ p: 0 }}>
          <Box
            component="img"
            src={zoomImageUrl}
            sx={{ width: '100%', height: 'auto', display: 'block' }}
            alt="放大查看"
          />
        </DialogContent>
      </Dialog>
    </Box>
  )
}

export default StitchStepViewer
