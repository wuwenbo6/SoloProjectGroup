import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import RepairStation from './pages/RepairStation';
import Album from './pages/Album';
import Share from './pages/Share';
import Layout from './components/Layout';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  const handleAuth = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
  };

  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/" /> : <Login onAuth={handleAuth} />
      } />
      <Route path="/register" element={
        isAuthenticated ? <Navigate to="/" /> : <Register onAuth={handleAuth} />
      } />
      <Route path="/share/:token" element={<Share />} />
      <Route path="/" element={
        isAuthenticated ? <Layout onLogout={handleLogout} /> : <Navigate to="/login" />
      }>
        <Route index element={<RepairStation />} />
        <Route path="album" element={<Album />} />
      </Route>
    </Routes>
  );
}

export default App;
