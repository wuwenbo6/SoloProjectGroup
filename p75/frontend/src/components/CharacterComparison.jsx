import React, { useState, useMemo } from 'react';
import { Eye, EyeOff, ZoomIn, ZoomOut, FileText } from 'lucide-react';

const CharacterComparison = ({ characters }) => {
  const [showOnlyCorrected, setShowOnlyCorrected] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showStats, setShowStats] = useState(true);

  const displayChars = useMemo(() => {
    if (showOnlyCorrected) {
      return characters.filter(c => c.is_corrected);
    }
    return characters;
  }, [characters, showOnlyCorrected]);

  const stats = useMemo(() => {
    const total = characters.length;
    const corrected = characters.filter(c => c.is_corrected).length;
    const accuracy = total > 0 ? ((total - corrected) / total * 100).toFixed(1) : 100;
    const avgConfidence = total > 0 
      ? (characters.reduce((sum, c) => sum + c.confidence, 0) / total * 100).toFixed(1) 
      : 0;
    
    return { total, corrected, accuracy, avgConfidence };
  }, [characters]);

  const getCharStyle = (char) => {
    if (char.is_corrected) {
      return {
        bg: 'bg-warning/10',
        border: 'border-warning',
        textColor: 'text-warning-dark',
        badge: 'bg-warning text-white'
      };
    }
    
    if (char.confidence >= 0.9) {
      return {
        bg: 'bg-success/5',
        border: 'border-success/30',
        textColor: 'text-success',
        badge: 'bg-success/20 text-success'
      };
    }
    
    if (char.confidence >= 0.7) {
      return {
        bg: 'bg-primary/5',
        border: 'border-primary/30',
        textColor: 'text-primary',
        badge: 'bg-primary/20 text-primary'
      };
    }
    
    return {
      bg: 'bg-danger/5',
      border: 'border-danger/30',
      textColor: 'text-danger',
      badge: 'bg-danger/20 text-danger'
    };
  };

  const exportText = () => {
    const text = characters.map(c => (c.is_corrected ? c.corrected_char : c.character)).join('');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collected_text_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-800">字符识别对比预览</h2>
          {showOnlyCorrected && (
            <span className="px-2 py-0.5 bg-warning/10 text-warning text-xs rounded-full">
              仅显示校正
            </span>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowOnlyCorrected(!showOnlyCorrected)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              showOnlyCorrected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {showOnlyCorrected ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showOnlyCorrected ? '显示全部' : '仅显示校正'}
          </button>
          
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setZoom(Math.max(0.75, zoom - 0.25))}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ZoomOut className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm text-gray-600 w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
            <button
              onClick={() => setZoom(Math.min(2, zoom + 0.25))}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ZoomIn className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          
          <button
            onClick={exportText}
            disabled={characters.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success rounded-lg text-sm hover:bg-success/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="w-4 h-4" />
            导出文本
          </button>
        </div>
      </div>

      {showStats && characters.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
            <div className="text-xs text-gray-500">总字符数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-warning">{stats.corrected}</div>
            <div className="text-xs text-gray-500">已校正</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-success">{stats.accuracy}%</div>
            <div className="text-xs text-gray-500">识别准确率</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{stats.avgConfidence}%</div>
            <div className="text-xs text-gray-500">平均置信度</div>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded bg-success"></span>
          <span className="text-gray-600">高置信 (≥90%)</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded bg-primary"></span>
          <span className="text-gray-600">中置信 (70-90%)</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded bg-danger"></span>
          <span className="text-gray-600">低置信 (&lt;70%)</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded bg-warning"></span>
          <span className="text-gray-600">已校正</span>
        </div>
      </div>

      <div 
        className="min-h-[200px] max-h-[400px] overflow-auto border border-gray-200 rounded-xl p-4 bg-gray-50"
        style={{ scrollbarWidth: 'thin' }}
      >
        {characters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <p className="text-sm">暂无采集数据</p>
            <p className="text-xs mt-1">开始采集后字符将显示在这里</p>
          </div>
        ) : displayChars.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <p className="text-sm">没有校正的字符</p>
          </div>
        ) : (
          <div 
            className="flex flex-wrap gap-2"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          >
            {displayChars.map((char, index) => {
              const style = getCharStyle(char);
              return (
                <div
                  key={index}
                  className={`relative group ${style.bg} ${style.border} border-2 rounded-lg transition-all hover:shadow-md cursor-default`}
                  style={{ minWidth: `${3.5 * (1/zoom)}rem`, minHeight: `${3.5 * (1/zoom)}rem` }}
                >
                  <div className="flex flex-col items-center justify-center p-2">
                    <span className={`text-xl font-mono font-bold ${style.textColor}`}>
                      {char.character}
                    </span>
                    {char.is_corrected && (
                      <span className="text-sm font-mono text-success mt-0.5">
                        → {char.corrected_char}
                      </span>
                    )}
                  </div>
                  
                  <div className={`absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-xs font-medium ${style.badge}`}>
                    {(char.confidence * 100).toFixed(0)}%
                  </div>

                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    <div className="font-medium mb-1">字符详情</div>
                    <div className="text-gray-300">原始: {char.character}</div>
                    {char.is_corrected && <div className="text-success">校正: {char.corrected_char}</div>}
                    <div className="text-gray-300">置信度: {(char.confidence * 100).toFixed(1)}%</div>
                    <div className="text-gray-300">时间: {new Date(char.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {characters.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-xl">
          <div className="text-xs text-gray-500 mb-2">完整文本预览</div>
          <div className="font-mono text-sm text-gray-700 leading-relaxed break-all">
            {characters.map((c, i) => (
              <span
                key={i}
                className={c.is_corrected ? 'border-b-2 border-warning' : ''}
                title={`${c.character} → ${c.corrected_char || c.character} (${(c.confidence * 100).toFixed(0)}%)`}
              >
                {c.is_corrected ? c.corrected_char : c.character}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterComparison;