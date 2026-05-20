import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  FBDBlock,
  FBDConnection,
  FBDProgram,
  FBDBlockType,
  FBDBlockConfigs,
  createFBDBlock,
  createConnection,
  createDefaultFBDProgram,
} from '../../blocks/fbdBlocks';

interface FBDCanvasProps {
  program?: FBDProgram;
  onChange?: (program: FBDProgram) => void;
  readOnly?: boolean;
}

export const FBDCanvas: React.FC<FBDCanvasProps> = ({
  program: initialProgram,
  onChange,
  readOnly = false,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [program, setProgram] = useState<FBDProgram>(initialProgram || createDefaultFBDProgram());
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<{ blockId: string; portId: string; portType: 'input' | 'output' } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // 更新程序
  const updateProgram = useCallback((newProgram: FBDProgram) => {
    setProgram(newProgram);
    onChange?.(newProgram);
  }, [onChange]);

  // 添加功能块
  const addBlock = useCallback((type: FBDBlockType) => {
    const newBlock = createFBDBlock(type, 100 + panOffset.x / zoom, 100 + panOffset.y / zoom);
    updateProgram({
      ...program,
      blocks: [...program.blocks, newBlock],
    });
    setSelectedBlockId(newBlock.id);
  }, [program, updateProgram, panOffset, zoom]);

  // 删除功能块
  const deleteBlock = useCallback((blockId: string) => {
    updateProgram({
      ...program,
      blocks: program.blocks.filter(b => b.id !== blockId),
      connections: program.connections.filter(
        c => c.fromBlockId !== blockId && c.toBlockId !== blockId
      ),
    });
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  }, [program, selectedBlockId, updateProgram]);

  // 处理鼠标按下 - 开始拖动
  const handleBlockMouseDown = useCallback((e: React.MouseEvent, blockId: string) => {
    if (readOnly) return;
    e.stopPropagation();
    
    const block = program.blocks.find(b => b.id === blockId);
    if (!block) return;

    setDraggingBlockId(blockId);
    setSelectedBlockId(blockId);
    setDragOffset({
      x: e.clientX - block.x * zoom - panOffset.x,
      y: e.clientY - block.y * zoom - panOffset.y,
    });
  }, [program, readOnly, zoom, panOffset]);

  // 处理鼠标移动
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    // 拖动功能块
    if (draggingBlockId) {
      const newX = (e.clientX - dragOffset.x - panOffset.x) / zoom;
      const newY = (e.clientY - dragOffset.y - panOffset.y) / zoom;

      updateProgram({
        ...program,
        blocks: program.blocks.map(b =>
          b.id === draggingBlockId ? { ...b, x: Math.max(0, newX), y: Math.max(0, newY) } : b
        ),
      });
    }

    // 画布平移
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setPanOffset(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }));
    }
  }, [draggingBlockId, dragOffset, program, updateProgram, zoom, panOffset]);

  // 处理鼠标释放
  const handleMouseUp = useCallback(() => {
    setDraggingBlockId(null);
    if (connectingFrom) {
      setConnectingFrom(null);
    }
  }, [connectingFrom]);

  // 处理端口点击 - 开始/结束连接
  const handlePortClick = useCallback((
    e: React.MouseEvent,
    blockId: string,
    portId: string,
    portType: 'input' | 'output'
  ) => {
    if (readOnly) return;
    e.stopPropagation();

    if (!connectingFrom) {
      // 开始连接
      setConnectingFrom({ blockId, portId, portType });
    } else {
      // 结束连接，创建连接线
      if (connectingFrom.portType !== portType && connectingFrom.blockId !== blockId) {
        const from = connectingFrom.portType === 'output' ? connectingFrom : { blockId, portId };
        const to = connectingFrom.portType === 'input' ? connectingFrom : { blockId, portId };

        const existingConnection = program.connections.find(
          c => c.toBlockId === to.blockId && c.toPortId === to.portId
        );

        if (!existingConnection) {
          const newConnection = createConnection(
            from.blockId,
            from.portId,
            to.blockId,
            to.portId
          );
          updateProgram({
            ...program,
            connections: [...program.connections, newConnection],
          });
        }
      }
      setConnectingFrom(null);
    }
  }, [connectingFrom, program, readOnly, updateProgram]);

  // 删除连接线
  const handleConnectionClick = useCallback((e: React.MouseEvent, connectionId: string) => {
    if (readOnly) return;
    e.stopPropagation();
    updateProgram({
      ...program,
      connections: program.connections.filter(c => c.id !== connectionId),
    });
  }, [program, readOnly, updateProgram]);

  // 缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.5, Math.min(2, prev * delta)));
  }, []);

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedBlockId && !readOnly) {
        deleteBlock(selectedBlockId);
      }
      if (e.key === 'Escape') {
        setConnectingFrom(null);
        setSelectedBlockId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockId, deleteBlock, readOnly]);

  // 获取端口位置
  const getPortPosition = (block: FBDBlock, portIndex: number, isInput: boolean) => {
    const config = FBDBlockConfigs[block.type];
    const ports = isInput ? config.inputs : config.outputs;
    const spacing = block.height / (ports.length + 1);
    
    return {
      x: isInput ? block.x : block.x + block.width,
      y: block.y + spacing * (portIndex + 1),
    };
  };

  // 渲染功能块
  const renderBlock = (block: FBDBlock) => {
    const config = FBDBlockConfigs[block.type];
    const isSelected = selectedBlockId === block.id;

    return (
      <g
        key={block.id}
        transform={`translate(${block.x * zoom}, ${block.y * zoom})`}
        onMouseDown={(e) => handleBlockMouseDown(e, block.id)}
        style={{ cursor: readOnly ? 'default' : 'move' }}
      >
        {/* 功能块矩形 */}
        <rect
          width={block.width * zoom}
          height={block.height * zoom}
          fill={config.color}
          stroke={isSelected ? '#fff' : '#333'}
          strokeWidth={isSelected ? 3 : 1}
          rx={4}
        />

        {/* 功能块名称 */}
        <text
          x={block.width * zoom / 2}
          y={16 * zoom}
          textAnchor="middle"
          fill="white"
          fontSize={12 * zoom}
          fontWeight="bold"
        >
          {block.type}
        </text>

        {/* 参数显示 */}
        {block.parameters.map((param, i) => (
          <text
            key={param.name}
            x={block.width * zoom / 2}
            y={(30 + i * 12) * zoom}
            textAnchor="middle"
            fill="white"
            fontSize={10 * zoom}
          >
            {param.name}={param.value}
          </text>
        ))}

        {/* 输入端口 */}
        {config.inputs.map((input, i) => {
          const port = block.inputs[i];
          const pos = {
            x: 0,
            y: (block.height / (config.inputs.length + 1)) * (i + 1),
          };
          return (
            <g key={`input-${i}`}>
              <circle
                cx={pos.x * zoom}
                cy={pos.y * zoom}
                r={6 * zoom}
                fill={port.connected ? '#4CAF50' : '#fff'}
                stroke="#333"
                strokeWidth={1}
                onClick={(e) => handlePortClick(e, block.id, port.id, 'input')}
                style={{ cursor: 'pointer' }}
              />
              <text
                x={12 * zoom}
                y={(pos.y + 4) * zoom}
                fill="white"
                fontSize={9 * zoom}
              >
                {input.name}
              </text>
            </g>
          );
        })}

        {/* 输出端口 */}
        {config.outputs.map((output, i) => {
          const port = block.outputs[i];
          const pos = {
            x: block.width,
            y: (block.height / (config.outputs.length + 1)) * (i + 1),
          };
          return (
            <g key={`output-${i}`}>
              <circle
                cx={pos.x * zoom}
                cy={pos.y * zoom}
                r={6 * zoom}
                fill={port.connected ? '#4CAF50' : '#fff'}
                stroke="#333"
                strokeWidth={1}
                onClick={(e) => handlePortClick(e, block.id, port.id, 'output')}
                style={{ cursor: 'pointer' }}
              />
              <text
                x={(pos.x - 12) * zoom}
                y={(pos.y + 4) * zoom}
                textAnchor="end"
                fill="white"
                fontSize={9 * zoom}
              >
                {output.name}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  // 渲染连接线
  const renderConnection = (connection: FBDConnection) => {
    const fromBlock = program.blocks.find(b => b.id === connection.fromBlockId);
    const toBlock = program.blocks.find(b => b.id === connection.toBlockId);
    if (!fromBlock || !toBlock) return null;

    const fromPortIndex = fromBlock.outputs.findIndex(p => p.id === connection.fromPortId);
    const toPortIndex = toBlock.inputs.findIndex(p => p.id === connection.toPortId);
    if (fromPortIndex === -1 || toPortIndex === -1) return null;

    const fromConfig = FBDBlockConfigs[fromBlock.type];
    const toConfig = FBDBlockConfigs[toBlock.type];

    const fromSpacing = fromBlock.height / (fromConfig.outputs.length + 1);
    const toSpacing = toBlock.height / (toConfig.inputs.length + 1);

    const x1 = (fromBlock.x + fromBlock.width) * zoom;
    const y1 = (fromBlock.y + fromSpacing * (fromPortIndex + 1)) * zoom;
    const x2 = toBlock.x * zoom;
    const y2 = (toBlock.y + toSpacing * (toPortIndex + 1)) * zoom;

    // 贝塞尔曲线控制点
    const midX = (x1 + x2) / 2;

    return (
      <g key={connection.id}>
        <path
          d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
          fill="none"
          stroke="#2196F3"
          strokeWidth={2}
          onClick={(e) => handleConnectionClick(e, connection.id)}
          style={{ cursor: 'pointer' }}
        />
        {/* 箭头 */}
        <polygon
          points={`${x2 - 8},${y2 - 4} ${x2},${y2} ${x2 - 8},${y2 + 4}`}
          fill="#2196F3"
        />
      </g>
    );
  };

  // 渲染正在绘制的连接线
  const renderPendingConnection = () => {
    if (!connectingFrom) return null;

    const block = program.blocks.find(b => b.id === connectingFrom.blockId);
    if (!block) return null;

    const config = FBDBlockConfigs[block.type];
    const ports = connectingFrom.portType === 'input' ? config.inputs : config.outputs;
    const portIndex = ports.findIndex(p => 
      block[connectingFrom.portType === 'input' ? 'inputs' : 'outputs'].findIndex(
        port => port.id === connectingFrom.portId
      )
    );

    if (portIndex === -1) return null;

    const spacing = block.height / (ports.length + 1);
    const x1 = connectingFrom.portType === 'output' 
      ? (block.x + block.width) * zoom 
      : block.x * zoom;
    const y1 = (block.y + spacing * (portIndex + 1)) * zoom;

    return (
      <line
        x1={x1}
        y1={y1}
        x2={mousePos.x}
        y2={mousePos.y}
        stroke="#2196F3"
        strokeWidth={2}
        strokeDasharray="5,5"
      />
    );
  };

  // 工具栏按钮
  const ToolButton = ({ type, label }: { type: FBDBlockType; label: string }) => (
    <button
      onClick={() => addBlock(type)}
      className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
      disabled={readOnly}
      style={{ backgroundColor: FBDBlockConfigs[type].color }}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-full w-full bg-gray-900">
      {/* 工具栏 */}
      <div className="flex flex-wrap gap-1 p-2 bg-gray-800 border-b border-gray-700">
        <div className="flex flex-wrap gap-1">
          <span className="text-gray-400 text-xs mr-2 self-center">逻辑:</span>
          <ToolButton type={FBDBlockType.AND} label="AND" />
          <ToolButton type={FBDBlockType.OR} label="OR" />
          <ToolButton type={FBDBlockType.NOT} label="NOT" />
          <ToolButton type={FBDBlockType.XOR} label="XOR" />
        </div>
        <div className="w-px bg-gray-600 mx-2" />
        <div className="flex flex-wrap gap-1">
          <span className="text-gray-400 text-xs mr-2 self-center">定时:</span>
          <ToolButton type={FBDBlockType.TON} label="TON" />
          <ToolButton type={FBDBlockType.TOF} label="TOF" />
          <ToolButton type={FBDBlockType.TP} label="TP" />
        </div>
        <div className="w-px bg-gray-600 mx-2" />
        <div className="flex flex-wrap gap-1">
          <span className="text-gray-400 text-xs mr-2 self-center">计数:</span>
          <ToolButton type={FBDBlockType.CTU} label="CTU" />
          <ToolButton type={FBDBlockType.CTD} label="CTD" />
          <ToolButton type={FBDBlockType.CTUD} label="CTUD" />
        </div>
        <div className="w-px bg-gray-600 mx-2" />
        <div className="flex flex-wrap gap-1">
          <span className="text-gray-400 text-xs mr-2 self-center">算术:</span>
          <ToolButton type={FBDBlockType.ADD} label="+" />
          <ToolButton type={FBDBlockType.SUB} label="-" />
          <ToolButton type={FBDBlockType.MUL} label="×" />
          <ToolButton type={FBDBlockType.DIV} label="÷" />
        </div>
        <div className="w-px bg-gray-600 mx-2" />
        <div className="flex flex-wrap gap-1">
          <span className="text-gray-400 text-xs mr-2 self-center">比较:</span>
          <ToolButton type={FBDBlockType.GT} label=">" />
          <ToolButton type={FBDBlockType.GE} label=">=" />
          <ToolButton type={FBDBlockType.EQ} label="=" />
          <ToolButton type={FBDBlockType.NE} label="!=" />
          <ToolButton type={FBDBlockType.LE} label="<=" />
          <ToolButton type={FBDBlockType.LT} label="<" />
        </div>
        <div className="w-px bg-gray-600 mx-2" />
        <div className="flex flex-wrap gap-1">
          <span className="text-gray-400 text-xs mr-2 self-center">IO:</span>
          <ToolButton type={FBDBlockType.INPUT} label="IN" />
          <ToolButton type={FBDBlockType.OUTPUT} label="OUT" />
          <ToolButton type={FBDBlockType.MOVE} label="MOVE" />
        </div>
        <div className="flex-1" />
        <div className="flex gap-2 items-center">
          <span className="text-gray-400 text-xs">缩放: {Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(prev => Math.min(prev + 0.1, 2))}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
          >
            +
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.5))}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
          >
            -
          </button>
        </div>
      </div>

      {/* 画布 */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-hidden relative"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={() => setSelectedBlockId(null)}
      >
        <svg
          className="w-full h-full"
          style={{
            background: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
          }}
        >
          <g transform={`translate(${panOffset.x}, ${panOffset.y})`}>
            {/* 连接线 */}
            {program.connections.map(renderConnection)}
            
            {/* 正在绘制的连接线 */}
            {renderPendingConnection()}
            
            {/* 功能块 */}
            {program.blocks.map(renderBlock)}
          </g>
        </svg>

        {/* 提示信息 */}
        <div className="absolute bottom-4 left-4 text-gray-500 text-xs">
          <p>拖拽移动 | 滚轮缩放 | Alt+拖拽平移 | Delete删除 | ESC取消</p>
          {connectingFrom && (
            <p className="text-blue-400">正在连接... 点击另一个端口完成</p>
          )}
        </div>

        {/* 选中块信息 */}
        {selectedBlockId && (
          <div className="absolute top-4 right-4 bg-gray-800 text-white p-3 rounded-lg text-xs shadow-lg max-w-xs">
            <h4 className="font-bold mb-2">选中块信息</h4>
            {(() => {
              const block = program.blocks.find(b => b.id === selectedBlockId);
              if (!block) return null;
              return (
                <>
                  <p>类型: {block.type}</p>
                  <p>位置: ({Math.round(block.x)}, {Math.round(block.y)})</p>
                  <p>输入: {block.inputs.length} | 输出: {block.outputs.length}</p>
                  {block.parameters.length > 0 && (
                    <div className="mt-2">
                      <p className="font-semibold">参数:</p>
                      {block.parameters.map(p => (
                        <p key={p.name}>  {p.name}: {p.value}</p>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => deleteBlock(selectedBlockId)}
                    className="mt-3 w-full px-2 py-1 bg-red-600 hover:bg-red-500 rounded"
                  >
                    删除 (Delete)
                  </button>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default FBDCanvas;
