const API_BASE = 'http://localhost:8000/api';

export const api = {
  async login(email: string, password: string) {
    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('登录失败');
    return response.json();
  },

  async getEmissionSummary(companyId: string) {
    const response = await fetch(`${API_BASE}/emissions/summary?company_id=${companyId}`);
    if (!response.ok) throw new Error('获取排放汇总失败');
    return response.json();
  },

  async getEmissionTrend(companyId: string, months: number = 12) {
    const response = await fetch(`${API_BASE}/emissions/trend?company_id=${companyId}&months=${months}`);
    if (!response.ok) throw new Error('获取趋势数据失败');
    return response.json();
  },

  async getEmissionHotspots(recordId: string) {
    const response = await fetch(`${API_BASE}/emissions/hotspots?record_id=${recordId}`);
    if (!response.ok) throw new Error('获取热点数据失败');
    return response.json();
  },

  async uploadData(companyId: string, period: string, file: File) {
    const formData = new FormData();
    formData.append('company_id', companyId);
    formData.append('period', period);
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE}/data/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('上传失败');
    return response.json();
  },

  async processData(companyId: string, period: string, filePath: string) {
    const formData = new FormData();
    formData.append('company_id', companyId);
    formData.append('period', period);
    formData.append('file_path', filePath);
    
    const response = await fetch(`${API_BASE}/data/process`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('处理失败');
    return response.json();
  },

  async generateDemoData(companyId: string, period: string = '2024-Q1') {
    const response = await fetch(`${API_BASE}/data/generate-demo?company_id=${companyId}&period=${period}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('生成演示数据失败');
    return response.json();
  },

  async getReductionSuggestions(companyId: string) {
    const response = await fetch(`${API_BASE}/reduction/suggestions?company_id=${companyId}`);
    if (!response.ok) throw new Error('获取减排建议失败');
    return response.json();
  },

  async getBenchmark(companyId: string, industry: string) {
    const response = await fetch(`${API_BASE}/reduction/benchmark?company_id=${companyId}&industry=${industry}`);
    if (!response.ok) throw new Error('获取基准数据失败');
    return response.json();
  },

  async generateReport(companyId: string, title: string, periodStart: string, periodEnd: string) {
    const formData = new FormData();
    formData.append('company_id', companyId);
    formData.append('title', title);
    formData.append('period_start', periodStart);
    formData.append('period_end', periodEnd);
    
    const response = await fetch(`${API_BASE}/reports/generate`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('生成报告失败');
    return response.json();
  },

  async getReports(companyId: string) {
    const response = await fetch(`${API_BASE}/reports?company_id=${companyId}`);
    if (!response.ok) throw new Error('获取报告列表失败');
    return response.json();
  },

  downloadReport(reportId: string) {
    return `${API_BASE}/reports/${reportId}/download`;
  },

  getTemplateDownload() {
    return `${API_BASE}/template`;
  },

  async getEmissionFactors(standard?: string) {
    const url = standard 
      ? `${API_BASE}/factors?standard=${standard}`
      : `${API_BASE}/factors`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('获取系数失败');
    return response.json();
  },

  async createTarget(data: any) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, String(value));
    });
    
    const response = await fetch(`${API_BASE}/targets`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('创建目标失败');
    return response.json();
  },

  async getTargets(companyId: string) {
    const response = await fetch(`${API_BASE}/targets?company_id=${companyId}`);
    if (!response.ok) throw new Error('获取目标列表失败');
    return response.json();
  },

  async getTargetTracking(targetId: string) {
    const response = await fetch(`${API_BASE}/targets/${targetId}/tracking`);
    if (!response.ok) throw new Error('获取跟踪数据失败');
    return response.json();
  },

  async updateTargetProgress(targetId: string) {
    const response = await fetch(`${API_BASE}/targets/${targetId}/update`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('更新进度失败');
    return response.json();
  },

  async deleteTarget(targetId: string) {
    const response = await fetch(`${API_BASE}/targets/${targetId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('删除目标失败');
    return response.json();
  },

  async calculateQualityScore(recordId: string) {
    const response = await fetch(`${API_BASE}/quality/score?record_id=${recordId}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('计算质量评分失败');
    return response.json();
  },

  async getQualityHistory(companyId: string, limit: number = 12) {
    const response = await fetch(`${API_BASE}/quality/history?company_id=${companyId}&limit=${limit}`);
    if (!response.ok) throw new Error('获取质量历史失败');
    return response.json();
  },

  async getIndustryBenchmark(companyId: string, period?: string) {
    const url = period
      ? `${API_BASE}/benchmark/industry?company_id=${companyId}&period=${period}`
      : `${API_BASE}/benchmark/industry?company_id=${companyId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('获取行业对标失败');
    return response.json();
  },

  async getMulticompanyComparison(companyIds: string[], period?: string) {
    const formData = new FormData();
    companyIds.forEach((id, index) => {
      formData.append(`company_ids`, id);
    });
    if (period) {
      formData.append('period', period);
    }
    
    const response = await fetch(`${API_BASE}/benchmark/multicompany`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('多公司对比失败');
    return response.json();
  },
};
