import React, { useRef, useEffect } from 'react';
import { Keyboard, Target, Clock } from 'lucide-react';

const CharacterDisplay = ({ characters }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [characters]);

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'bg-success/90';
    if (confidence >= 0.7) return 'bg-warning/90';
    return 'bg-danger/90';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-dark">字符识别结果</h2>
        <Keyboard className="w-5 h-5 text-dark-2" />
      </div>

      <div
        ref={scrollRef}
        className="h-64 overflow-y-auto scrollbar-thin bg-light-bg rounded-lg p-4 mb-4"
      >
        {characters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-dark-2">
            <Keyboard className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">等待采集数据...</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {characters.map((char, index) => (
              <div
                key={index}
                className="group relative"
              >
                <div className="flex items-center justify-center w-10 h-10 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <span className="text-lg font-mono font-semibold text-dark">
                    {char.character}
                  </span>
                </div>
                <div
                  className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getConfidenceColor(char.confidence)}`}
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-dark text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  <div className="flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    <span>{(char.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(char.timestamp).toLocaleTimeString('zh-CN')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="text-dark-2">置信度:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span>≥90%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-warning" />
            <span>70-90%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-danger" />
            <span>&lt;70%</span>
          </div>
        </div>
        <span className="text-dark-2">共 {characters.length} 个字符</span>
      </div>
    </div>
  );
};

export default CharacterDisplay;