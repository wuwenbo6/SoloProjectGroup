import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardMedia,
  Alert,
  CircularProgress
} from '@mui/material'
import {
  History,
  Restore,
  CompareArrows,
  ChevronRight,
  Close
} from '@mui/icons-material'
import { stitchAPI } from '../services/api'

const StitchHistoryViewer = ({ stitchId, onRestore }) => {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedVersions, setSelectedVersions] = useState([])
  const [compareDialogOpen, setCompareDialogOpen] = useState(false)
  const [compareData, setCompareData] = useState(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [versionToRestore, setVersionToRestore] = useState(null)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    if (stitchId) {
      fetchHistory()
    }
  }, [stitchId])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const response = await stitchAPI.getHistory(stitchId)
      setHistory(response.data)
      setError(null)
    } catch (err) {
      setError('加载历史记录失败')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleVersionClick = (version) => {
    if (selectedVersions.includes(version)) {
      setSelectedVersions(selectedVersions.filter(v => v !== version))
    } else if (selectedVersions.length < 2) {
      setSelectedVersions([...selectedVersions, version])
    }
  }

  const handleCompare = async () => {
    if (selectedVersions.length !== 2) return
    
    try {
      const [v1, v2] = selectedVersions.sort((a, b) => a - b)
      const response = await stitchAPI.compareVersions(stitchId, v1, v2)
      setCompareData(response.data)
      setCompareDialogOpen(true)
    } catch (err) {
      console.error('版本对比失败:', err)
    }
  }

  const handleRestoreClick = (version) => {
    setVersionToRestore(version)
    setRestoreDialogOpen(true)
  }

  const handleRestore = async () => {
    try {
      setRestoring(true)
      await stitchAPI.restoreVersion(stitchId, versionToRestore)
      if (onRestore) {
        onRestore()
      }
      setRestoreDialogOpen(false)
      setVersionToRestore(null)
      fetchHistory()
    } catch (err) {
      console.error('恢复版本失败:', err)
    } finally {
      setRestoring(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    )
  }

  if (history.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <History sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          暂无历史记录
        </Typography>
        <Typography variant="body2" color="text.secondary">
          修改针法后会自动保存历史版本
        </Typography>
      </Paper>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          历史版本 ({history.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<CompareArrows />}
          onClick={handleCompare}
          disabled={selectedVersions.length !== 2}
          size="small"
        >
          对比版本
        </Button>
      </Box>

      {selectedVersions.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          已选择 {selectedVersions.length} 个版本进行对比
          {selectedVersions.map(v => (
            <Chip
              key={v}
              label={`v${v}`}
              size="small"
              onDelete={() => setSelectedVersions(selectedVersions.filter(sv => sv !== v))}
              sx={{ ml: 1 }}
            />
          ))}
        </Alert>
      )}

      <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
        {history.map((item, index) => (
          <React.Fragment key={item.id}>
            <ListItem
              button
              onClick={() => handleVersionClick(item.version)}
              selected={selectedVersions.includes(item.version)}
              sx={{
                '&.Mui-selected': {
                  bgcolor: 'primary.lighter'
                }
              }}
            >
              <Box sx={{ mr: 2 }}>
                <Chip
                  label={`v${item.version}`}
                  color={selectedVersions.includes(item.version) ? 'primary' : 'default'}
                  size="small"
                />
              </Box>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1">
                      {item.name}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {item.change_note}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(item.created_at)}
                    </Typography>
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRestoreClick(item.version)
                  }}
                  color="primary"
                  title="恢复此版本"
                >
                  <Restore />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
            {index < history.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>

      <Dialog
        open={compareDialogOpen}
        onClose={() => setCompareDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            版本对比
            <IconButton onClick={() => setCompareDialogOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {compareData && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      版本 {compareData.version1.version}
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(compareData.version1.date)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {compareData.version1.change_note}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, bgcolor: 'primary.lighter' }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      版本 {compareData.version2.version}
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(compareData.version2.date)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {compareData.version2.change_note}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                字段变更
              </Typography>
              {Object.keys(compareData.field_changes).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  无字段变更
                </Typography>
              ) : (
                <List>
                  {Object.entries(compareData.field_changes).map(([field, changes]) => (
                    <ListItem key={field}>
                      <Grid container spacing={2}>
                        <Grid item xs={2}>
                          <Chip label={field} size="small" />
                        </Grid>
                        <Grid item xs={5}>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {changes.v1 || '(空)'}
                          </Typography>
                        </Grid>
                        <Grid item xs={1} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ChevronRight color="action" />
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="body2" color="primary" sx={{ whiteSpace: 'pre-wrap' }}>
                            {changes.v2 || '(空)'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </ListItem>
                  ))}
                </List>
              )}

              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                步骤变更
              </Typography>
              {compareData.steps_changes.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  无步骤变更
                </Typography>
              ) : (
                <List>
                  {compareData.steps_changes.map((change, index) => (
                    <ListItem key={index}>
                      <Box sx={{ width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Chip
                            label={`步骤 ${change.step}`}
                            size="small"
                            color={change.action === 'added' ? 'success' : change.action === 'removed' ? 'error' : 'primary'}
                          />
                          {change.action && (
                            <Typography variant="caption">
                              {change.action === 'added' ? '新增' : '删除'}
                            </Typography>
                          )}
                        </Box>
                        {change.changes && (
                          <List dense>
                            {Object.entries(change.changes).map(([key, values]) => (
                              <ListItem key={key}>
                                <Typography variant="caption" sx={{ mr: 1, minWidth: 80 }}>
                                  {key}:
                                </Typography>
                                <Typography variant="body2" sx={{ flex: 1 }}>
                                  {values.v1 || '(空)'}
                                </Typography>
                                <ChevronRight color="action" sx={{ mx: 1 }} />
                                <Typography variant="body2" color="primary" sx={{ flex: 1 }}>
                                  {values.v2 || '(空)'}
                                </Typography>
                              </ListItem>
                            ))}
                          </List>
                        )}
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompareDialogOpen(false)}>
            关闭
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={restoreDialogOpen}
        onClose={() => setRestoreDialogOpen(false)}
      >
        <DialogTitle>恢复版本</DialogTitle>
        <DialogContent>
          <Typography>
            确定要恢复到版本 v{versionToRestore} 吗？
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            当前版本将被保存为历史记录。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)}>
            取消
          </Button>
          <Button
            onClick={handleRestore}
            variant="contained"
            disabled={restoring}
          >
            {restoring ? '恢复中...' : '确认恢复'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default StitchHistoryViewer
