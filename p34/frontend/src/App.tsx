import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Capture from './pages/Capture'
import Editor from './pages/Editor'
import Generator from './pages/Generator'
import Users from './pages/Users'
import Materials from './pages/Materials'
import Dashboard from './pages/Dashboard'
import Layout from './components/layout/Layout'
import { useAuthStore } from './store/authStore'

function PrivateRoute({ children, requiredRoles }: { children: React.ReactNode; requiredRoles?: string[] }) {
  const { isAuthenticated, user } = useAuthStore()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  
  return <Layout>{children}</Layout>
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
        <Route path="/capture" element={
          <PrivateRoute requiredRoles={['collector', 'designer', 'admin']}>
            <Capture />
          </PrivateRoute>
        } />
        <Route path="/editor/:id" element={
          <PrivateRoute requiredRoles={['designer', 'admin']}>
            <Editor />
          </PrivateRoute>
        } />
        <Route path="/generator" element={
          <PrivateRoute requiredRoles={['designer', 'admin']}>
            <Generator />
          </PrivateRoute>
        } />
        <Route path="/materials" element={
          <PrivateRoute>
            <Materials />
          </PrivateRoute>
        } />
        <Route path="/users" element={
          <PrivateRoute requiredRoles={['admin']}>
            <Users />
          </PrivateRoute>
        } />
      </Routes>
    </Router>
  )
}

export default App
