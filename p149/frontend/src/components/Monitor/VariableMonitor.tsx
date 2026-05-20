import React from 'react';
import { Zap, Lock, Unlock } from 'lucide-react';
import { useSimulationStore, VariableState } from '../../store/simulationStore';

const VariableMonitor: React.FC = () => {
  const { variables, forceVariable, releaseForce, isRunning } = useSimulationStore();

  const getVariableGroup = (type: string) => {
    return variables.filter(v => v.type === type);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'I': return '输入 (I)';
      case 'Q': return '输出 (Q)';
      case 'M': return '内部继电器 (M)';
      case 'T': return '定时器 (T)';
      default: return type;
    }
  };

  const handleForceToggle = (variable: VariableState) => {
    if (variable.type === 'T') return; // 定时器不支持强制
    
    if (variable.forced) {
      releaseForce(variable.name);
    } else {
      forceVariable(variable.name, !variable.value);
    }
  };

  const renderVariableRow = (variable: VariableState) => {
    const isBoolean = variable.type !== 'T';
    const value = variable.value;
    const displayValue = isBoolean 
      ? (value ? '1' : '0') 
      : `${value}ms`;

    return (
      <tr 
        key={variable.name}
        className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
          variable.forced ? 'bg-yellow-50' : ''
        }`}
      >
        <td className="px-3 py-2 font-mono text-sm text-gray-700">
          {variable.name}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center justify-center">
            {isBoolean ? (
              <div 
                className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-white transition-all ${
                  value 
                    ? 'bg-green-500 shadow-lg shadow-green-200' 
                    : 'bg-gray-300'
                }`}
              >
                {value ? 'ON' : 'OFF'}
              </div>
            ) : (
              <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                {displayValue}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center justify-center gap-2">
            {isBoolean && isRunning && (
              <button
                onClick={() => handleForceToggle(variable)}
                className={`p-1.5 rounded-md transition-all ${
                  variable.forced 
                    ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
                title={variable.forced ? '释放强制' : '强制置位'}
              >
                {variable.forced ? <Lock size={16} /> : <Unlock size={16} />}
              </button>
            )}
            {variable.forced && (
              <button
                onClick={() => forceVariable(variable.name, !variable.value)}
                className="p-1.5 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-all"
                title="切换强制值"
              >
                <Zap size={16} />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const renderGroup = (type: string) => {
    const groupVariables = getVariableGroup(type);
    
    return (
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-600 mb-2 px-2 border-l-4 border-industrial-600">
          {getTypeLabel(type)}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-3 py-2 text-left font-medium text-gray-600">变量</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600">值</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {groupVariables.map(renderVariableRow)}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto p-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Zap size={20} className="text-tech-green-600" />
          变量监视
        </h2>
        {!isRunning && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            启动仿真后可强制
          </span>
        )}
      </div>
      
      {renderGroup('I')}
      {renderGroup('Q')}
      {renderGroup('M')}
      {renderGroup('T')}
      
      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
        <p className="font-medium mb-1">图例说明:</p>
        <p>• <span className="text-yellow-600 font-medium">黄色背景</span>: 已强制的变量</p>
        <p>• <span className="text-green-600 font-medium">绿色</span>: 状态为 ON</p>
        <p>• <span className="text-gray-400 font-medium">灰色</span>: 状态为 OFF</p>
      </div>
    </div>
  );
};

export default VariableMonitor;
