import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download, Play, FileUp } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { UploadResult } from '../types';

export function DataImport() {
  const { user } = useAuthStore();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [period, setPeriod] = useState('2024-Q1');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setUploadResult(null);
      setError('');
      setSuccess('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file || !user) return;

    setUploading(true);
    setError('');

    try {
      const result = await api.uploadData(user.company_id, period, file);
      setUploadResult(result);
      setSuccess('文件上传成功，请核对数据后开始计算');
    } catch (err: any) {
      setError(err.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleProcess = async () => {
    if (!uploadResult || !user) return;

    setProcessing(true);
    setError('');

    try {
      await api.processData(user.company_id, period, uploadResult.file_path);
      setSuccess('碳排放计算完成！数据已保存');
    } catch (err: any) {
      setError(err.message || '处理失败');
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateDemo = async () => {
    if (!user) return;

    setProcessing(true);
    setError('');

    try {
      await api.generateDemoData(user.company_id, period);
      setSuccess('演示数据生成完成！');
    } catch (err: any) {
      setError(err.message || '生成失败');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">数据导入</h1>
        <p className="text-gray-500 mt-1">上传您的供应链活动数据进行碳排放计算</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">上传数据文件</h3>
              <a
                href={api.getTemplateDownload()}
                className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700"
              >
                <Download className="w-4 h-4" />
                下载模板
              </a>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                统计周期
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full max-w-xs px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              >
                <option value="2024-Q1">2024年 第一季度</option>
                <option value="2024-Q2">2024年 第二季度</option>
                <option value="2024-Q3">2024年 第三季度</option>
                <option value="2024-Q4">2024年 第四季度</option>
                <option value="2024-Jan">2024年 1月</option>
                <option value="2024-Feb">2024年 2月</option>
                <option value="2024-Mar">2024年 3月</option>
              </select>
            </div>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                isDragActive
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 hover:border-emerald-400 hover:bg-gray-50'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                  <FileUp className="w-8 h-8 text-emerald-600" />
                </div>
                {file ? (
                  <div>
                    <p className="font-medium text-gray-800">{file.name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-gray-800">
                      {isDragActive ? '释放文件以上传' : '拖拽文件到此处或点击选择'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      支持 CSV、Excel 格式
                    </p>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-xl">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {success && (
              <div className="mt-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-3 rounded-xl">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm">{success}</span>
              </div>
            )}

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-5 h-5" />
                {uploading ? '上传中...' : '上传文件'}
              </button>
              <button
                onClick={handleProcess}
                disabled={!uploadResult || processing}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-5 h-5" />
                {processing ? '计算中...' : '开始计算'}
              </button>
            </div>
          </div>

          {uploadResult && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-4">数据预览</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {uploadResult.columns.map((col, idx) => (
                        <th key={idx} className="text-left py-3 px-4 font-medium text-gray-600">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {uploadResult.preview.map((row, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        {uploadResult.columns.map((col, colIdx) => (
                          <td key={colIdx} className="py-3 px-4 text-gray-800">
                            {row[col]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                共 {uploadResult.row_count} 条数据
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4">快速体验</h3>
            <p className="text-sm text-gray-500 mb-4">
              没有数据文件？一键生成演示数据体验系统功能
            </p>
            <button
              onClick={handleGenerateDemo}
              disabled={processing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-600 font-medium rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet className="w-5 h-5" />
              {processing ? '生成中...' : '生成演示数据'}
            </button>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4">支持的数据类型</h3>
            <div className="space-y-3">
              {[
                { name: '燃料燃烧', desc: '汽油、柴油、天然气等' },
                { name: '电力消耗', desc: '外购电力、蒸汽等' },
                { name: '运输物流', desc: '公路、航空、海运等' },
                { name: '原材料', desc: '钢铁、水泥、塑料等' },
                { name: '商务差旅', desc: '航空出差、酒店住宿等' },
                { name: '员工通勤', desc: '私家车、公共交通等' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
            <h3 className="font-semibold mb-2">EPA/IPCC 标准</h3>
            <p className="text-sm text-emerald-100 mb-4">
              基于美国环保署(EPA)和联合国政府间气候变化专门委员会(IPCC)的权威排放系数计算
            </p>
            <div className="flex items-center gap-4 text-sm">
              <div>
                <p className="text-emerald-200 text-xs">系数数量</p>
                <p className="font-bold text-lg">20+</p>
              </div>
              <div>
                <p className="text-emerald-200 text-xs">覆盖行业</p>
                <p className="font-bold text-lg">10+</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
