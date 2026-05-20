import React from 'react';
import { TrackLibrary } from '../components/TrackLibrary';
import { Music, Disc } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';

export const Library: React.FC = () => {
  const { tracks } = useLibraryStore();

  const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0);
  const totalMinutes = Math.floor(totalDuration / 60);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">曲目库</h1>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-gray-300">
            <Music className="w-5 h-5 text-blue-400" />
            <span>{tracks.length} 首曲目</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Disc className="w-5 h-5 text-purple-400" />
            <span>总时长 {totalMinutes} 分钟</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <TrackLibrary />
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-white text-lg font-medium mb-4">批量操作</h3>
        <div className="flex gap-4">
          <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
            批量导出
          </button>
          <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
            导出播放列表
          </button>
        </div>
      </div>
    </div>
  );
};
