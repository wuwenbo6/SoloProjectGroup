import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import StitchConsole from './pages/StitchConsole'
import StitchDetail from './pages/StitchDetail'
import SharePage from './pages/SharePage'
import UserWorks from './pages/UserWorks'
import WorkDetail from './pages/WorkDetail'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/console" element={<StitchConsole />} />
        <Route path="/stitch/:id" element={<StitchDetail />} />
        <Route path="/share/:id" element={<SharePage />} />
        <Route path="/works" element={<UserWorks />} />
        <Route path="/work/:id" element={<WorkDetail />} />
      </Routes>
    </Layout>
  )
}

export default App
