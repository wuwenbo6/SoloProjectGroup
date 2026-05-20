import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

const JoinRoom = ({ onJoin }) => {
  const [roomInput, setRoomInput] = useState('');

  const handleCreateRoom = () => {
    const newRoomId = uuidv4().slice(0, 8);
    onJoin(newRoomId);
  };

  const handleJoinRoom = () => {
    if (roomInput.trim()) {
      onJoin(roomInput.trim());
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleJoinRoom();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>3D Collaborative Editor</h1>
        <p style={styles.subtitle}>Edit 3D models together in real-time</p>
        
        <div style={styles.section}>
          <button style={styles.primaryButton} onClick={handleCreateRoom}>
            Create New Room
          </button>
        </div>

        <div style={styles.divider}>
          <span style={styles.dividerText}>or</span>
        </div>

        <div style={styles.section}>
          <input
            style={styles.input}
            type="text"
            placeholder="Enter room ID"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button style={styles.secondaryButton} onClick={handleJoinRoom}>
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    padding: '48px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    maxWidth: '400px',
    width: '100%',
    textAlign: 'center',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#1a1a2e',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '32px',
  },
  section: {
    marginBottom: '16px',
  },
  primaryButton: {
    width: '100%',
    padding: '14px 24px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  secondaryButton: {
    width: '100%',
    padding: '14px 24px',
    background: '#f3f4f6',
    color: '#374151',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '12px',
    transition: 'background 0.2s',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  divider: {
    position: 'relative',
    margin: '24px 0',
  },
  dividerText: {
    background: 'white',
    padding: '0 16px',
    color: '#9ca3af',
    fontSize: '14px',
  },
};

export default JoinRoom;
