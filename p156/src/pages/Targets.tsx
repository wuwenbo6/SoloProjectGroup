import { useState, useEffect } from 'react';
import * as echarts from 'echarts';
import { Card, Button, Form, Input, Select, Progress, message, Tag, Modal, Table } from 'antd';
import { PlusOutlined, LineChartOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../services/api';
import { useAuth } from '../store/auth';

const { Option } = Select;

export default function Targets() {
  const { user } = useAuth();
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [trackingModalVisible, setTrackingModalVisible] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<any>(null);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (user?.company_id) {
      loadTargets();
    }
  }, [user]);

  const loadTargets = async () => {
    try {
      setLoading(true);
      const data = await api.getTargets(user!.company_id);
      setTargets(data);
    } catch (error) {
      message.error('加载目标失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTarget = async (values: any) => {
    try {
      setLoading(true);
      await api.createTarget({
        ...values,
        company_id: user!.company_id,
      });
      message.success('目标创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      loadTargets();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '创建目标失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewTracking = async (target: any) => {
    try {
      setSelectedTarget(target);
      const data = await api.getTargetTracking(target.id);
      setTrackingData(data);
      setTrackingModalVisible(true);
      
      setTimeout(() => {
        initTrackingChart(data);
      }, 100);
    } catch (error) {
      message.error('加载跟踪数据失败');
    }
  };

  const handleUpdateProgress = async (targetId: string) => {
    try {
      await api.updateTargetProgress(targetId);
      message.success('进度更新成功');
      loadTargets();
    } catch (error) {
      message.error('更新进度失败');
    }
  };

  const handleDeleteTarget = async (targetId: string) => {
    try {
      await api.deleteTarget(targetId);
      message.success('删除成功');
      loadTargets();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const initTrackingChart = (data: any) => {
    const chartDom = document.getElementById('tracking-chart');
    if (!chartDom || !data?.trajectory) return;
    
    const myChart = echarts.init(chartDom);
    
    const years = data.trajectory.map((t: any) => t.year);
    const expected = data.trajectory.map((t: any) => t.expected_emission);
    const actual = data.trajectory.map((t: any) => t.actual_emission);

    const option = {
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: any) => value ? `${value.toFixed(0)} tCO₂e` : '-',
      },
      legend: {
        data: ['目标路径', '实际排放'],
      },
      xAxis: {
        type: 'category',
        data: years,
      },
      yAxis: {
        type: 'value',
        name: '排放量 (tCO₂e)',
      },
      series: [
        {
          name: '目标路径',
          type: 'line',
          data: expected,
          lineStyle: { type: 'dashed', color: '#52c41a' },
          itemStyle: { color: '#52c41a' },
        },
        {
          name: '实际排放',
          type: 'line',
          data: actual,
          lineStyle: { color: '#1890ff', width: 3 },
          itemStyle: { color: '#1890ff' },
          symbol: 'circle',
          symbolSize: 10,
        },
      ],
    };

    myChart.setOption(option);
    
    window.addEventListener('resize', () => myChart.resize());
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      exceeding: 'success',
      on_track: 'blue',
      at_risk: 'warning',
      off_track: 'error',
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      exceeding: '超额完成',
      on_track: '按计划进行',
      at_risk: '有风险',
      off_track: '偏离轨道',
    };
    return texts[status] || status;
  };

  const columns = [
    {
      title: '目标名称',
      dataIndex: 'target_name',
      key: 'target_name',
      render: (text: string, record: any) => (
        <div>
          <div className="font-medium">{text}</div>
          {record.sbti_aligned && (
            <Tag color="green" className="mt-1">SBTi 对齐</Tag>
          )}
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'target_type',
      key: 'target_type',
    },
    {
      title: '覆盖范围',
      dataIndex: 'scope',
      key: 'scope',
      render: (scope: string) => {
        const scopeNames: Record<string, string> = {
          all: '范围1+2+3',
          scope1: '范围一',
          scope2: '范围二',
          scope3: '范围三',
        };
        return scopeNames[scope] || scope;
      },
    },
    {
      title: '时间范围',
      key: 'period',
      render: (_: any, record: any) => (
        <div>
          <div>基准年: {record.base_year}</div>
          <div className="text-gray-500">目标年: {record.target_year}</div>
        </div>
      ),
    },
    {
      title: '减排目标',
      dataIndex: 'target_reduction_pct',
      key: 'target_reduction_pct',
      render: (pct: number) => <span className="font-semibold text-green-600">-{pct}%</span>,
    },
    {
      title: '当前进度',
      key: 'progress',
      render: (_: any, record: any) => (
        <div className="w-32">
          <div className="flex justify-between text-sm mb-1">
            <span>{record.achieved_reduction_pct || 0}%</span>
            <span className="text-gray-500">目标 {record.target_reduction_pct}%</span>
          </div>
          <Progress 
            percent={record.progress_pct || 0} 
            size="small"
            strokeColor={record.progress_pct >= 100 ? '#52c41a' : '#1890ff'}
          />
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: any) => (
        <div className="flex gap-2">
          <Button 
            size="small" 
            icon={<LineChartOutlined />}
            onClick={() => handleViewTracking(record)}
          >
            跟踪
          </Button>
          <Button 
            size="small" 
            onClick={() => handleUpdateProgress(record.id)}
          >
            更新
          </Button>
          <Button 
            size="small" 
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteTarget(record.id)}
          >
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">减排目标管理</h1>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
        >
          创建SBTi目标
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="text-gray-500 text-sm">当前目标数</div>
          <div className="text-2xl font-bold mt-1">{targets.length}</div>
        </Card>
        <Card>
          <div className="text-gray-500 text-sm">按计划进行</div>
          <div className="text-2xl font-bold mt-1 text-green-600">
            {targets.filter(t => t.status === 'on_track' || t.status === 'exceeding').length}
          </div>
        </Card>
        <Card>
          <div className="text-gray-500 text-sm">有风险</div>
          <div className="text-2xl font-bold mt-1 text-yellow-600">
            {targets.filter(t => t.status === 'at_risk').length}
          </div>
        </Card>
        <Card>
          <div className="text-gray-500 text-sm">偏离轨道</div>
          <div className="text-2xl font-bold mt-1 text-red-600">
            {targets.filter(t => t.status === 'off_track').length}
          </div>
        </Card>
      </div>

      <Card title="目标列表">
        <Table 
          columns={columns} 
          dataSource={targets}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title="创建SBTi减排目标"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateTarget}
        >
          <Form.Item
            name="target_name"
            label="目标名称"
            rules={[{ required: true, message: '请输入目标名称' }]}
          >
            <Input placeholder="例如：2030年绝对减排目标" />
          </Form.Item>

          <Form.Item
            name="target_type"
            label="目标类型"
            rules={[{ required: true, message: '请选择目标类型' }]}
          >
            <Select>
              <Option value="absolute">绝对减排</Option>
              <Option value="intensity">强度减排</Option>
              <Option value="ambition">愿景目标</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="scope"
            label="覆盖范围"
            rules={[{ required: true, message: '请选择覆盖范围' }]}
          >
            <Select>
              <Option value="all">范围 1+2+3 (全范围)</Option>
              <Option value="scope1">范围一 (直接排放)</Option>
              <Option value="scope2">范围二 (外购能源)</Option>
              <Option value="scope3">范围三 (上下游)</Option>
            </Select>
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="base_year"
              label="基准年"
              rules={[{ required: true, message: '请选择基准年' }]}
            >
              <Select>
                {[2020, 2021, 2022, 2023, 2024].map(year => (
                  <Option key={year} value={String(year)}>{year}年</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="target_year"
              label="目标年"
              rules={[{ required: true, message: '请选择目标年' }]}
            >
              <Select>
                {[2025, 2030, 2035, 2040, 2050].map(year => (
                  <Option key={year} value={String(year)}>{year}年</Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <Form.Item
            name="target_reduction_pct"
            label="减排目标 (%)"
            rules={[{ required: true, message: '请输入减排百分比' }]}
            extra="相对于基准年的减排百分比"
          >
            <Input type="number" min="0" max="100" placeholder="例如：42" />
          </Form.Item>

          <Form.Item
            name="sbti_aligned"
            label="SBTi对齐"
          >
            <Select defaultValue={1}>
              <Option value={1}>是 - 符合SBTi标准</Option>
              <Option value={0}>否</Option>
            </Select>
          </Form.Item>

          <div className="flex justify-end gap-3">
            <Button onClick={() => setCreateModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              创建目标
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title="目标跟踪详情"
        open={trackingModalVisible}
        onCancel={() => setTrackingModalVisible(false)}
        footer={null}
        width={800}
      >
        {trackingData && (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card size="small">
                <div className="text-gray-500 text-sm">基准排放</div>
                <div className="text-xl font-bold">{trackingData.target.base_emission} t</div>
              </Card>
              <Card size="small">
                <div className="text-gray-500 text-sm">目标排放</div>
                <div className="text-xl font-bold text-green-600">{trackingData.target.target_emission} t</div>
              </Card>
              <Card size="small">
                <div className="text-gray-500 text-sm">当前排放</div>
                <div className="text-xl font-bold">{trackingData.target.current_emission || '-'} t</div>
              </Card>
            </div>

            <div 
              id="tracking-chart" 
              style={{ width: '100%', height: 350 }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
