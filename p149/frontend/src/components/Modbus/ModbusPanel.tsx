import React, { useState } from 'react';
import { Plug, PlugOff, Download, Upload, Activity } from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';

const ModbusPanel: React.FC = () => {
  const { 
    modbusConnected, 
    modbusConfig, 
    setModbusConfig,
    setModbusConnected 
  } = useSimulationStore();
  
  const [localConfig, setLocalConfig] = useState(modbusConfig);
  const [coilAddress, setCoilAddress] = useState(0);
  const [coilValue, setCoilValue] = useState(true);
  const [registerAddress, setRegisterAddress] = useState(0);
  const [registerValue, setRegisterValue] = useState(0);
  const [readCount, setReadCount] = useState(10);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 50)]);
  };

  const handleConnect = () => {
    setModbusConfig(localConfig);
    setModbusConnected(true);
    addLog(`连接到 ${localConfig.host}:${localConfig.port} (从站: ${localConfig.slaveId})`);
  };

  const handleDisconnect = () => {
    setModbusConnected(false);
    addLog('已断开连接');
  };

  const handleReadCoils = () => {
    if (!modbusConnected) {
      addLog('错误: 请先连接Modbus设备');
      return;
    }
    addLog(`读取线圈: 地址 ${coilAddress}, 数量 ${readCount}`);
    // 模拟读取结果
    addLog('读取结果: [1, 0, 1, 0, 0, 1, 0, 0, 1, 1]');
  };

  const handleWriteCoil = () => {
    if (!modbusConnected) {
      addLog('错误: 请先连接Modbus设备');
      return;
    }
    addLog(`写入线圈: 地址 ${coilAddress}, 值 ${coilValue ? 1 : 0}`);
    addLog('写入成功');
  };

  const handleReadRegisters = () => {
    if (!modbusConnected) {
      addLog('错误: 请先连接Modbus设备');
      return;
    }
    addLog(`读取寄存器: 地址 ${registerAddress}, 数量 ${readCount}`);
    addLog('读取结果: [100, 200, 300, 0, 500, 0, 0, 0, 0, 0]');
  };

  const handleWriteRegister = () => {
    if (!modbusConnected) {
      addLog('错误: 请先连接Modbus设备');
      return;
    }
    addLog(`写入寄存器: 地址 ${registerAddress}, 值 ${registerValue}`);
    addLog('写入成功');
  };

  return (
    <div className="h-full overflow-y-auto p-4 bg-white">
      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
        <Activity size={20} className={modbusConnected ? 'text-tech-green-600' : 'text-gray-400'} />
        Modbus TCP 配置
      </h2>

      {/* 连接配置 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">连接配置</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">IP地址</label>
            <input
              type="text"
              value={localConfig.host}
              onChange={(e) => setLocalConfig({ ...localConfig, host: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-industrial-500 focus:border-transparent"
              disabled={modbusConnected}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">端口</label>
            <input
              type="number"
              value={localConfig.port}
              onChange={(e) => setLocalConfig({ ...localConfig, port: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-industrial-500 focus:border-transparent"
              disabled={modbusConnected}
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-1">从站地址 (Slave ID)</label>
          <input
            type="number"
            value={localConfig.slaveId}
            onChange={(e) => setLocalConfig({ ...localConfig, slaveId: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-industrial-500 focus:border-transparent"
            disabled={modbusConnected}
          />
        </div>
        <button
          onClick={modbusConnected ? handleDisconnect : handleConnect}
          className={`w-full py-2.5 rounded-md font-medium text-white transition-all flex items-center justify-center gap-2 ${
            modbusConnected
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-tech-green-600 hover:bg-tech-green-700'
          }`}
        >
          {modbusConnected ? (
            <>
              <PlugOff size={18} />
              断开连接
            </>
          ) : (
            <>
              <Plug size={18} />
              连接设备
            </>
          )}
        </button>
        {modbusConnected && (
          <div className="mt-3 flex items-center gap-2 text-sm text-tech-green-600">
            <div className="w-2 h-2 bg-tech-green-500 rounded-full animate-pulse" />
            已连接到 {modbusConfig.host}:{modbusConfig.port}
          </div>
        )}
      </div>

      {/* 线圈操作 */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-700 mb-3">线圈操作 (Coils)</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">地址</label>
            <input
              type="number"
              value={coilAddress}
              onChange={(e) => setCoilAddress(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">数量</label>
            <input
              type="number"
              value={readCount}
              onChange={(e) => setReadCount(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">写入值</label>
          <select
            value={coilValue ? '1' : '0'}
            onChange={(e) => setCoilValue(e.target.value === '1')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="1">ON (1)</option>
            <option value="0">OFF (0)</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleReadCoils}
            className="py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-1"
          >
            <Download size={16} />
            读取
          </button>
          <button
            onClick={handleWriteCoil}
            className="py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
          >
            <Upload size={16} />
            写入
          </button>
        </div>
      </div>

      {/* 寄存器操作 */}
      <div className="mb-6 p-4 bg-purple-50 rounded-lg">
        <h3 className="text-sm font-semibold text-purple-700 mb-3">寄存器操作 (Registers)</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">地址</label>
            <input
              type="number"
              value={registerAddress}
              onChange={(e) => setRegisterAddress(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">写入值</label>
            <input
              type="number"
              value={registerValue}
              onChange={(e) => setRegisterValue(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleReadRegisters}
            className="py-2 bg-purple-500 text-white rounded-md text-sm font-medium hover:bg-purple-600 transition-colors flex items-center justify-center gap-1"
          >
            <Download size={16} />
            读取
          </button>
          <button
            onClick={handleWriteRegister}
            className="py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-1"
          >
            <Upload size={16} />
            写入
          </button>
        </div>
      </div>

      {/* 通信日志 */}
      <div className="p-4 bg-gray-900 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">通信日志</h3>
        <div className="h-40 overflow-y-auto font-mono text-xs text-green-400 space-y-1">
          {logs.length === 0 ? (
            <span className="text-gray-500">暂无日志...</span>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="break-all">{log}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ModbusPanel;
