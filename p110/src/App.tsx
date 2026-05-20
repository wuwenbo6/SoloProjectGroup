import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Annotate from './pages/Annotate';
import Projects from './pages/Projects';
import Versions from './pages/Versions';

function App() {
  const token = localStorage.getItem('token');

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={token ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/upload" element={token ? <Upload /> : <Navigate to="/login" />} />
          <Route path="/annotate/:imageId" element={token ? <Annotate /> : <Navigate to="/login" />} />
          <Route path="/projects" element={token ? <Projects /> : <Navigate to="/login" />} />
          <Route path="/versions/:imageId?" element={token ? <Versions /> : <Navigate to="/login" />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
