import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  batchProcessor,
  TrackJob,
  ProcessingOptions,
  DEFAULT_PROCESSING_OPTIONS,
  autoSplitTracks,
  generateTrackNames
} from '../audio/batchProcessor';
import { TURNTABLE_PRESETS } from '../audio/turntablePresets';
import { BatchProcessingState } from '../audio/batchProcessor';

const ENHANCEMENT_PRESETS = [
  { id: 'warm-analog', name: '温暖模拟' },
  { id: 'bright-clarity', name: '明亮清晰' },
  { id: 'jazz-vocal', name: '爵士人声' },
  { id: 'rock-energy', name: '摇滚能量' },
  { id: 'classical-pure', name: '古典纯净' },
  { id: 'lofi-vinyl', name: 'Lo-Fi 黑胶' }
];

const STATUS_COLORS = {
  pending: '#6B7280',
  queued: '#6B7280',
  processing: '#3B82F6',
  completed: '#10B981',
  failed: '#EF4444'
};

const STATUS_NAMES = {
  pending: '等待中',
  queued: '队列中',
  processing: '处理中',
  completed: '已完成',
  failed: '失败'
};

interface BatchPanelProps {
  currentAudio?: Float32Array[];
  sampleRate?: number;
  onClose?: () => void;
}

export default function BatchPanel({ currentAudio, sampleRate, onClose }: BatchPanelProps) {
  const [state, setState] = useState<BatchProcessingState>(batchProcessor.getState());
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<ProcessingOptions>(DEFAULT_PROCESSING_OPTIONS);
  const [albumName, setAlbumName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [trackSplitPreview, setTrackSplitPreview] = useState<{ start: number; end: number; duration: number }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = batchProcessor.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  const addCurrentAudioToQueue = useCallback(() => {
    if (!currentAudio || !sampleRate) return;
    
    const name = albumName ? `${albumName} - Track 1` : `Track ${state.jobs.size + 1}`;
    batchProcessor.addJob(currentAudio, sampleRate, name, options);
  }, [currentAudio, sampleRate, options, albumName, state.jobs.size]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !sampleRate) return;

    for (const file of Array.from(files)) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await new window.AudioContext().decodeAudioData(arrayBuffer);
        
        const channels: Float32Array[] = [];
        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
          channels.push(new Float32Array(audioBuffer.getChannelData(i)));
        }

        batchProcessor.addJob(channels, audioBuffer.sampleRate, file.name, options);
      } catch (error) {
        console.error('Error loading file:', error);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [sampleRate, options]);

  const detectAndSplitTracks = useCallback(() => {
    if (!currentAudio || !sampleRate) return;
    
    const mono = new Float32Array(currentAudio[0].length);
    for (let i = 0; i < mono.length; i++) {
      mono[i] = currentAudio.reduce((sum, ch) => sum + ch[i], 0) / currentAudio.length;
    }

    const tracks = autoSplitTracks(mono, sampleRate);
    setTrackSplitPreview(tracks);
  }, [currentAudio, sampleRate]);

  const addSplitTracksToQueue = useCallback(() => {
    if (!currentAudio || !sampleRate || trackSplitPreview.length === 0) return;

    const trackNames = generateTrackNames(trackSplitPreview, albumName, artistName);

    trackNames.forEach((track, index) => {
      const startSample = Math.floor(track.startTime * sampleRate);
      const endSample = Math.floor(track.endTime * sampleRate);
      
      const channels = currentAudio.map(ch => ch.slice(startSample, endSample));
      
      batchProcessor.addJob(channels, sampleRate, track.name, {
        ...options,
        metadataLookup: {
          ...options.metadataLookup,
          searchQuery: {
            album: albumName,
            artist: artistName,
            trackNumber: index + 1
          }
        }
      }, trackSplitPreview.length - index);
    });

    setTrackSplitPreview([]);
  }, [currentAudio, sampleRate, trackSplitPreview, albumName, artistName, options]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const jobs = Array.from(state.jobs.values()).sort((a, b) => {
    const statusOrder = { processing: 0, pending: 1, queued: 2, completed: 3, failed: 4 };
    return statusOrder[a.status] - statusOrder[b.status] || b.priority - a.priority;
  });

  const stats = batchProcessor.getStats();

  return (
    <div style={{
      backgroundColor: '#1F2937',
      borderRadius: '12px',
      padding: '20px',
      color: '#F3F4F6',
      maxHeight: '80vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>批量转录</h2>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#9CA3AF',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ×
          </button>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
        gap: '12px',
        padding: '16px',
        backgroundColor: '#374151',
        borderRadius: '8px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.total}</div>
          <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>总任务</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3B82F6' }}>{stats.processing}</div>
          <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>处理中</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10B981' }}>{stats.completed}</div>
          <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>已完成</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#F59E0B' }}>{stats.pending}</div>
          <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>等待中</div>
        </div>
      </div>

      {state.isRunning && (
        <div style={{ padding: '12px', backgroundColor: '#374151', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>总进度</span>
            <span>{Math.round(state.totalProgress)}%</span>
          </div>
          <div style={{
            height: '8px',
            backgroundColor: '#4B5563',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              backgroundColor: '#3B82F6',
              width: `${state.totalProgress}%`,
              transition: 'width 0.3s'
            }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => batchProcessor.start()}
          disabled={state.isRunning && !state.isPaused}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: state.isRunning && !state.isPaused ? '#4B5563' : '#10B981',
            color: 'white',
            cursor: state.isRunning && !state.isPaused ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          ▶ 开始
        </button>
        <button
          onClick={() => state.isPaused ? batchProcessor.resume() : batchProcessor.pause()}
          disabled={!state.isRunning}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: !state.isRunning ? '#4B5563' : '#F59E0B',
            color: 'white',
            cursor: !state.isRunning ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {state.isPaused ? '▶ 继续' : '⏸ 暂停'}
        </button>
        <button
          onClick={() => batchProcessor.stop()}
          disabled={!state.isRunning}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: !state.isRunning ? '#4B5563' : '#EF4444',
            color: 'white',
            cursor: !state.isRunning ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          ⏹ 停止
        </button>
        <button
          onClick={() => batchProcessor.clearCompleted()}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#6B7280',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          清除已完成
        </button>
        <button
          onClick={() => batchProcessor.downloadAll()}
          disabled={stats.completed === 0}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: stats.completed === 0 ? '#4B5563' : '#3B82F6',
            color: 'white',
            cursor: stats.completed === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          ⬇ 下载全部
        </button>
      </div>

      <div style={{
        padding: '16px',
        backgroundColor: '#374151',
        borderRadius: '8px'
      }}>
        <div style={{ marginBottom: '12px', fontWeight: 600 }}>添加任务</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="专辑名称"
            value={albumName}
            onChange={(e) => setAlbumName(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #4B5563',
              backgroundColor: '#1F2937',
              color: 'white'
            }}
          />
          <input
            type="text"
            placeholder="艺术家"
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #4B5563',
              backgroundColor: '#1F2937',
              color: 'white'
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #3B82F6',
              backgroundColor: 'transparent',
              color: '#3B82F6',
              cursor: 'pointer'
            }}
          >
            上传音频文件
          </button>
          {currentAudio && (
            <>
              <button
                onClick={addCurrentAudioToQueue}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #3B82F6',
                  backgroundColor: 'transparent',
                  color: '#3B82F6',
                  cursor: 'pointer'
                }}
              >
                添加当前音频到队列
              </button>
              <button
                onClick={detectAndSplitTracks}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #8B5CF6',
                  backgroundColor: 'transparent',
                  color: '#8B5CF6',
                  cursor: 'pointer'
                }}
              >
                自动分割曲目
              </button>
            </>
          )}
        </div>

        {trackSplitPreview.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ marginBottom: '8px', fontWeight: 500 }}>
              检测到 {trackSplitPreview.length} 个曲目：
            </div>
            <div style={{
              maxHeight: '150px',
              overflowY: 'auto',
              marginBottom: '12px'
            }}>
              {trackSplitPreview.map((track, index) => (
                <div key={index} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  backgroundColor: '#1F2937',
                  borderRadius: '4px',
                  marginBottom: '4px'
                }}>
                  <span>曲目 {index + 1}</span>
                  <span style={{ color: '#9CA3AF' }}>
                    {formatTime(track.startTime)} - {formatTime(track.endTime)} ({formatTime(track.duration)})
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={addSplitTracksToQueue}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#8B5CF6',
                color: 'white',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              添加 {trackSplitPreview.length} 个曲目到队列
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => setShowOptions(!showOptions)}
        style={{
          padding: '8px 16px',
          borderRadius: '6px',
          border: '1px solid #4B5563',
          backgroundColor: 'transparent',
          color: '#9CA3AF',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span>处理选项</span>
        <span>{showOptions ? '▲' : '▼'}</span>
      </button>

      {showOptions && (
        <div style={{
          padding: '16px',
          backgroundColor: '#374151',
          borderRadius: '8px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px'
        }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={options.clickRemoval.enabled}
                onChange={(e) => setOptions({
                  ...options,
                  clickRemoval: { ...options.clickRemoval, enabled: e.target.checked }
                })}
              />
              爆音移除
            </label>
            <div style={{ marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#9CA3AF', marginBottom: '4px' }}>
                  敏感度: {options.clickRemoval.sensitivity}%
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={options.clickRemoval.sensitivity}
                  onChange={(e) => setOptions({
                    ...options,
                    clickRemoval: { ...options.clickRemoval, sensitivity: Number(e.target.value) }
                  })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={options.noiseReduction.enabled}
                onChange={(e) => setOptions({
                  ...options,
                  noiseReduction: { ...options.noiseReduction, enabled: e.target.checked }
                })}
              />
              降噪处理
            </label>
            <div style={{ marginLeft: '24px' }}>
              <div style={{ fontSize: '0.875rem', color: '#9CA3AF', marginBottom: '4px' }}>
                强度: {options.noiseReduction.strength}%
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={options.noiseReduction.strength}
                onChange={(e) => setOptions({
                  ...options,
                  noiseReduction: { ...options.noiseReduction, strength: Number(e.target.value) }
                })}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={options.speedCorrection.enabled}
                onChange={(e) => setOptions({
                  ...options,
                  speedCorrection: { ...options.speedCorrection, enabled: e.target.checked }
                })}
              />
              转速校正
            </label>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={options.enhancement.enabled}
                onChange={(e) => setOptions({
                  ...options,
                  enhancement: { ...options.enhancement, enabled: e.target.checked }
                })}
              />
              音色增强
            </label>
            <div style={{ marginLeft: '24px' }}>
              <select
                value={options.enhancement.preset}
                onChange={(e) => setOptions({
                  ...options,
                  enhancement: { ...options.enhancement, preset: e.target.value }
                })}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid #4B5563',
                  backgroundColor: '#1F2937',
                  color: 'white'
                }}
              >
                {ENHANCEMENT_PRESETS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={options.turntablePreset.enabled}
                onChange={(e) => setOptions({
                  ...options,
                  turntablePreset: { ...options.turntablePreset, enabled: e.target.checked }
                })}
              />
              唱机预设
            </label>
            <div style={{ marginLeft: '24px' }}>
              <select
                value={options.turntablePreset.presetId}
                onChange={(e) => setOptions({
                  ...options,
                  turntablePreset: { ...options.turntablePreset, presetId: e.target.value }
                })}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid #4B5563',
                  backgroundColor: '#1F2937',
                  color: 'white'
                }}
              >
                {TURNTABLE_PRESETS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={options.metadataLookup.enabled}
                onChange={(e) => setOptions({
                  ...options,
                  metadataLookup: { ...options.metadataLookup, enabled: e.target.checked }
                })}
              />
              元数据匹配
            </label>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontWeight: 600, marginBottom: '8px' }}>任务队列</div>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: '#111827',
          borderRadius: '8px',
          padding: '8px'
        }}>
          {jobs.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6B7280'
            }}>
              暂无任务，上传音频文件或添加当前音频到队列
            </div>
          ) : (
            jobs.map((job) => (
              <JobItem key={job.id} job={job} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function JobItem({ job }: { job: TrackJob }) {
  const [showMetadata, setShowMetadata] = useState(false);
  const duration = job.audioData[0].length / job.sampleRate;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    batchProcessor.downloadJob(job.id);
  };

  const handleRemove = () => {
    batchProcessor.removeJob(job.id);
  };

  return (
    <div style={{
      padding: '12px',
      backgroundColor: '#1F2937',
      borderRadius: '8px',
      marginBottom: '8px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {job.name}
          </div>
          {job.metadata && (
            <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
              {job.metadata.artist} - {job.metadata.album}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: STATUS_COLORS[job.status] + '20',
            color: STATUS_COLORS[job.status],
            fontSize: '0.75rem',
            whiteSpace: 'nowrap'
          }}>
            {STATUS_NAMES[job.status]}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {(job.status === 'processing' || job.status === 'completed') && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{
            height: '4px',
            backgroundColor: '#4B5563',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              backgroundColor: STATUS_COLORS[job.status],
              width: `${job.progress}%`,
              transition: 'width 0.3s'
            }} />
          </div>
        </div>
      )}

      {job.error && (
        <div style={{
          padding: '8px',
          backgroundColor: '#7F1D1D',
          borderRadius: '4px',
          fontSize: '0.875rem',
          color: '#FCA5A5',
          marginBottom: '8px'
        }}>
          {job.error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        {job.metadata && (
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#374151',
              color: '#9CA3AF',
              cursor: 'pointer',
              fontSize: '0.75rem'
            }}
          >
            {showMetadata ? '隐藏元数据' : '显示元数据'}
          </button>
        )}
        {job.status === 'completed' && (
          <button
            onClick={handleDownload}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#10B981',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.75rem'
            }}
          >
            下载
          </button>
        )}
        {job.status !== 'processing' && (
          <button
            onClick={handleRemove}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#374151',
              color: '#EF4444',
              cursor: 'pointer',
              fontSize: '0.75rem'
            }}
          >
            删除
          </button>
        )}
      </div>

      {showMetadata && job.metadata && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          backgroundColor: '#111827',
          borderRadius: '4px',
          fontSize: '0.875rem'
        }}>
          <div>标题: {job.metadata.title}</div>
          <div>艺术家: {job.metadata.artist}</div>
          <div>专辑: {job.metadata.album}</div>
          <div>年份: {job.metadata.year}</div>
          <div>风格: {job.metadata.genre}</div>
        </div>
      )}
    </div>
  );
}
