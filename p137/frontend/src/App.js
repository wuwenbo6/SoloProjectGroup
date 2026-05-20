import React, { useState } from 'react';
import './App.css';
import Whiteboard from './components/Whiteboard';
import Toolbar from './components/Toolbar';
import UserList from './components/UserList';
import { WhiteboardProvider } from './context/WhiteboardContext';

function App() {
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [userName, setUserName] = useState('');

  const handleJoin = () => {
    if (roomId && userName) {
      setJoined(true);
    }
  };

  if (!joined) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>协作画板</h1>
          <input
            type="text"
            placeholder="房间号"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="login-input"
          />
          <input
            type="text"
            placeholder="用户名"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="login-input"
          />
          <button onClick={handleJoin} className="login-button">
            加入房间
          </button>
        </div>
      </div>
    );
  }

  return (
    <WhiteboardProvider roomId={roomId} userName={userName}>
      <div className="app-container">
        <Toolbar />
        <div className="main-content">
          <UserList />
          <Whiteboard />
        </div>
      </div>
    </WhiteboardProvider>
  );
}

export default App;
