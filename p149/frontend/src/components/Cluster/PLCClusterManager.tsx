import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Play, Square, RefreshCw, Database, Activity, Circle } from 'lucide-react';

interface PLC {
  id: string;
  name: string;
  type: 'master' | 'slave';
  ipAddress: string;
  port: number;
  slaveId: number;
  status: 'connected' | 'disconnected' | 'error';
  description: string;
  lastSeen?: string;
  errorCount?: number;
}

interface PLCData {
  plcId: string;
  inputs: Record<string, boolean>;
  outputs: Record<string, boolean>;
  registers: Record<string, number>;
  timestamp: string;
}

const PLCClusterManager: React.FC = () => {
  const [plcs, setPlcs] = useState<PLC[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPLC, setSelectedPLC] = useState<string | null>(null);
  const [plcData, setPlcData] = useState<PLCData | null>(null);
  const [loading, setLoading] = useState(false);

  const [newPLC, setNewPLC] = useState<Partial<PLC>>({
    name: '',
    type: 'slave',
    ipAddress: '127.0.0.1',
    port: 502,
    slaveId: 1,
    description: '',
  });

  useEffect(() => {
    fetchClusterState();
  }, []);

  const fetchClusterState = async () => {
    try {
      const response = await fetch('/api/cluster/state');
      const data = await response.json();
      setPlcs(data.plcs || []);
      setIsRunning(data.running || false);
    } catch (error) {
      console.error('Failed to fetch cluster state:', error);
    }
  };

  const handleAddPLC = async () => {
    if (!newPLC.name || !newPLC.ipAddress) return;

    try {
      const response = await fetch('/api/cluster/plc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Date.now().toString(),
          ...newPLC,
        }),
      });

      if (response.ok) {
        setShowAddModal(false);
        fetchClusterState();
        setNewPLC({
          name: '',
          type: 'slave',
          ipAddress: '127.0.0.1',
          port: 502,
          slaveId: 1,
          description: '',
        });
      }
    } catch (error) {
      console.error('Failed to add PLC:', error);
    }
  };

  const handleRemovePLC = async (id: string) => {
    try {
      await fetch(`/api/cluster/plc/${id}`, { method: 'DELETE' });
      fetchClusterState();
      if (selectedPLC === id) {
        setSelectedPLC(null);
        setPlcData(null);
      }
    } catch (error) {
      console.error('Failed to remove PLC:', error);
    }
  };

  const handleTestConnection = async (id: string) => {
    try {
      const response = await fetch(`/api/cluster/plc/${id}/test`, { method: 'POST' });
      const data = await response.json();
      alert(data.message);
    } catch (error) {
      console.error('Connection test failed:', error);
      alert('连接测试失败');
    }
  };

  const handleStartCluster = async () => {
    try {
      await fetch('/api/cluster/start', { method: 'POST' });
      setIsRunning(true);
    } catch (error) {
      console.error('Failed to start cluster:', error);
    }
  };

  const handleStopCluster = async () => {
    try {
      await fetch('/api/cluster/stop', { method: 'POST' });
      setIsRunning(false);
    } catch (error) {
      console.error('Failed to stop cluster:', error);
    }
  };

  const handleReadPLCData = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/cluster/plc/${id}/data`);
      const data = await response.json();
      setPlcData(data);
      setSelectedPLC(id);
    } catch (error) {
      console.error('Failed to read PLC data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-500';
      case 'disconnected': return 'text-gray-400';
      case 'error': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const getTypeBadgeColor = (type: string) => {
    return type === 'master' 
      ? 'bg-blue-100 text-blue-700' 
      : 'bg-purple-100 text-purple-700';
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 工具栏 */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">PLC 集群管理</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchClusterState}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              title="刷新"
            >
              <RefreshCw size={18} className="text-gray-600" />
            </button>
            {!isRunning ? (
              <button
                onClick={handleStartCluster}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors text-sm font-medium"
              >
                <Play size={16} />
                启动同步
              </button>
            ) : (
              <button
                onClick={handleStopCluster}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors text-sm font-medium"
              >
                <Square size={16} />
                停止同步
              </button>
            )}
          </div>
        </div>

        {isRunning && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Activity size={14} className="animate-pulse" />
            <span>集群同步运行中...</span>
          </div>
        )}
      </div>

      {/* PLC列表 */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-3">
          {plcs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Database size={48} className="mx-auto mb-3 opacity-50" />
              <p>暂无PLC节点</p>
              <p className="text-sm mt-1">点击下方按钮添加PLC</p>
            </div>
          ) : (
            plcs.map((plc) => (
              <div
                key={plc.id}
                className={`p-4 bg-white rounded-lg border-2 transition-all cursor-pointer ${
                  selectedPLC === plc.id
                    ? 'border-blue-500 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleReadPLCData(plc.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Circle size={10} className={getStatusColor(plc.status)} />
                      <span className="font-medium text-gray-800">{plc.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeColor(plc.type)}`}>
                        {plc.type === 'master' ? '主站' : '从站'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {plc.ipAddress}:{plc.port} (站号: {plc.slaveId})
                    </div>
                    {plc.description && (
                      <div className="text-xs text-gray-400 mt-1">{plc.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTestConnection(plc.id);
                      }}
                      className="p-1.5 hover:bg-blue-50 text-blue-600 rounded transition-colors"
                      title="测试连接"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePLC(plc.id);
                      }}
                      className="p-1.5 hover:bg-red-50 text-red-500 rounded transition-colors"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 添加PLC按钮 */}
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full mt-4 p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          <span>添加PLC节点</span>
        </button>
      </div>

      {/* PLC数据详情 */}
      {plcData && (
        <div className="border-t border-gray-200 bg-white p-4 max-h-64 overflow-auto">
          <h4 className="font-semibold text-gray-800 mb-3">PLC 数据快照</h4>
          
          <div className="space-y-4">
            {/* 输入 */}
            <div>
              <div className="text-sm font-medium text-gray-600 mb-2">输入 (I)</div>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(plcData.inputs).map(([key, value]) => (
                  <div
                    key={key}
                    className={`px-2 py-1 rounded text-center text-sm font-mono ${
                      value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {key}: {value ? '1' : '0'}
                  </div>
                ))}
              </div>
            </div>

            {/* 输出 */}
            <div>
              <div className="text-sm font-medium text-gray-600 mb-2">输出 (Q)</div>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(plcData.outputs).map(([key, value]) => (
                  <div
                    key={key}
                    className={`px-2 py-1 rounded text-center text-sm font-mono ${
                      value ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {key}: {value ? '1' : '0'}
                  </div>
                ))}
              </div>
            </div>

            {/* 寄存器 */}
            <div>
              <div className="text-sm font-medium text-gray-600 mb-2">寄存器 (R)</div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(plcData.registers).map(([key, value]) => (
                  <div
                    key={key}
                    className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-center text-sm font-mono"
                  >
                    {key}: {value}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 添加PLC模态框 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">添加PLC节点</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                <input
                  type="text"
                  value={newPLC.name}
                  onChange={(e) => setNewPLC({ ...newPLC, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="例如: PLC_主站"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
                <select
                  value={newPLC.type}
                  onChange={(e) => setNewPLC({ ...newPLC, type: e.target.value as 'master' | 'slave' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="master">主站 (Master)</option>
                  <option value="slave">从站 (Slave)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IP地址</label>
                  <input
                    type="text"
                    value={newPLC.ipAddress}
                    onChange={(e) => setNewPLC({ ...newPLC, ipAddress: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">端口</label>
                  <input
                    type="number"
                    value={newPLC.port}
                    onChange={(e) => setNewPLC({ ...newPLC, port: parseInt(e.target.value) || 502 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">从站号</label>
                <input
                  type="number"
                  value={newPLC.slaveId}
                  onChange={(e) => setNewPLC({ ...newPLC, slaveId: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                  max="255"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述 (可选)</label>
                <textarea
                  value={newPLC.description}
                  onChange={(e) => setNewPLC({ ...newPLC, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={2}
                  placeholder="设备位置或描述..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddPLC}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PLCClusterManager;
