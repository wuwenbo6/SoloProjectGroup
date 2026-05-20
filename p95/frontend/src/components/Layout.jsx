import React from 'react'
import { AppBar, Toolbar, Typography, Button, Container, Box } from '@mui/material'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import EmojiObjectsIcon from '@mui/icons-material/EmojiObjects'

const Layout = ({ children }) => {
  const { user, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <EmojiObjectsIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>
              刺绣针法采集平台
            </Link>
          </Typography>
          <Button color="inherit" component={Link} to="/">
            针法库
          </Button>
          {isAuthenticated ? (
            <>
              <Button color="inherit" component={Link} to="/console">
                采集操作台
              </Button>
              <Button color="inherit" component={Link} to="/works">
                我的作品
              </Button>
              <Button color="inherit" onClick={handleLogout}>
                退出 ({user?.username})
              </Button>
            </>
          ) : (
            <>
              <Button color="inherit" component={Link} to="/login">
                登录
              </Button>
              <Button color="inherit" component={Link} to="/register">
                注册
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Container component="main" sx={{ mt: 4, mb: 4, flex: 1 }}>
        {children}
      </Container>
      <Box component="footer" sx={{ py: 3, bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" align="center">
            © 2024 刺绣针法采集平台 - 传承刺绣技艺
          </Typography>
        </Container>
      </Box>
    </Box>
  )
}

export default Layout
