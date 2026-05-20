import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { ZoomIn, ZoomOut, Maximize2, Save, Users, AlertTriangle, RefreshCw, Wifi, WifiOff, Download, MessageSquare, BookOpen, PenTool } from 'lucide-react';
import useStore from '../store';
import { imageAPI, variantAPI, annotationAPI } from '../services/api';
import { getTextBlocksByImage, getAnnotationsByImage, saveTextBlocks, saveAnnotations } from '../services/offlineStorage';

const Annotate: React.FC = () => {
  const { imageId } = useParams<{ imageId: string }>();
  const navigate = useNavigate();
  const { user, currentImage, textBlocks, annotations, setCurrentImage, setTextBlocks, setAnnotations, updateTextBlock } = useStore();
  const socketRef = useRef<Socket | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [autoValidate, setAutoValidate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'blocks' | 'annotations' | 'variants'>('blocks');
  const [variantMatches, setVariantMatches] = useState<any[]>([]);
  const [punctuationResult, setPunctuationResult] = useState<any>(null);
  const [newAnnotation, setNewAnnotation] = useState('');
  const [annotationType, setAnnotationType] = useState<'comment' | 'correction' | 'question' | 'reference'>('comment');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'text'>('json');
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (imageId) {
      loadImage();
      connectSocket();
      loadOfflineData();
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [imageId]);

  const loadOfflineData = async () => {
    if (!imageId) return;
    try {
      const offlineBlocks = await getTextBlocksByImage(imageId);
      if (offlineBlocks.length > 0) {
        setTextBlocks(offlineBlocks);
      }
      const offlineAnnotations = await getAnnotationsByImage(imageId);
      if (offlineAnnotations.length > 0) {
        setAnnotations(offlineAnnotations);
      }
    } catch (error) {
      console.error('Error loading offline data:', error);
    }
  };

  const connectSocket = () => {
    socketRef.current = io('http://localhost:3002');
    socketRef.current.on('connect', () => {
      socketRef.current?.emit('join-image', imageId, user?.id || 'anonymous');
    });
    socketRef.current.on('active-users', (users: string[]) => {
      setActiveUsers(users);
    });
    socketRef.current.on('block-updated', (block: any) => {
      if (block.id !== selectedBlock) {
        updateTextBlock(block.id, block);
      }
    });
  };

  const loadImage = async () => {
    try {
      const image = await imageAPI.getById(imageId!);
      setCurrentImage(image);
      const blocks = await imageAPI.getTextBlocks(imageId!);
      setTextBlocks(blocks);
      saveTextBlocks(blocks);
      const annos = await annotationAPI.getByImage(imageId!);
      setAnnotations(annos);
      saveAnnotations(annos);
    } catch (error) {
      console.error('Error loading image:', error);
    }
  };

  const handleBlockSelect = (block: any) => {
    setSelectedBlock(block.id);
    setEditText(block.corrected_text || block.recognized_text || '');
    setConflictError(null);
    detectVariants(block.corrected_text || block.recognized_text || '');
    suggestPunctuation(block.corrected_text || block.recognized_text || '');
  };

  const detectVariants = async (text: string) => {
    if (!text) {
      setVariantMatches([]);
      return;
    }
    try {
      const matches = await variantAPI.match(text);
      setVariantMatches(matches);
    } catch (error) {
      console.error('Error detecting variants:', error);
      setVariantMatches([]);
    }
  };

  const suggestPunctuation = async (text: string) => {
    if (!text) {
      setPunctuationResult(null);
      return;
    }
    try {
      const result = await annotationAPI.punctuate(text);
      setPunctuationResult(result);
    } catch (error) {
      console.error('Error suggesting punctuation:', error);
      setPunctuationResult(null);
    }
  };

  const handleSave = async () => {
    if (!selectedBlock) return;
    setSaving(true);
    setConflictError(null);
    try {
      const updates = { corrected_text: editText, manually_corrected: true };
      const updatedBlock = await imageAPI.updateTextBlock(selectedBlock, updates);
      updateTextBlock(selectedBlock, updatedBlock);
      if (socketRef.current) {
        socketRef.current.emit('block-update', { imageId, blockId: selectedBlock, updates: updatedBlock });
      }
      setSelectedBlock(null);
      setEditText('');
    } catch (error: any) {
      if (error.response?.status === 409) {
        setConflictError('检测到并发冲突！已有其他用户更新了此内容');
      }
      console.error('Error saving block:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!imageId) return;
    try {
      await imageAPI.createVersion(imageId, user?.id || 'anonymous', 'Manual version');
      alert('版本创建成功！');
    } catch (error) {
      console.error('Error creating version:', error);
      alert('版本创建失败');
    }
  };

  const applyVariant = (standardChar: string, position: number) => {
    const newText = editText.substring(0, position) + standardChar + editText.substring(position + 1);
    setEditText(newText);
  };

  const applyPunctuation = () => {
    if (punctuationResult?.punctuated_text) {
      setEditText(punctuationResult.punctuated_text);
    }
  };

  const handleAddAnnotation = async () => {
    if (!newAnnotation.trim() || !imageId) return;
    try {
      const newAnno = await annotationAPI.create({ imageId, blockId: selectedBlock, type: annotationType, content: newAnnotation, authorId: user?.id, authorName: user?.username || 'anonymous' });
      setAnnotations([...annotations, newAnno]);
      setNewAnnotation('');
    } catch (error) {
      console.error('Error adding annotation:', error);
    }
  };

  const handleDeleteAnnotation = async (id: string) => {
    try {
      await annotationAPI.delete(id);
      setAnnotations(annotations.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting annotation:', error);
    }
  };

  const handleExport = async () => {
    if (!imageId) return;
    try {
      const blob = await annotationAPI.export(imageId, exportFormat);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `annotations_${imageId}.${exportFormat}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting annotations:', error);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(Math.max(0.5, Math.min(3, zoom + delta)));
  };

  const fullText = textBlocks.map(b => b.corrected_text || b.recognized_text).filter(Boolean).join('');
  const correctedCount = textBlocks.filter(b => b.manually_corrected).length;
  const progress = textBlocks.length > 0 ? (correctedCount / textBlocks.length) * 100 : 0;

  if (!currentImage) {
    return <div className="flex items-center justify-center h-screen">加载中...</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-800">← 返回</button>
            <h1 className="text-xl font-bold text-gray-800">{currentImage.filename}</h1>
            <div className="flex items-center space-x-2 text-sm">
              <Users className="w-4 h-4" />
              <span>{activeUsers.length} 人在线</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              {isOnline ? (
                <><Wifi className="w-4 h-4 text-green-500" /><span className="text-green-600">在线</span></>
              ) : (
                <><WifiOff className="w-4 h-4 text-red-500" /><span className="text-red-600">离线</span></>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" checked={autoValidate} onChange={(e) => setAutoValidate(e.target.checked)} className="rounded" />
              <span>自动验证</span>
            </label>
            <button onClick={handleCreateVersion} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2">
              <Save className="w-4 h-4" />
              <span>保存版本</span>
            </button>
            <button onClick={() => navigate(`/images/${imageId}/versions`)} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center space-x-2">
              <RefreshCw className="w-4 h-4" />
              <span>版本历史</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto p-4" ref={containerRef} onWheel={handleWheel}>
          <div className="absolute top-4 left-4 flex space-x-2 z-10">
            <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="p-2 bg-white rounded-lg shadow hover:bg-gray-50">
              <ZoomIn className="w-5 h-5" />
            </button>
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="p-2 bg-white rounded-lg shadow hover:bg-gray-50">
              <ZoomOut className="w-5 h-5" />
            </button>
            <button onClick={() => setZoom(1)} className="p-2 bg-white rounded-lg shadow hover:bg-gray-50">
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>

          <div className="relative inline-block" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            <img ref={imageRef} src={`http://localhost:3002${currentImage.file_path}`} alt={currentImage.filename} className="max-w-full" crossOrigin="anonymous" />
            {textBlocks.map((block) => (
              <div
                key={block.id}
                className={`absolute border-2 cursor-pointer transition-all ${selectedBlock === block.id ? 'border-blue-500 bg-blue-500 bg-opacity-20' : block.manually_corrected ? 'border-green-500 bg-green-500 bg-opacity-10 hover:bg-opacity-20' : 'border-yellow-500 bg-yellow-500 bg-opacity-10 hover:bg-opacity-20'}`}
                style={{ left: block.x, top: block.y, width: block.width, height: block.height }}
                onClick={() => handleBlockSelect(block)}
              />
            ))}
          </div>
        </div>

        <div className="w-96 bg-white shadow-lg flex flex-col">
          <div className="p-4 border-b">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>校对进度</span>
              <span>{correctedCount}/{textBlocks.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="border-b">
            <div className="flex">
              <button className={`flex-1 px-4 py-3 text-sm font-medium ${activeTab === 'blocks' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('blocks')}>
                <PenTool className="w-4 h-4 inline mr-2" />文字块
              </button>
              <button className={`flex-1 px-4 py-3 text-sm font-medium ${activeTab === 'annotations' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('annotations')}>
                <MessageSquare className="w-4 h-4 inline mr-2" />批注 ({annotations.length})
              </button>
              <button className={`flex-1 px-4 py-3 text-sm font-medium ${activeTab === 'variants' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('variants')}>
                <BookOpen className="w-4 h-4 inline mr-2" />异体字
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {activeTab === 'blocks' && selectedBlock && (
              <div className="p-4 space-y-4">
                {conflictError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center text-red-600">
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      <span className="font-medium">{conflictError}</span>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">识别文本</label>
                  <div className="p-3 bg-gray-50 rounded-lg text-gray-600 font-mono text-sm">{textBlocks.find(b => b.id === selectedBlock)?.recognized_text || '无识别结果'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">校对文本</label>
                  <textarea value={editText} onChange={(e) => { setEditText(e.target.value); if (autoValidate) { detectVariants(e.target.value); suggestPunctuation(e.target.value); } }} className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono" placeholder="请输入校对后的文本..." />
                </div>
                {punctuationResult && punctuationResult.suggestions && punctuationResult.suggestions.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-700">断句建议</span>
                      <button onClick={applyPunctuation} className="text-sm text-blue-600 hover:text-blue-800">应用全部</button>
                    </div>
                    <div className="text-sm text-blue-600">{punctuationResult.punctuated_text}</div>
                  </div>
                )}
                {variantMatches.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="text-sm font-medium text-amber-700 mb-2">异体字检测</div>
                    <div className="space-y-2">
                      {variantMatches.map((match, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span><span className="text-red-600">{match.variant_char}</span> → <span className="text-green-600">{match.standard_char}</span>{match.description && ` (${match.description})`}</span>
                          <button onClick={() => applyVariant(match.standard_char, match.position)} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200">替换</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2">
                  {saving ? <><RefreshCw className="w-5 h-5 animate-spin" /><span>保存中...</span></> : <><Save className="w-5 h-5" /><span>保存校对</span></>}
                </button>
              </div>
            )}
            {activeTab === 'blocks' && !selectedBlock && (
              <div className="p-8 text-center text-gray-500">
                <PenTool className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>点击图片中的文字框开始校对</p>
              </div>
            )}
            {activeTab === 'annotations' && (
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <select value={annotationType} onChange={(e) => setAnnotationType(e.target.value as any)} className="w-full p-2 border rounded-lg text-sm">
                    <option value="comment">评论</option>
                    <option value="correction">校正</option>
                    <option value="question">问题</option>
                    <option value="reference">参考</option>
                  </select>
                  <textarea value={newAnnotation} onChange={(e) => setNewAnnotation(e.target.value)} className="w-full p-3 border rounded-lg text-sm" placeholder="添加批注..." rows={3} />
                  <button onClick={handleAddAnnotation} className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">添加批注</button>
                </div>
                <div className="space-y-2">
                  {annotations.map((anno) => (
                    <div key={anno.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs text-gray-500">{anno.author_name}</span>
                        <button onClick={() => handleDeleteAnnotation(anno.id)} className="text-red-500 hover:text-red-700 text-xs">删除</button>
                      </div>
                      <div className="text-sm">{anno.content}</div>
                      <div className="text-xs text-gray-400 mt-1">{new Date(anno.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'variants' && (
              <div className="p-4 space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-blue-700 mb-2">全文异体字检测</div>
                  <button onClick={() => detectVariants(fullText)} className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">检测全文异体字</button>
                </div>
                {variantMatches.length > 0 && (
                  <div className="space-y-2">
                    {variantMatches.map((match, idx) => (
                      <div key={idx} className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm"><span className="text-red-600 font-medium">{match.variant_char}</span> → <span className="text-green-600 font-medium">{match.standard_char}</span></span>
                          <span className="text-xs text-gray-500">{match.category}</span>
                        </div>
                        {match.description && <div className="text-xs text-gray-500 mt-1">{match.description}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">导出批注</span>
              <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as any)} className="text-sm border rounded px-2 py-1">
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
                <option value="text">TXT</option>
              </select>
            </div>
            <button onClick={handleExport} className="w-full py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 flex items-center justify-center space-x-2">
              <Download className="w-4 h-4" />
              <span>导出批注</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Annotate;
