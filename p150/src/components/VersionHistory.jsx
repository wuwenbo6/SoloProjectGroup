import React, { useEffect, useState } from 'react';
import { useWebRTCStore } from '../store/webrtcStore';

const VersionHistory = ({ onClose, roomId }) => {
  const [versions, setVersions] = useState([]);
  const rollbackVersion = useWebRTCStore(state => state.rollbackVersion);

  useEffect(() => {
    fetch(`http://localhost:8080/api/versions/${roomId}`)
      .then(res => res.json())
      .then(data => setVersions(data))
      .catch(err => console.error('Failed to fetch versions:', err));
  }, [roomId]);

  const handleRollback = async (versionId) => {
    if (confirm('Are you sure you want to roll back to this version?')) {
      rollbackVersion(versionId);
      onClose();
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Version History</h2>
          <button style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.content}>
          {versions.length === 0 ? (
            <p style={styles.emptyMessage}>No versions saved yet</p>
          ) : (
            <div style={styles.versionList}>
              {versions.map((version, index) => (
                <div key={version._id} style={styles.versionItem}>
                  <div style={styles.versionInfo}>
                    <div style={styles.versionNumber}>
                      v{versions.length - index}
                    </div>
                    <div style={styles.versionDetails}>
                      <p style={styles.versionDate}>
                        {formatDate(version.createdAt)}
                      </p>
                      <p style={styles.versionUser}>
                        User: {version.userId?.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                  <button
                    style={styles.rollbackButton}
                    onClick={() => handleRollback(version._id)}
                  >
                    Rollback
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#16213e',
    borderRadius: '12px',
    width: '500px',
    maxHeight: '80vh',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #0f3460',
  },
  title: {
    color: '#e2e8f0',
    fontSize: '18px',
    fontWeight: '600',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'all 0.2s',
  },
  content: {
    padding: '24px',
    maxHeight: '60vh',
    overflowY: 'auto',
  },
  emptyMessage: {
    color: '#64748b',
    textAlign: 'center',
    padding: '40px',
    fontSize: '14px',
  },
  versionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  versionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    background: '#1e293b',
    borderRadius: '8px',
    border: '1px solid #334155',
  },
  versionInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  versionNumber: {
    width: '48px',
    height: '48px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  versionDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  versionDate: {
    color: '#e2e8f0',
    fontSize: '14px',
    fontWeight: '500',
    margin: 0,
  },
  versionUser: {
    color: '#64748b',
    fontSize: '12px',
    margin: 0,
  },
  rollbackButton: {
    padding: '8px 16px',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};

export default VersionHistory;
