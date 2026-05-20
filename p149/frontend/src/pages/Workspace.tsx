import React, { useState, useEffect } from 'react';
import { Play, Square, Save, FolderOpen, Eye, Settings, Cpu, Activity, Server, FileText, GitBranch } from 'lucide-react';
import BlocklyEditor from '../components/Editor/BlocklyEditor';
import VariableMonitor from '../components/Monitor/VariableMonitor';
import ModbusPanel from '../components/Modbus/ModbusPanel';
import FBDCanvas from '../components/FBD/FBDCanvas';
import PLCClusterManager from '../components/Cluster/PLCClusterManager';
import PDFExportPanel from '../components/Export/PDFExportPanel';
import { useSimulationStore } from '../store/simulationStore';
import { FBDProgram, createDefaultFBDProgram } from '../blocks/fbdBlocks';

type EditorMode = 'ladder' | 'fbd';
type PanelType = 'monitor' | 'modbus' | 'cluster' | 'export';

const Workspace: React.FC = () => {
  const { isRunning, startSimulation, stopSimulation, currentProject, saveProject, variables, forceVariable } = useSimulationStore();
  const [editorMode, setEditorMode] = useState<EditorMode>('ladder');
  const [activePanel, setActivePanel] = useState<PanelType>('monitor');
  const [workspaceXml, setWorkspaceXml] = useState('');
  const [fbdProgram, setFbdProgram] = useState<FBDProgram>(createDefaultFBDProgram());
  const [projectName, setProjectName] = useState('新项目');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [isLocalSimulating, setIsLocalSimulating] = useState(false);

  // 本地仿真逻辑（前端简单模拟）
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isLocalSimulating) {
      interval = setInterval(() => {
        setCycleCount(prev => prev + 1);
        
        // 简单的逻辑模拟：I0.0 控制 Q0.0
        const i00 = variables.find(v => v.name === 'I0.0');
        const q00 = variables.find(v => v.name === 'Q0.0');
        
        if (i00 && q00 && !q00.forced) {
          // Q0.0 = I0.0
        }
      }, 100);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLocalSimulating, variables, forceVariable]);

  const handleStartSimulation = () => {
    if (!isLocalSimulating) {
      setIsLocalSimulating(true);
      startSimulation();
    }
  };

  const handleStopSimulation = () => {
    setIsLocalSimulating(false);
    stopSimulation();
    setCycleCount(0);
  };

  const handleSave = () => {
    saveProject(projectName, workspaceXml);
    setShowSaveModal(false);
  };

  const handleXmlChange = (xml: string) => {
    setWorkspaceXml(xml);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* 顶部工具栏 */}
      <header className="bg-industrial-800 text-white px-4 py-2 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Cpu size={24} className="text-tech-green-400" />
              <h1 className="text-xl font-bold">PLC 梯形图仿真器</h1>
            </div>
            <div className="h-6 w-px bg-industrial-600" />
            <div className="text-sm text-gray-300">
              {currentProject ? currentProject.name : '未保存项目'}
            </div>
            {isLocalSimulating && (
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-tech-green-400 rounded-full animate-pulse" />
                <span className="text-tech-green-400">扫描周期: {cycleCount}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* 编辑器模式切换 */}
            <div className="flex bg-industrial-700 rounded-md p-0.5">
              <button
                onClick={() => setEditorMode('ladder')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  editorMode === 'ladder'
                    ? 'bg-tech-green-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <GitBranch size={14} />
                梯形图
              </button>
              <button
                onClick={() => setEditorMode('fbd')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  editorMode === 'fbd'
                    ? 'bg-tech-green-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Server size={14} />
                功能块图
              </button>
            </div>

            <div className="h-6 w-px bg-industrial-600 mx-2" />

            {/* 仿真控制 */}
            {!isLocalSimulating ? (
              <button
                onClick={handleStartSimulation}
                className="flex items-center gap-2 px-4 py-2 bg-tech-green-600 hover:bg-tech-green-700 rounded-md transition-colors font-medium"
              >
                <Play size={18} />
                启动仿真
              </button>
            ) : (
              <button
                onClick={handleStopSimulation}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-md transition-colors font-medium"
              >
                <Square size={18} />
                停止仿真
              </button>
            )}
            
            <div className="h-6 w-px bg-industrial-600 mx-2" />
            
            {/* 项目操作 */}
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-industrial-600 hover:bg-industrial-500 rounded-md transition-colors text-sm"
            >
              <Save size={16} />
              保存
            </button>
            <button
              className="flex items-center gap-2 px-3 py-2 bg-industrial-600 hover:bg-industrial-500 rounded-md transition-colors text-sm"
            >
              <FolderOpen size={16} />
              打开
            </button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：编辑器 */}
        <div className="flex-1 bg-white border-r border-gray-200">
          <div className="h-full">
            {editorMode === 'ladder' ? (
              <BlocklyEditor 
                onXmlChange={handleXmlChange}
                initialXml={currentProject?.xmlData}
                readOnly={isLocalSimulating}
              />
            ) : (
              <FBDCanvas
                program={fbdProgram}
                onChange={setFbdProgram}
                readOnly={isLocalSimulating}
              />
            )}
          </div>
        </div>

        {/* 右侧：面板切换 */}
        <div className="w-96 flex flex-col bg-white">
          {/* 面板标签 */}
          <div className="flex border-b border-gray-200 overflow-x-auto">
            <button
              onClick={() => setActivePanel('monitor')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activePanel === 'monitor'
                  ? 'bg-tech-green-50 text-tech-green-700 border-b-2 border-tech-green-500'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Eye size={16} />
              变量监视
            </button>
            <button
              onClick={() => setActivePanel('modbus')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activePanel === 'modbus'
                  ? 'bg-tech-green-50 text-tech-green-700 border-b-2 border-tech-green-500'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Settings size={16} />
              Modbus
            </button>
            <button
              onClick={() => setActivePanel('cluster')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activePanel === 'cluster'
                  ? 'bg-tech-green-50 text-tech-green-700 border-b-2 border-tech-green-500'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Server size={16} />
              集群
            </button>
            <button
              onClick={() => setActivePanel('export')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activePanel === 'export'
                  ? 'bg-tech-green-50 text-tech-green-700 border-b-2 border-tech-green-500'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <FileText size={16} />
              导出
            </button>
          </div>

          {/* 面板内容 */}
          <div className="flex-1 overflow-hidden">
            {activePanel === 'monitor' && <VariableMonitor />}
            {activePanel === 'modbus' && <ModbusPanel />}
            {activePanel === 'cluster' && <PLCClusterManager />}
            {activePanel === 'export' && (
              <PDFExportPanel
                programType={editorMode}
                ladderData={{ rungs: [], variables: [] }}
                fbdData={fbdProgram}
              />
            )}
          </div>
        </div>
      </div>

      {/* 底部状态栏 */}
      <footer className="bg-gray-800 text-gray-300 px-4 py-1.5 text-xs flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span>PLC 型号: S7-1200 (仿真)</span>
          <div className="flex items-center gap-1">
            <Activity size={12} className={isLocalSimulating ? 'text-tech-green-400' : 'text-gray-500'} />
            <span>状态: {isLocalSimulating ? '运行中' : '已停止'}</span>
          </div>
        </div>
        <div>
          <span>扫描时间: 100ms | 内存使用: 256KB</span>
        </div>
      </footer>

      {/* 保存项目模态框 */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">保存项目</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">项目名称</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-industrial-500 focus:border-transparent"
                placeholder="请输入项目名称"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-industrial-600 text-white rounded-md hover:bg-industrial-700 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workspace;
