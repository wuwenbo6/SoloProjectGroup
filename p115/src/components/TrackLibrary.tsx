import React, { useEffect, useState } from 'react';
import { Music, Trash2, Search, Edit3, Save } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAudioStore } from '../store/useAudioStore';
import { AudioTrack } from '../types';

export const TrackLibrary: React.FC = () => {
  const { tracks, selectedTrack, isLoading, loadTracks, selectTrack, deleteTrack, searchTracks, updateTrackMetadata } = useLibraryStore();
  const { loadTrack } = useAudioStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTrack, setEditingTrack] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    artist: '',
    album: '',
    genre: '',
    year: ''
  });

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchTracks(searchQuery);
      } else {
        loadTracks();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchTracks, loadTracks]);

  const handleLoadTrack = async (track: AudioTrack) => {
    await loadTrack(track.id);
    selectTrack(track.id);
  };

  const startEditing = (track: AudioTrack) => {
    setEditingTrack(track.id);
    setEditForm({
      name: track.name,
      artist: track.artist || '',
      album: track.album || '',
      genre: track.metadata.genre || '',
      year: track.metadata.year?.toString() || ''
    });
  };

  const saveEditing = async () => {
    if (!editingTrack) return;
    await updateTrackMetadata(editingTrack, {
      artist: editForm.artist,
      album: editForm.album,
      genre: editForm.genre,
      year: editForm.year ? parseInt(editForm.year) : undefined
    });
    setEditingTrack(null);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('zh-CN');
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white text-lg font-medium">曲目库</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索曲目..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 py-8">加载中...</div>
      ) : tracks.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          <Music className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>暂无曲目</p>
          <p className="text-sm">录制音频后保存到曲目库</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {tracks.map((track) => (
            <div
              key={track.id}
              className={`p-4 rounded-lg transition-colors ${
                selectedTrack === track.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {editingTrack === track.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="曲名"
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={editForm.artist}
                      onChange={(e) => setEditForm({ ...editForm, artist: e.target.value })}
                      placeholder="艺术家"
                      className="bg-gray-800 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={editForm.album}
                      onChange={(e) => setEditForm({ ...editForm, album: e.target.value })}
                      placeholder="专辑"
                      className="bg-gray-800 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveEditing}
                      className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                    >
                      <Save className="w-4 h-4" />
                      保存
                    </button>
                    <button
                      onClick={() => setEditingTrack(null)}
                      className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-white font-medium">{track.name}</h4>
                      <p className="text-gray-400 text-sm">
                        {track.artist || '未知艺术家'}
                        {track.album ? ` · ${track.album}` : ''}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>{formatDuration(track.duration)}</span>
                        <span>{track.channels} 声道</span>
                        <span>{formatDate(track.createdAt)}</span>
                        {track.metadata.genre && <span>{track.metadata.genre}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleLoadTrack(track)}
                        className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                        title="加载到编辑器"
                      >
                        <Music className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => startEditing(track)}
                        className="p-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
                        title="编辑信息"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteTrack(track.id)}
                        className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
