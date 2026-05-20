import React, { useState, useEffect, useRef } from 'react';
import { useCRDTStore } from '../store/crdtStore';
import { v4 as uuidv4 } from 'uuid';

const AnimationEditor = ({ selectedNode, onClose }) => {
  const {
    animations,
    currentSceneId,
    scenes,
    createAnimation,
    deleteAnimation,
    addKeyframe,
    removeKeyframe,
    setAnimationTime,
    setAnimationPlaying,
    setAnimationSpeed,
    setAnimationLoop,
    setActiveAnimation,
    renameAnimation,
    interpolateKeyframes,
  } = useCRDTStore();

  const [selectedAnimationId, setSelectedAnimationId] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLooping, setIsLooping] = useState(true);
  const [showTracks, setShowTracks] = useState({ position: true, rotation: true, scale: true });
  const [editingName, setEditingName] = useState(null);
  const [newName, setNewName] = useState('');

  const animationFrameRef = useRef(null);
  const timelineRef = useRef(null);

  const currentScene = scenes[currentSceneId];
  const activeAnimationId = currentScene?.activeAnimationId;
  const activeAnimation = animations[activeAnimationId];

  useEffect(() => {
    if (activeAnimation) {
      setSelectedAnimationId(activeAnimationId);
      setCurrentTime(activeAnimation.currentTime || 0);
      setIsPlaying(activeAnimation.isPlaying || false);
      setPlaybackSpeed(activeAnimation.playbackSpeed || 1);
      setIsLooping(activeAnimation.loop !== undefined ? activeAnimation.loop : true);
    }
  }, [activeAnimationId, activeAnimation]);

  useEffect(() => {
    if (isPlaying && selectedAnimationId && activeAnimation) {
      const animate = () => {
        setCurrentTime((prevTime) => {
          let newTime = prevTime + (1 / 60) * playbackSpeed;
          if (newTime > activeAnimation.duration) {
            if (isLooping) {
              newTime = 0;
            } else {
              setIsPlaying(false);
              return activeAnimation.duration;
            }
          }
          setAnimationTime(selectedAnimationId, newTime);
          return newTime;
        });
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, selectedAnimationId, playbackSpeed, isLooping, activeAnimation, setAnimationTime]);

  const handleCreateAnimation = () => {
    if (!selectedNode) return;
    const animationId = `anim_${uuidv4().slice(0, 8)}`;
    createAnimation(animationId, `Animation ${Object.keys(animations).length + 1}`, selectedNode);
    setSelectedAnimationId(animationId);
  };

  const handleDeleteAnimation = (animationId) => {
    if (confirm('Delete this animation?')) {
      deleteAnimation(animationId);
      if (selectedAnimationId === animationId) {
        setSelectedAnimationId(null);
      }
    }
  };

  const handleAddKeyframe = (trackType) => {
    if (!selectedAnimationId) return;
    const animation = animations[selectedAnimationId];
    if (!animation) return;

    let value;
    switch (trackType) {
      case 'position':
        value = { x: 0, y: 0, z: 0 };
        break;
      case 'rotation':
        value = { x: 0, y: 0, z: 0 };
        break;
      case 'scale':
        value = { x: 1, y: 1, z: 1 };
        break;
    }

    addKeyframe(selectedAnimationId, trackType, currentTime, value);
  };

  const handleTimelineClick = (e) => {
    if (!timelineRef.current || !activeAnimation) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * activeAnimation.duration;
    setCurrentTime(Math.max(0, Math.min(time, activeAnimation.duration)));
    setAnimationTime(selectedAnimationId, time);
  };

  const handleKeyframeClick = (e, trackType, time) => {
    e.stopPropagation();
    if (e.shiftKey) {
      removeKeyframe(selectedAnimationId, trackType, time);
    }
  };

  const handlePlayPause = () => {
    if (!selectedAnimationId) return;
    const newIsPlaying = !isPlaying;
    setIsPlaying(newIsPlaying);
    setAnimationPlaying(selectedAnimationId, newIsPlaying);
  };

  const handleSpeedChange = (e) => {
    const speed = parseFloat(e.target.value);
    setPlaybackSpeed(speed);
    if (selectedAnimationId) {
      setAnimationSpeed(selectedAnimationId, speed);
    }
  };

  const handleLoopChange = () => {
    const newLoop = !isLooping;
    setIsLooping(newLoop);
    if (selectedAnimationId) {
      setAnimationLoop(selectedAnimationId, newLoop);
    }
  };

  const handleRenameAnimation = (animationId) => {
    setEditingName(animationId);
    setNewName(animations[animationId]?.name || '');
  };

  const handleSaveName = (animationId) => {
    if (newName.trim()) {
      renameAnimation(animationId, newName.trim());
    }
    setEditingName(null);
  };

  const handleSetActive = (animationId) => {
    setActiveAnimation(animationId);
    setSelectedAnimationId(animationId);
  };

  const nodeAnimations = Object.values(animations).filter(a => a.nodeId === selectedNode);

  const renderTrack = (trackType, label, color) => {
    const track = activeAnimation?.tracks?.[trackType];
    if (!track || !track.keyframes) return null;

    return (
      <div style={styles.trackRow}>
        <div style={styles.trackLabel}>
          <span>{label}</span>
          <button
            style={styles.addKeyframeButton}
            onClick={() => handleAddKeyframe(trackType)}
            title="Add keyframe at current time"
          >
            +
          </button>
        </div>
        <div style={styles.trackTimeline} onClick={handleTimelineClick}>
          {track.keyframes.map((kf, idx) => {
            const position = (kf.time / activeAnimation.duration) * 100;
            return (
              <div
                key={idx}
                style={{
                  ...styles.keyframe,
                  left: `${position}%`,
                  backgroundColor: color,
                }}
                onClick={(e) => handleKeyframeClick(e, trackType, kf.time)}
                title={`Time: ${kf.time.toFixed(2)}s (Shift+Click to delete)`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Animation Editor</h3>
        <button style={styles.closeButton} onClick={onClose}>×</button>
      </div>

      <div style={styles.content}>
        <div style={styles.animationList}>
          <div style={styles.sectionHeader}>
            <span>Animations</span>
            {selectedNode && (
              <button style={styles.createButton} onClick={handleCreateAnimation}>
                + New
              </button>
            )}
          </div>

          {!selectedNode ? (
            <p style={styles.emptyMessage}>Select a node to create animations</p>
          ) : nodeAnimations.length === 0 ? (
            <p style={styles.emptyMessage}>No animations yet. Create one!</p>
          ) : (
            <div style={styles.animationItems}>
              {nodeAnimations.map((anim) => (
                <div
                  key={anim.id}
                  style={{
                    ...styles.animationItem,
                    ...(selectedAnimationId === anim.id ? styles.animationItemSelected : {}),
                    ...(activeAnimationId === anim.id ? styles.animationItemActive : {}),
                  }}
                  onClick={() => handleSetActive(anim.id)}
                >
                  {editingName === anim.id ? (
                    <input
                      style={styles.nameInput}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onBlur={() => handleSaveName(anim.id)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSaveName(anim.id)}
                      autoFocus
                    />
                  ) : (
                    <span
                      style={styles.animationName}
                      onDoubleClick={() => handleRenameAnimation(anim.id)}
                    >
                      {anim.name}
                    </span>
                  )}
                  <div style={styles.animationActions}>
                    <span style={styles.durationBadge}>
                      {anim.duration.toFixed(1)}s
                    </span>
                    <button
                      style={styles.deleteButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAnimation(anim.id);
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {activeAnimation && (
          <div style={styles.timelineContainer}>
            <div style={styles.controlsBar}>
              <button style={styles.playButton} onClick={handlePlayPause}>
                {isPlaying ? '⏸️' : '▶️'}
              </button>
              <div style={styles.speedControl}>
                <label>Speed:</label>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={playbackSpeed}
                  onChange={handleSpeedChange}
                  style={styles.slider}
                />
                <span style={styles.speedValue}>{playbackSpeed.toFixed(1)}x</span>
              </div>
              <label style={styles.loopLabel}>
                <input
                  type="checkbox"
                  checked={isLooping}
                  onChange={handleLoopChange}
                />
                Loop
              </label>
              <div style={styles.timeDisplay}>
                {currentTime.toFixed(2)}s / {activeAnimation.duration.toFixed(2)}s
              </div>
            </div>

            <div style={styles.timelineWrapper}>
              <div
                ref={timelineRef}
                style={styles.timeline}
                onClick={handleTimelineClick}
              >
                <div
                  style={{
                    ...styles.playhead,
                    left: `${(currentTime / activeAnimation.duration) * 100}%`,
                  }}
                />
                {Array.from({ length: Math.ceil(activeAnimation.duration) }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      ...styles.timeMarker,
                      left: `${(i / activeAnimation.duration) * 100}%`,
                    }}
                  >
                    <span style={styles.timeLabel}>{i}s</span>
                  </div>
                ))}
              </div>

              <div style={styles.tracksContainer}>
                {showTracks.position && renderTrack('position', 'Position', '#4CAF50')}
                {showTracks.rotation && renderTrack('rotation', 'Rotation', '#2196F3')}
                {showTracks.scale && renderTrack('scale', 'Scale', '#FF9800')}
              </div>
            </div>

            <div style={styles.trackVisibility}>
              <label>
                <input
                  type="checkbox"
                  checked={showTracks.position}
                  onChange={(e) => setShowTracks({ ...showTracks, position: e.target.checked })}
                />
                Position
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showTracks.rotation}
                  onChange={(e) => setShowTracks({ ...showTracks, rotation: e.target.checked })}
                />
                Rotation
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showTracks.scale}
                  onChange={(e) => setShowTracks({ ...showTracks, scale: e.target.checked })}
                />
                Scale
              </label>
            </div>

            <div style={styles.tips}>
              <p>💡 <strong>Tips:</strong></p>
              <ul>
                <li>Click timeline to scrub to specific time</li>
                <li>Click "+" to add keyframe at current time</li>
                <li>Shift+Click on keyframe to delete it</li>
                <li>Double-click animation name to rename</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    background: '#1a1a2e',
    borderRadius: '8px',
    border: '1px solid #334155',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '600px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#16213e',
    borderBottom: '1px solid #334155',
  },
  title: {
    margin: 0,
    color: '#e2e8f0',
    fontSize: '16px',
    fontWeight: '600',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0 8px',
  },
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  animationList: {
    width: '220px',
    borderRight: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    color: '#94a3b8',
    fontSize: '12px',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  createButton: {
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  animationItems: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
  },
  animationItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px',
    marginBottom: '4px',
    background: '#1e293b',
    borderRadius: '6px',
    cursor: 'pointer',
    border: '2px solid transparent',
  },
  animationItemSelected: {
    borderColor: '#3b82f6',
  },
  animationItemActive: {
    background: '#1e3a5f',
  },
  animationName: {
    color: '#e2e8f0',
    fontSize: '13px',
    flex: 1,
  },
  nameInput: {
    flex: 1,
    background: '#0f172a',
    border: '1px solid #3b82f6',
    color: '#e2e8f0',
    fontSize: '13px',
    padding: '4px 8px',
    borderRadius: '4px',
    outline: 'none',
  },
  animationActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  durationBadge: {
    fontSize: '10px',
    color: '#94a3b8',
    background: '#334155',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    fontSize: '14px',
    cursor: 'pointer',
    opacity: 0.6,
  },
  emptyMessage: {
    color: '#64748b',
    fontSize: '12px',
    textAlign: 'center',
    padding: '24px',
  },
  timelineContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  controlsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 16px',
    background: '#16213e',
    borderBottom: '1px solid #334155',
  },
  playButton: {
    width: '36px',
    height: '36px',
    background: '#10b981',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#94a3b8',
    fontSize: '12px',
  },
  slider: {
    width: '80px',
  },
  speedValue: {
    minWidth: '30px',
    textAlign: 'center',
  },
  loopLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: '#94a3b8',
    fontSize: '12px',
    cursor: 'pointer',
  },
  timeDisplay: {
    marginLeft: 'auto',
    color: '#e2e8f0',
    fontFamily: 'monospace',
    fontSize: '13px',
  },
  timelineWrapper: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
  },
  timeline: {
    height: '30px',
    background: '#1e293b',
    borderRadius: '6px',
    position: 'relative',
    marginBottom: '8px',
    cursor: 'pointer',
  },
  playhead: {
    position: 'absolute',
    top: '0',
    bottom: '0',
    width: '2px',
    background: '#ef4444',
    zIndex: '10',
  },
  timeMarker: {
    position: 'absolute',
    top: '0',
    bottom: '0',
    width: '1px',
    background: '#334155',
  },
  timeLabel: {
    position: 'absolute',
    top: '4px',
    left: '4px',
    fontSize: '10px',
    color: '#64748b',
  },
  tracksContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  trackRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  trackLabel: {
    width: '70px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: '#94a3b8',
    fontSize: '11px',
  },
  addKeyframeButton: {
    background: '#334155',
    border: 'none',
    color: '#e2e8f0',
    borderRadius: '3px',
    width: '18px',
    height: '18px',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackTimeline: {
    flex: 1,
    height: '24px',
    background: '#1e293b',
    borderRadius: '4px',
    position: 'relative',
    cursor: 'pointer',
  },
  keyframe: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '12px',
    height: '12px',
    borderRadius: '2px',
    cursor: 'pointer',
  },
  trackVisibility: {
    display: 'flex',
    gap: '16px',
    padding: '12px 16px',
    borderTop: '1px solid #334155',
    color: '#94a3b8',
    fontSize: '12px',
  },
  tips: {
    padding: '12px 16px',
    borderTop: '1px solid #334155',
    color: '#64748b',
    fontSize: '11px',
  },
};

export default AnimationEditor;
