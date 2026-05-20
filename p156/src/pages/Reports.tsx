import { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  BarChart3,
  PieChart,
  TrendingUp,
  FileBarChart
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { Report } from '../types';

export function Reports() {
  const { user } = useAuthStore();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [periodStart, setPeriodStart] = useState('2024-01-01');
  const [periodEnd, setPeriodEnd] = useState('2024-03-31');

  useEffect(() => {
    if (user) {
      loadReports();
    }
  }, [user]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await api.getReports(user!.company_id);
      setReports(data);
    } catch (error) {
      console.error('加载报告失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!user || !reportTitle) return;

    setGenerating(true);
    try {
      await api.generateReport(user.company_id, reportTitle, periodStart, periodEnd);
      setShowGenerateModal(false);
      setReportTitle('');
      await loadReports();
    } catch (error) {
      console.error('生成报告失败:', error);
    } finally {
      setGenerating(false);
    }
  };

  const statusConfig: Record<string, { icon: any; color: string; text: string }> = {
    generating: { icon: Clock, color: 'text-amber-500 bg-amber-50', text: '生成中' },
    completed: { icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50', text: '已完成' },
    failed: { icon: AlertCircle, color: 'text-red-500 bg-red-50', text: '失败' },
  };

  const reportTemplates = [
    { name: '完整排放报告', charts: ['排放汇总', '范围构成', '趋势分析', '热点分布'], icon: FileBarChart },
    { name: '季度排放简报', charts: ['核心指标', '环比对比'], icon: BarChart3 },
    { name: '供应链专项报告', charts: ['范围三分析', '供应商排放'], icon: PieChart },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">报告中心</h1>
          <p className="text-gray-500 mt-1">生成和下载碳排放分析报告</p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus className="w-5 h-5" />
          生成报告
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {reportTemplates.map((template, idx) => {
          const IconComponent = template.icon;
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer"
              onClick={() => {
                setReportTitle(template.name);
                setShowGenerateModal(true);
              }}
            >
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <IconComponent className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{template.name}</h3>
              <p className="text-sm text-gray-500 mb-3">
                包含: {template.charts.join('、')}
              </p>
              <div className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                <Plus className="w-4 h-4" />
                快速生成
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">历史报告</h3>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">暂无报告，点击上方按钮生成</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-4 font-medium text-gray-600">报告名称</th>
                  <th className="text-left py-4 px-4 font-medium text-gray-600">统计周期</th>
                  <th className="text-left py-4 px-4 font-medium text-gray-600">状态</th>
                  <th className="text-left py-4 px-4 font-medium text-gray-600">创建时间</th>
                  <th className="text-left py-4 px-4 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const StatusIcon = statusConfig[report.status]?.icon || Clock;
                  return (
                    <tr key={report.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-emerald-600" />
                          </div>
                          <span className="font-medium text-gray-800">{report.title}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          {report.period_start} ~ {report.period_end}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${statusConfig[report.status]?.color}`}>
                          <StatusIcon className="w-4 h-4" />
                          {statusConfig[report.status]?.text}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {new Date(report.created_at).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="py-4 px-4">
                        {report.status === 'completed' && (
                          <a
                            href={api.downloadReport(report.id)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            下载
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-6">生成新报告</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  报告名称
                </label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="请输入报告名称"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    开始日期
                  </label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    结束日期
                  </label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="p-4 bg-emerald-50 rounded-xl">
                <p className="text-sm text-emerald-700">
                  <TrendingUp className="w-4 h-4 inline mr-1" />
                  报告将包含: 排放汇总、范围构成图、趋势分析、热点分布、减排建议
                </p>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={generating || !reportTitle}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? '生成中...' : '生成报告'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
