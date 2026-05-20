import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Editor from './components/Editor';
import JoinRoom from './components/JoinRoom';
import { useCRDTStore } from './store/crdtStore';
import { useWebRTCStore } from './store/webrtcStore';

function App() {
  const [roomId, setRoomId] = useState('');
  const [userId, setUserId] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  
  const initCRDT = useCRDTStore(state => state.init);
  const initWebRTC = useWebRTCStore(state => state.init);
  const destroyCRDT = useCRDTStore(state => state.destroy);
  const destroyWebRTC = useWebRTCStore(state => state.destroy);

  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    if (!storedUserId) {
      const newUserId = uuidv4();
      localStorage.setItem('userId', newUserId);
      setUserId(newUserId);
    } else {
      setUserId(storedUserId);
    }
  }, []);

  const handleJoin = (room) => {
    setRoomId(room);
    initCRDT(room, userId);
    initWebRTC(room, userId);
    setIsJoined(true);
  };

  const handleLeave = () => {
    destroyCRDT();
    destroyWebRTC();
    setIsJoined(false);
    setRoomId('');
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {!isJoined ? (
        <JoinRoom onJoin={handleJoin} />
      ) : (
        <Editor roomId={roomId} userId={userId} onLeave={handleLeave} />
      )}
    </div>
  );
}

export default App;
