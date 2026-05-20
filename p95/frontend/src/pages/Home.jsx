import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { stitchAPI } from '../services/api'
import {
  Grid,
  Card,
  CardMedia,
  CardContent,
  Typography,
  Chip,
  Box,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'

const Home = () => {
  const [stitches, setStitches] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')

  useEffect(() => {
    fetchStitches()
  }, [search, category, difficulty])

  const fetchStitches = async () => {
    try {
      const params = {}
      if (search) params.search = search
      if (category) params.category = category
      if (difficulty) params.difficulty = difficulty
      
      const response = await stitchAPI.getAll(params)
      setStitches(response.data)
    } catch (err) {
      console.error('获取针法列表失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const categories = ['苏绣', '湘绣', '粤绣', '蜀绣', '汴绣', '其他']
  const difficulties = ['入门', '初级', '中级', '高级', '大师级']

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
        刺绣针法库
      </Typography>

      <Box sx={{ mb: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          placeholder="搜索针法..."
          variant="outlined"
          size="small"
          sx={{ width: 300 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>分类</InputLabel>
          <Select
            value={category}
            label="分类"
            onChange={(e) => setCategory(e.target.value)}
          >
            <MenuItem value="">全部</MenuItem>
            {categories.map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>难度</InputLabel>
          <Select
            value={difficulty}
            label="难度"
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <MenuItem value="">全部</MenuItem>
            {difficulties.map((d) => (
              <MenuItem key={d} value={d}>{d}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Typography>加载中...</Typography>
      ) : (
        <Grid container spacing={3}>
          {stitches.map((stitch) => (
            <Grid item xs={12} sm={6} md={4} key={stitch.id}>
              <Card sx={{ height: '100%', cursor: 'pointer' }}>
                <Link to={`/stitch/${stitch.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <CardMedia
                    component="img"
                    height="200"
                    image={stitch.image_url || 'https://picsum.photos/400/200?random=' + stitch.id}
                    alt={stitch.name}
                    sx={{ objectFit: 'cover' }}
                  />
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {stitch.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {stitch.description?.substring(0, 100)}...
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {stitch.category && (
                        <Chip label={stitch.category} size="small" color="primary" variant="outlined" />
                      )}
                      {stitch.difficulty && (
                        <Chip label={stitch.difficulty} size="small" color="secondary" variant="outlined" />
                      )}
                    </Box>
                  </CardContent>
                </Link>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {!loading && stitches.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            暂无匹配的针法
          </Typography>
        </Box>
      )}
    </Box>
  )
}

export default Home
