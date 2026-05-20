import React, { useState, useEffect } from 'react';
import { History, Play, Calendar, Hash, Settings } from 'lucide-react';
import { recordsAPI, deviceAPI } from '../services/api';

const HistoryRecords = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [recordCharacters, setRecordCharacters] = useState([]);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const response = await recordsAPI.getAll();
      setRecords(response.data);
    } catch (error) {
      console.error('Failed to fetch records:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecordDetails = async (record) => {
    setSelectedRecord(record);
    try {
      const response = await recordsAPI.getCharacters(record.session_id);
      setRecordCharacters(response.data);
    } catch (error) {
      console.error('Failed to fetch record details:', error);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-success/10 text-success';
      case 'collecting':
        return 'bg-primary/10 text-primary';
      case 'failed':
        return 'bg-danger/10 text-danger';
      default:
        return 'bg-gray-100 text-dark-2';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'collecting':
        return '采集中';
      case 'failed':
        return '失败';
      default:
        return status;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-dark-2" />
          <h2 className="text-lg font-semibold text-dark">历史记录</h2>
        </div>
        <button
          onClick={fetchRecords}
          className="text-sm text-primary hover:underline"
        >
          刷新
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-dark-2">加载中...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-8 text-dark-2">
          <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无采集记录</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
          {records.map((record) => (
            <div
              key={record.id}
              onClick={() => fetchRecordDetails(record)}
              className={`p-3 rounded-lg border cursor-pointer transition-all hover:border-primary ${
                selectedRecord?.id === record.id ? 'border-primary bg-primary/5' : 'border-gray-100 hover:bg-light-bg'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Play className="w-4 h-4 text-dark-2" />
                  <div>
                    <p className="text-sm font-medium text-dark">
                      会话 {record.session_id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-dark-2">
                      设备: {record.device_id}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(record.status)}`}>
                  {getStatusText(record.status)}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-dark-2">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(record.start_time).toLocaleString('zh-CN')}
                </span>
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  {record.total_characters} 字符
                </span>
              </div>

              {selectedRecord?.id === record.id && recordCharacters.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-dark-2 mb-2">采集内容:</p>
                  <div className="flex flex-wrap gap-1">
                    {recordCharacters.slice(0, 50).map((c, i) => (
                      <span key={i} className="px-2 py-0.5 bg-light-bg rounded text-xs font-mono">
                        {c.character}
                      </span>
                    ))}
                    {recordCharacters.length > 50 && (
                      <span className="text-xs text-dark-2">...还有 {recordCharacters.length - 50} 个</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryRecords;