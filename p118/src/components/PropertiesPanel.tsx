import { useState } from 'react';
import { X, ChevronDown, ChevronUp, Upload, Play, Pause, SkipForward, Eye } from 'lucide-react';
import { useStore } from '@/store/useStore';

export default function PropertiesPanel() {
  const {
    activeTool,
    model,
    annotations,
    corrosion,
    stress,
    section,
    inspection,
    repair,
    history,
    vr,
    setCorrosionEnabled,
    setCorrosionIntensity,
    setStressEnabled,
    setStressAnimationSpeed,
    setSectionEnabled,
    setSectionAxis,
    setSectionPosition,
    setModelLoaded,
    removeAnnotation,
    setInspectionEnabled,
    setInspectionPlaying,
    setInspectionSpeed,
    setInspectionCurrentIndex,
    setRepairEnabled,
    removeRepairNote,
    updateRepairNote,
    setSelectedRepairNote,
    setHistoryEnabled,
    setLeftVersion,
    setRightVersion,
    setHistoryOpacity,
    setVrEnabled,
    setVrMode,
    setVrFov,
  } = useStore();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    model: true,
    annotations: true,
    corrosion: true,
    stress: true,
    section: true,
    inspection: true,
    repair: true,
    history: true,
    vr: true,
  });

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  if (!activeTool) {
    return (
      <div className="absolute right-4 top-4 w-72 z-10">
        <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl border border-gray-700 p-4 shadow-xl">
          <p className="text-gray-400 text-sm text-center">选择工具以查看属性</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute right-4 top-4 w-72 z-10 max-h-[calc(100vh-2rem)] overflow-y-auto">
      <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl border border-gray-700 shadow-xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-white font-semibold">属性面板</h3>
          <p className="text-gray-400 text-sm mt-1">
            工具: {getToolName(activeTool)}
          </p>
        </div>

        {/* Model Section */}
        {activeTool === 'model' && (
          <Section
            title="模型设置"
            expanded={expandedSections.model}
            onToggle={() => toggleSection('model')}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">模型状态</label>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      model.loaded ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-sm text-white">
                    {model.loaded ? '已加载' : '未加载'}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">加载模型</label>
                <button className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors">
                  <Upload className="w-4 h-4" />
                  上传 GLB/GLTF 文件
                </button>
              </div>
              <div className="text-xs text-gray-500">
                <p>当前使用示例演示模型</p>
              </div>
            </div>
          </Section>
        )}

        {/* Annotations Section */}
        {activeTool === 'annotation' && (
          <Section
            title="构件标注"
            expanded={expandedSections.annotations}
            onToggle={() => toggleSection('annotations')}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  标注列表 ({annotations.length})
                </label>
                {annotations.length === 0 ? (
                  <p className="text-sm text-gray-500">点击模型添加标注</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {annotations.map((ann) => (
                      <div
                        key={ann.id}
                        className="flex items-center justify-between bg-gray-700 p-2 rounded"
                      >
                        <span className="text-sm text-white truncate">{ann.text}</span>
                        <button
                          onClick={() => removeAnnotation(ann.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">提示: 点击模型任意位置添加新标注</p>
            </div>
          </Section>
        )}

        {/* Corrosion Section */}
        {activeTool === 'corrosion' && (
          <Section
            title="腐蚀查看"
            expanded={expandedSections.corrosion}
            onToggle={() => toggleSection('corrosion')}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">启用腐蚀显示</label>
                <button
                  onClick={() => setCorrosionEnabled(!corrosion.enabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    corrosion.enabled ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      corrosion.enabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {corrosion.enabled && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    腐蚀强度: {(corrosion.intensity * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={corrosion.intensity}
                    onChange={(e) => setCorrosionIntensity(parseFloat(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              )}
              <div className="text-xs text-gray-500">
                <p className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                  轻微腐蚀
                </p>
                <p className="flex items-center gap-2 mt-1">
                  <span className="w-3 h-3 rounded-full bg-orange-500" />
                  中度腐蚀
                </p>
                <p className="flex items-center gap-2 mt-1">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  严重腐蚀
                </p>
              </div>
            </div>
          </Section>
        )}

        {/* Stress Section */}
        {activeTool === 'stress' && (
          <Section
            title="受力模拟"
            expanded={expandedSections.stress}
            onToggle={() => toggleSection('stress')}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">启用应力显示</label>
                <button
                  onClick={() => setStressEnabled(!stress.enabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    stress.enabled ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      stress.enabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {stress.enabled && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    动画速度: {stress.animationSpeed.toFixed(1)}x
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={stress.animationSpeed}
                    onChange={(e) => setStressAnimationSpeed(parseFloat(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              )}
              <div className="text-xs text-gray-500">
                <p>热力图显示应力分布</p>
                <p className="mt-1">红色: 高应力 | 黄色: 中应力 | 绿色: 低应力</p>
              </div>
            </div>
          </Section>
        )}

        {/* Section Clipping */}
        {activeTool === 'section' && (
          <Section
            title="截面查看"
            expanded={expandedSections.section}
            onToggle={() => toggleSection('section')}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">启用剖切</label>
                <button
                  onClick={() => setSectionEnabled(!section.enabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    section.enabled ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      section.enabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {section.enabled && (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">剖切轴</label>
                    <div className="flex gap-2">
                      {(['x', 'y', 'z'] as const).map((axis) => (
                        <button
                          key={axis}
                          onClick={() => setSectionAxis(axis)}
                          className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                            section.axis === axis
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-400 hover:text-white'
                          }`}
                        >
                          {axis.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      截面位置: {section.position.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.05"
                      value={section.position}
                      onChange={(e) => setSectionPosition(parseFloat(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>
                </>
              )}
            </div>
          </Section>
        )}

        {/* Inspection Section */}
        {activeTool === 'inspection' && (
          <Section
            title="自动巡检"
            expanded={expandedSections.inspection}
            onToggle={() => toggleSection('inspection')}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">启用巡检路径</label>
                <button
                  onClick={() => setInspectionEnabled(!inspection.enabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    inspection.enabled ? 'bg-green-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      inspection.enabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {inspection.enabled && (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">播放控制</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setInspectionPlaying(!inspection.isPlaying)}
                        className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded flex items-center justify-center gap-1"
                      >
                        {inspection.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        {inspection.isPlaying ? '暂停' : '播放'}
                      </button>
                      <button
                        onClick={() => setInspectionCurrentIndex((inspection.currentIndex + 1) % inspection.path.length)}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      移动速度: {inspection.speed.toFixed(1)}x
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={inspection.speed}
                      onChange={(e) => setInspectionSpeed(parseFloat(e.target.value))}
                      className="w-full accent-green-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      当前检查点: {inspection.currentIndex + 1}/{inspection.path.length}
                    </label>
                    <div className="bg-gray-700 p-2 rounded">
                      <p className="text-sm text-white">{inspection.path[inspection.currentIndex]?.name}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Section>
        )}

        {/* Repair Section */}
        {activeTool === 'repair' && (
          <Section
            title="维修标注"
            expanded={expandedSections.repair}
            onToggle={() => toggleSection('repair')}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">启用维修标注</label>
                <button
                  onClick={() => setRepairEnabled(!repair.enabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    repair.enabled ? 'bg-yellow-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      repair.enabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {repair.enabled && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    维修任务 ({repair.notes.length})
                  </label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {repair.notes.map((note) => (
                      <div
                        key={note.id}
                        className={`p-2 rounded border-l-4 cursor-pointer transition-colors ${
                          repair.selectedNoteId === note.id
                            ? 'bg-gray-600 border-white'
                            : 'bg-gray-700 hover:bg-gray-600 border-transparent'
                        }`}
                        onClick={() => setSelectedRepairNote(repair.selectedNoteId === note.id ? null : note.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white font-medium">{note.title}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRepairNote(note.id);
                            }}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 truncate">{note.description}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              note.priority === 'critical'
                                ? 'bg-red-500/20 text-red-400'
                                : note.priority === 'high'
                                ? 'bg-orange-500/20 text-orange-400'
                                : note.priority === 'medium'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-green-500/20 text-green-400'
                            }`}
                          >
                            {note.priority === 'critical'
                              ? '紧急'
                              : note.priority === 'high'
                              ? '高'
                              : note.priority === 'medium'
                              ? '中'
                              : '低'}
                          </span>
                          <span className="text-xs text-gray-500">{note.assignee}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* History Section */}
        {activeTool === 'history' && (
          <Section
            title="版本对比"
            expanded={expandedSections.history}
            onToggle={() => toggleSection('history')}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">启用版本对比</label>
                <button
                  onClick={() => setHistoryEnabled(!history.enabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    history.enabled ? 'bg-purple-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      history.enabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {history.enabled && (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">左侧版本</label>
                    <select
                      value={history.leftVersion || ''}
                      onChange={(e) => setLeftVersion(e.target.value || null)}
                      className="w-full bg-gray-700 text-white py-2 px-3 rounded border border-gray-600"
                    >
                      {history.versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.date})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">右侧版本</label>
                    <select
                      value={history.rightVersion || ''}
                      onChange={(e) => setRightVersion(e.target.value || null)}
                      className="w-full bg-gray-700 text-white py-2 px-3 rounded border border-gray-600"
                    >
                      {history.versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.date})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      模型透明度: {(history.opacity * 100).toFixed(0)}%
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={history.opacity}
                      onChange={(e) => setHistoryOpacity(parseFloat(e.target.value))}
                      className="w-full accent-purple-600"
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    <p>当前显示两个版本的并排对比</p>
                    <p className="mt-1">蓝色: 旧版本 | 绿色: 新版本</p>
                  </div>
                </>
              )}
            </div>
          </Section>
        )}

        {/* VR Section */}
        {activeTool === 'vr' && (
          <Section
            title="VR模式"
            expanded={expandedSections.vr}
            onToggle={() => toggleSection('vr')}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">启用VR模式</label>
                <button
                  onClick={() => setVrEnabled(!vr.enabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    vr.enabled ? 'bg-pink-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      vr.enabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {vr.enabled && (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">显示模式</label>
                    <div className="flex gap-2">
                      {(['3d', 'vr', 'ar'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setVrMode(mode)}
                          className={`flex-1 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                            vr.mode === mode
                              ? 'bg-pink-600 text-white'
                              : 'bg-gray-700 text-gray-400 hover:text-white'
                          }`}
                        >
                          <Eye className="w-3 h-3" />
                          {mode.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      视野角度: {vr.fov}°
                    </label>
                    <input
                      type="range"
                      min="30"
                      max="120"
                      step="5"
                      value={vr.fov}
                      onChange={(e) => setVrFov(parseInt(e.target.value))}
                      className="w-full accent-pink-600"
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    <p>WASD 键控制移动</p>
                    <p>空格键跳跃</p>
                    <p>鼠标锁定后控制视角</p>
                  </div>
                </>
              )}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-700 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-700/50 transition-colors"
      >
        <span className="text-white font-medium text-sm">{title}</span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function getToolName(tool: string): string {
  const names: Record<string, string> = {
    model: '模型加载',
    annotation: '构件标注',
    corrosion: '腐蚀查看',
    stress: '受力模拟',
    section: '截面查看',
    inspection: '自动巡检',
    repair: '维修标注',
    history: '版本对比',
    vr: 'VR模式',
  };
  return names[tool] || tool;
}
