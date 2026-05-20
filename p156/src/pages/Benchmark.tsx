import { useState, useEffect } from 'react';
import * as echarts from 'echarts';
import { Card, Select, Button, Table, Tag, message, Radio, Space } from 'antd';
import { BarChartOutlined, TrophyOutlined, LineChartOutlined } from '@ant-design/icons';
import api from '../services/api';
import { useAuth } from '../store/auth';

const { Option } = Select;

export default function Benchmark() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'industry' | 'multicompany'>('industry');
  const [industryData, setIndustryData] = useState<any>(null);
  const [multicompanyData, setMulticompanyData] = useState<any>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [availableCompanies, setAvailableCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.company_id) {
      loadIndustryBenchmark();
      loadAvailableCompanies();
    }
  }, [user]);

  const loadIndustryBenchmark = async () => {
    try {
      setLoading(true);
      const data = await api.getIndustryBenchmark(user!.company_id);
      setIndustryData(data);
      
      if (viewMode === 'industry') {
        setTimeout(() => initIndustryChart(data), 100);
      }
    } catch (error) {
      message.error('加载行业对标数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableCompanies = async () => {
    const mockCompanies = [
      { id: 'demo-company-1', name: '示范科技有限公司' },
      { id: 'demo-company-2', name: '绿色制造集团' },
      { id: 'demo-company-3', name: '创新材料科技' },
      { id: 'demo-company-4', name: '智慧城市服务' },
    ];
    setAvailableCompanies(mockCompanies);
    setSelectedCompanies([mockCompanies[0].id, mockCompanies[1].id, mockCompanies[2].id]);
  };

  const handleMulticompanyCompare = async () => {
    if (selectedCompanies.length < 2) {
      message.warning('请至少选择2家公司进行对比');
      return;
    }

    try {
      setLoading(true);
      const data = await api.getMulticompanyComparison(selectedCompanies);
      setMulticompanyData(data);
      setTimeout(() => initMulticompanyChart(data), 100);
    } catch (error) {
      message.error('多公司对比分析失败');
    } finally {
      setLoading(false);
    }
  };

  const initIndustryChart = (data: any) => {
    const chartDom = document.getElementById('industry-chart');
    if (!chartDom || !data?.benchmark_available) return;

    const myChart = echarts.init(chartDom);

    const option = {
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: any) => `${value.toFixed(0)} tCO₂e`,
      },
      legend: {
        data: ['贵公司', '行业平均', '前25%', '前75%'],
      },
      xAxis: {
        type: 'category',
        data: ['范围一', '范围二', '范围三', '总计'],
      },
      yAxis: {
        type: 'value',
        name: '排放量 (tCO₂e)',
      },
      series: [
        {
          name: '贵公司',
          type: 'bar',
          data: [
            data.company.scope1,
            data.company.scope2,
            data.company.scope3,
            data.company.total,
          ],
          itemStyle: { color: '#1890ff' },
        },
        {
          name: '行业平均',
          type: 'bar',
          data: [
            data.benchmark.benchmark_scope1,
            data.benchmark.benchmark_scope2,
            data.benchmark.benchmark_scope3,
            data.benchmark.benchmark_total,
          ],
          itemStyle: { color: '#faad14' },
        },
        {
          name: '前25%',
          type: 'bar',
          data: [null, null, null, data.benchmark.p25_total],
          itemStyle: { color: '#52c41a' },
        },
        {
          name: '前75%',
          type: 'bar',
          data: [null, null, null, data.benchmark.p75_total],
          itemStyle: { color: '#ff4d4f' },
        },
      ],
    };

    myChart.setOption(option);
    window.addEventListener('resize', () => myChart.resize());
  };

  const initMulticompanyChart = (data: any) => {
    const chartDom = document.getElementById('multicompany-chart');
    if (!chartDom || !data?.companies) return;

    const myChart = echarts.init(chartDom);

    const companyNames = data.companies.map((c: any) => c.company_name);
    const scope1Data = data.companies.map((c: any) => c.scope1);
    const scope2Data = data.companies.map((c: any) => c.scope2);
    const scope3Data = data.companies.map((c: any) => c.scope3);

    const option = {
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: any) => `${value.toFixed(0)} tCO₂e`,
      },
      legend: {
        data: ['范围一', '范围二', '范围三'],
      },
      xAxis: {
        type: 'category',
        data: companyNames,
        axisLabel: {
          rotate: 15,
          interval: 0,
        },
      },
      yAxis: {
        type: 'value',
        name: '排放量 (tCO₂e)',
      },
      series: [
        {
          name: '范围一',
          type: 'bar',
          stack: 'total',
          data: scope1Data,
          itemStyle: { color: '#5470c6' },
        },
        {
          name: '范围二',
          type: 'bar',
          stack: 'total',
          data: scope2Data,
          itemStyle: { color: '#91cc75' },
        },
        {
          name: '范围三',
          type: 'bar',
          stack: 'total',
          data: scope3Data,
          itemStyle: { color: '#fac858' },
        },
      ],
    };

    myChart.setOption(option);
    window.addEventListener('resize', () => myChart.resize());
  };

  const getPerformanceColor = (level: string) => {
    const colors: Record<string, string> = {
      '行业领先': 'success',
      '优于平均': 'blue',
      '行业平均': 'warning',
      '低于平均': 'error',
    };
    return colors[level] || 'default';
  };

  const industryColumns = [
    {
      title: '指标',
      dataIndex: 'metric',
      key: 'metric',
      width: 150,
    },
    {
      title: '贵公司',
      dataIndex: 'company',
      key: 'company',
      render: (value: number) => <span className="font-semibold">{value?.toFixed(2)} t</span>,
    },
    {
      title: '行业平均',
      dataIndex: 'benchmark',
      key: 'benchmark',
      render: (value: number) => <span>{value?.toFixed(2)} t</span>,
    },
    {
      title: '对比',
      key: 'comparison',
      render: (_: any, record: any) => {
        if (!record.comparison) return null;
        const color = record.comparison.better ? 'text-green-600' : 'text-red-600';
        const sign = record.comparison.better ? '↓' : '↑';
        return (
          <span className={color}>
            {sign} {Math.abs(record.comparison.ratio - 100).toFixed(1)}%
          </span>
        );
      },
    },
  ];

  const multicompanyColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 80,
      render: (_: any, __: any, index: number) => (
        <Tag color={index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'orange' : 'default'}>
          #{index + 1}
        </Tag>
      ),
    },
    {
      title: '公司名称',
      dataIndex: 'company_name',
      key: 'company_name',
    },
    {
      title: '行业',
      dataIndex: 'industry',
      key: 'industry',
    },
    {
      title: '范围一',
      dataIndex: 'scope1',
      key: 'scope1',
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '范围二',
      dataIndex: 'scope2',
      key: 'scope2',
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '范围三',
      dataIndex: 'scope3',
      key: 'scope3',
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '总计',
      dataIndex: 'total',
      key: 'total',
      render: (v: number) => <span className="font-bold">{v?.toFixed(2)} t</span>,
    },
    {
      title: '排放强度',
      dataIndex: 'intensity',
      key: 'intensity',
      render: (v: number) => v ? `${v?.toFixed(2)} t/百万营收` : '-',
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">对标分析中心</h1>
        <Radio.Group 
          value={viewMode} 
          onChange={(e) => setViewMode(e.target.value)}
          optionType="button"
        >
          <Radio.Button value="industry">
            <BarChartOutlined /> 行业对标
          </Radio.Button>
          <Radio.Button value="multicompany">
            <TrophyOutlined /> 多公司对比
          </Radio.Button>
        </Radio.Group>
      </div>

      {viewMode === 'industry' ? (
        <div>
          {industryData?.benchmark_available && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <div className="text-gray-500 text-sm">行业排名</div>
                  <div className="text-2xl font-bold mt-1">
                    #{industryData.peer_rank?.rank || '-'}
                    <span className="text-gray-400 text-base ml-1">
                      / {industryData.peer_rank?.total_peers || 0}
                    </span>
                  </div>
                </Card>
                <Card>
                  <div className="text-gray-500 text-sm">绩效水平</div>
                  <div className="text-2xl font-bold mt-1">
                    <Tag color={getPerformanceColor(industryData.comparison?.performance_level)}>
                      {industryData.comparison?.performance_level}
                    </Tag>
                  </div>
                </Card>
                <Card>
                  <div className="text-gray-500 text-sm">百分位</div>
                  <div className="text-2xl font-bold mt-1 text-blue-600">
                    P{industryData.comparison?.percentile || '-'}
                  </div>
                </Card>
                <Card>
                  <div className="text-gray-500 text-sm">对比公司数</div>
                  <div className="text-2xl font-bold mt-1">
                    {industryData.peer_count || 0} 家
                  </div>
                </Card>
              </div>

              <div 
                id="industry-chart" 
                className="mb-6"
                style={{ width: '100%', height: 400, background: 'white', borderRadius: 8 }}
              />

              <Card title="详细对比数据">
                <Table
                  columns={industryColumns}
                  dataSource={[
                    {
                      metric: '范围一排放',
                      company: industryData.company.scope1,
                      benchmark: industryData.benchmark.benchmark_scope1,
                      comparison: industryData.comparison.scope1,
                    },
                    {
                      metric: '范围二排放',
                      company: industryData.company.scope2,
                      benchmark: industryData.benchmark.benchmark_scope2,
                      comparison: industryData.comparison.scope2,
                    },
                    {
                      metric: '范围三排放',
                      company: industryData.company.scope3,
                      benchmark: industryData.benchmark.benchmark_scope3,
                      comparison: industryData.comparison.scope3,
                    },
                    {
                      metric: '总排放量',
                      company: industryData.company.total,
                      benchmark: industryData.benchmark.benchmark_total,
                      comparison: industryData.comparison.total,
                    },
                  ]}
                  rowKey="metric"
                  pagination={false}
                />
              </Card>
            </>
          )}

          {!industryData?.benchmark_available && (
            <Card className="text-center py-12">
              <LineChartOutlined className="text-6xl text-gray-300 mb-4" />
              <p className="text-gray-500">{industryData?.message || '暂无行业基准数据'}</p>
            </Card>
          )}
        </div>
      ) : (
        <div>
          <Card className="mb-6">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm text-gray-600 mb-2">选择对比公司</label>
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  placeholder="请选择要对比的公司（至少2家）"
                  value={selectedCompanies}
                  onChange={setSelectedCompanies}
                  maxTagCount={3}
                >
                  {availableCompanies.map((comp) => (
                    <Option key={comp.id} value={comp.id}>
                      {comp.name}
                    </Option>
                  ))}
                </Select>
              </div>
              <Button 
                type="primary" 
                onClick={handleMulticompanyCompare}
                loading={loading}
              >
                开始对比分析
              </Button>
            </div>
          </Card>

          {multicompanyData && (
            <>
              <div 
                id="multicompany-chart" 
                className="mb-6"
                style={{ width: '100%', height: 400, background: 'white', borderRadius: 8 }}
              />

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card size="small">
                  <div className="text-gray-500 text-sm">对比公司数</div>
                  <div className="text-xl font-bold">{multicompanyData.companies?.length || 0} 家</div>
                </Card>
                <Card size="small">
                  <div className="text-gray-500 text-sm">平均排放</div>
                  <div className="text-xl font-bold">{multicompanyData.summary?.avg_total?.toFixed(0)} t</div>
                </Card>
                <Card size="small">
                  <div className="text-gray-500 text-sm">最低排放</div>
                  <div className="text-xl font-bold text-green-600">{multicompanyData.summary?.min_total?.toFixed(0)} t</div>
                </Card>
                <Card size="small">
                  <div className="text-gray-500 text-sm">中位值</div>
                  <div className="text-xl font-bold">{multicompanyData.summary?.median_total?.toFixed(0)} t</div>
                </Card>
              </div>

              <Card title="公司排放排行">
                <Table
                  columns={multicompanyColumns}
                  dataSource={multicompanyData.companies}
                  rowKey="company_id"
                  pagination={false}
                />
              </Card>
            </>
          )}

          {!multicompanyData && (
            <Card className="text-center py-12">
              <TrophyOutlined className="text-6xl text-gray-300 mb-4" />
              <p className="text-gray-500">选择公司后点击「开始对比分析」查看对比结果</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
