import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { History, User, Calendar, Clock, RotateCcw, ChevronLeft } from 'lucide-react';
import useStore from '../store';
import { versionAPI } from '../services/api';

const Versions: React.FC = () => {
  const { imageId } = useParams<{ imageId: string }>();
  const navigate = useNavigate();
  const { versions, setVersions } = useStore();
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVersions = async () => {
      if (!imageId) return;

      try {
        const data = await versionAPI.getByImage(imageId);
        setVersions(data);
      } catch (error) {
        console.error('Failed to fetch versions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVersions();
  }, [imageId]);

  const handleRollback = async (versionId: string) => {
    if (!confirm('确定要回滚到此版本吗？当前标注将会被覆盖。')) return;

    try {
      await versionAPI.rollback(versionId);
      alert('回滚成功');
      navigate(`/annotate/${imageId}`);
    } catch (error) {
      console.error('Rollback failed:', error);
      alert('回滚失败');
    }
  };

  const selectedVersionData = versions.find((v) => v.id === selectedVersion);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-all"
        >
          <ChevronLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 font-serif">版本历史</h1>
          <p className="text-gray-600 mt-1">查看和管理标注历史版本</p>
        </div>
      </div>

      <div className="flex gap-6 h-[calc(100vh-220px)]">
        <div className="w-96 bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5" />
              版本列表 ({versions.length})
            </h3>
          </div>
          <div className="overflow-auto h-[calc(100%-60px)] p-4">
            {versions.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">暂无版本记录</p>
                <p className="text-gray-400 text-sm mt-1">在标注页面保存版本后会显示在这里</p>
              </div>
            ) : (
              <div className="space-y-3">
                {versions.map((version: any) => (
                  <div
                    key={version.id}
                    onClick={() => setSelectedVersion(version.id)}
                    className={`p-4 rounded-xl cursor-pointer transition-all ${
                      selectedVersion === version.id
                        ? 'bg-amber-50 border-2 border-amber-500'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-gray-900">v{version.versionNumber}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRollback(version.id);
                        }}
                        className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg hover:bg-amber-200 transition-all"
                      >
                        <RotateCcw className="w-3 h-3" />
                        回滚
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{version.comment}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {version.authorName}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(version.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(version.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-bold text-gray-900">版本详情</h3>
          </div>
          <div className="overflow-auto h-[calc(100%-60px)] p-6">
            {selectedVersionData ? (
              <div className="space-y-6">
                <div className="bg-amber-50 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-bold text-gray-900">
                      版本 v{(selectedVersionData as any).versionNumber}
                    </h4>
                    <button
                      onClick={() => handleRollback(selectedVersionData.id)}
                      className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-all"
                    >
                      <RotateCcw className="w-4 h-4" />
                      恢复此版本
                    </button>
                  </div>
                  <p className="text-gray-600 mb-4">
                    {(selectedVersionData as any).comment || '无备注'}
                  </p>
                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>作者: {(selectedVersionData as any).authorName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>
                        创建时间: {new Date((selectedVersionData as any).createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h5 className="font-bold text-gray-900 mb-4">
                    标注数据 ({(selectedVersionData as any).data?.length || 0} 个文字块)
                  </h5>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {((selectedVersionData as any).data || []).map((block: any, index: number) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          {block.correctedText || block.recognizedText || '(无文本)'}
                        </p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            block.status === 'confirmed'
                              ? 'bg-green-100 text-green-700'
                              : block.status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {block.status === 'confirmed'
                            ? '已确认'
                            : block.status === 'rejected'
                            ? '已拒绝'
                            : '待处理'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <History className="w-16 h-16 mb-4" />
                <p>选择一个版本查看详情</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Versions;
