import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Map as MapIcon, Upload, ArrowLeft, ZoomIn, ZoomOut, Minus, Plus, Droplets, MapPin, Target, History, Users } from 'lucide-react';
import MapList from './components/MapList';
import MapEditor from './components/MapEditor';
import { socket } from './services/socket';

function App() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const userId = localStorage.getItem('userId') || 'user_' + Date.now();
    const userName = localStorage.getItem('userName') || '用户_' + userId.slice(-4);
    
    localStorage.setItem('userId', userId);
    localStorage.setItem('userName', userName);
    
    setCurrentUser({ id: userId, name: userName });
  }, []);

  if (!currentUser) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="app">
      <header className="header">
        <h1>
          <MapIcon size={24} />
          古地图标注系统
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Users size={20} />
          <span style={{ fontSize: '14px' }}>{currentUser.name}</span>
        </div>
      </header>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<MapList />} />
          <Route path="/map/:mapId" element={<MapEditor currentUser={currentUser} />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
