import React, { useState, useEffect } from 'react';
import { Mic, Square, Play, Pause, Volume2 } from 'lucide-react';
import { useAudioStore } from '../store/useAudioStore';
import { AudioRecorder } from '../audio/recorder';

export const RecordingControls: React.FC = () => {
  const { recordingState, startRecording, stopRecording, togglePlayPause, isPlaying, processedAudioData } = useAudioStore();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');

  useEffect(() => {
    const loadDevices = async () => {
      const audioDevices = await AudioRecorder.getInputDevices();
      setDevices(audioDevices);
      if (audioDevices.length > 0) {
        setSelectedDevice(audioDevices[0].deviceId);
      }
    };
    loadDevices();
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-white text-lg font-medium mb-4">录音控制</h3>
      
      <div className="mb-4">
        <label className="text-gray-300 text-sm block mb-2">输入设备</label>
        <select
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="w-full bg-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={recordingState.isRecording}
        >
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `麦克风 ${devices.indexOf(device) + 1}`}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-gray-400" />
          <div className="w-32 h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-100"
              style={{ width: `${Math.min(recordingState.level * 100, 100)}%` }}
            />
          </div>
        </div>
        <span className="text-white font-mono text-xl">
          {formatTime(recordingState.duration)}
        </span>
      </div>

      <div className="flex justify-center gap-4">
        {!recordingState.isRecording ? (
          <button
            onClick={() => startRecording(selectedDevice)}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full transition-colors"
          >
            <Mic className="w-5 h-5" />
            开始录音
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full transition-colors animate-pulse"
          >
            <Square className="w-5 h-5" />
            停止录音
          </button>
        )}

        {processedAudioData.length > 0 && (
          <button
            onClick={togglePlayPause}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-full transition-colors"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            {isPlaying ? '暂停' : '播放'}
          </button>
        )}
      </div>
    </div>
  );
};
