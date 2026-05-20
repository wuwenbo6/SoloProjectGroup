import React, { useState } from 'react';
import { Download, FileText, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { FBDProgram } from '../../blocks/fbdBlocks';

interface PDFExportPanelProps {
  programType: 'ladder' | 'fbd';
  ladderData?: {
    rungs: any[];
    variables: any[];
  };
  fbdData?: FBDProgram;
}

const PDFExportPanel: React.FC<PDFExportPanelProps> = ({
  programType,
  ladderData,
  fbdData,
}) => {
  const [title, setTitle] = useState(programType === 'ladder' ? '梯形图程序' : '功能块图程序');
  const [author, setAuthor] = useState('PLC Simulator');
  const [description, setDescription] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const endpoint = programType === 'ladder' 
        ? '/api/pdf/export/ladder'
        : '/api/pdf/export/fbd';

      const requestData = programType === 'ladder'
        ? {
            rungs: ladderData?.rungs || [],
            variables: ladderData?.variables || [],
            title,
            author,
            description,
          }
        : {
            blocks: fbdData?.blocks.map(b => ({
              id: b.id,
              type: b.type,
              name: b.name,
              position: { x: Math.round(b.x), y: Math.round(b.y) },
              width: b.width,
              height: b.height,
              inputs: b.inputs.map(i => i.id),
              outputs: b.outputs.map(o => o.id),
              parameters: b.parameters.reduce((acc, p) => {
                acc[p.name] = p.value;
                return acc;
              }, {} as Record<string, any>),
            })) || [],
            wires: fbdData?.connections.map(c => ({
              id: c.id,
              from: { x: 0, y: 0 },
              to: { x: 0, y: 0 },
              fromBlock: c.fromBlockId,
              toBlock: c.toBlockId,
            })) || [],
            variables: [],
            title,
            author,
            description,
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4 bg-white border-l border-gray-200 w-80 h-full overflow-auto">
      <div className="flex items-center gap-2 mb-4">
        <FileText size={20} className="text-blue-600" />
        <h3 className="font-semibold text-gray-800">导出 PDF</h3>
      </div>

      <div className="space-y-4">
        {/* 程序类型标识 */}
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-700 font-medium">
            {programType === 'ladder' ? '梯形图 (LAD)' : '功能块图 (FBD)'}
          </div>
          <div className="text-xs text-blue-600 mt-1">
            {programType === 'ladder' 
              ? `${ladderData?.rungs?.length || 0} 个梯级`
              : `${fbdData?.blocks?.length || 0} 个功能块, ${fbdData?.connections?.length || 0} 条连接`
            }
          </div>
        </div>

        {/* 标题 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">文档标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder="输入文档标题"
          />
        </div>

        {/* 作者 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">作者</label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder="输入作者名称"
          />
        </div>

        {/* 描述 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">程序说明</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
            rows={3}
            placeholder="输入程序功能说明..."
          />
        </div>

        {/* 高级选项 */}
        <div className="border-t border-gray-200 pt-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-sm text-gray-600 hover:text-gray-800"
          >
            <span className="flex items-center gap-1">
              <Settings size={14} />
              高级选项
            </span>
            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">页面尺寸</span>
                <select className="px-2 py-1 border border-gray-300 rounded text-xs">
                  <option>A4</option>
                  <option>A3</option>
                  <option>Letter</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">页面方向</span>
                <select className="px-2 py-1 border border-gray-300 rounded text-xs">
                  <option>纵向</option>
                  <option>横向</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">包含日期</span>
                <input type="checkbox" defaultChecked className="rounded" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">包含图例</span>
                <input type="checkbox" defaultChecked className="rounded" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">包含变量表</span>
                <input type="checkbox" defaultChecked className="rounded" />
              </div>
            </div>
          )}
        </div>

        {/* 导出按钮 */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors font-medium"
        >
          {isExporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              导出中...
            </>
          ) : (
            <>
              <Download size={18} />
              导出 PDF
            </>
          )}
        </button>

        {/* 说明 */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• 导出的PDF包含程序标题页、图例说明和变量表</p>
          <p>• 梯形图将按梯级分页显示</p>
          <p>• 功能块图将缩放适配页面尺寸</p>
        </div>
      </div>
    </div>
  );
};

export default PDFExportPanel;
