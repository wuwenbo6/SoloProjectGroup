import React, { useState, useEffect } from 'react';
import { Card, Form, Select, DatePicker, Button, Table, Pagination, Space, Typography, Tag, Progress, message } from 'antd';
import dayjs from 'dayjs';
import type { DetectionRecord } from '../types';
import { detectionApi } from '../services/api';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const alertLevelConfig = {
  normal: { color: 'success', text: '正常' },
  warning: { color: 'warning', text: '预警' },
  error: { color: 'error', text: '异常' },
};

export const HistoryQuery: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [detections, setDetections] = useState<DetectionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchData = async (values?: any) => {
    setLoading(true);
    try {
      const params = {
        page,
        pageSize,
        deviceID: values?.deviceID,
        materialType: values?.materialType,
        startDate: values?.dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: values?.dateRange?.[1]?.format('YYYY-MM-DD'),
      };
      const res = await detectionApi.getList(params);
      if (res.code === 0) {
        setDetections(res.data.list);
        setTotal(res.data.total);
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, pageSize]);

  const handleSearch = (values: any) => {
    setPage(1);
    fetchData(values);
  };

  const handleReset = () => {
    form.resetFields();
    setPage(1);
    fetchData();
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '设备ID',
      dataIndex: 'device_id',
      key: 'device_id',
      width: 100,
    },
    {
      title: '批次号',
      dataIndex: 'batch_no',
      key: 'batch_no',
      width: 120,
    },
    {
      title: '材质类型',
      dataIndex: 'material_type',
      key: 'material_type',
      width: 100,
    },
    {
      title: '厚度(mm)',
      dataIndex: 'thickness',
      key: 'thickness',
      width: 90,
      render: (val: number) => val?.toFixed(2),
    },
    {
      title: '硬度',
      dataIndex: 'hardness',
      key: 'hardness',
      width: 80,
      render: (val: number) => val?.toFixed(1),
    },
    {
      title: '抗拉强度',
      dataIndex: 'tensile_strength',
      key: 'tensile_strength',
      width: 90,
      render: (val: number) => val?.toFixed(1),
    },
    {
      title: '湿度(%)',
      dataIndex: 'moisture',
      key: 'moisture',
      width: 80,
      render: (val: number) => val?.toFixed(1),
    },
    {
      title: '质量评分',
      dataIndex: 'quality_score',
      key: 'quality_score',
      width: 120,
      render: (score: number) => (
        <Progress
          percent={Math.round(score)}
          size="small"
          strokeColor={score >= 70 ? '#52c41a' : score >= 50 ? '#faad14' : '#ff4d4f'}
        />
      ),
    },
    {
      title: '预警级别',
      dataIndex: 'alert_level',
      key: 'alert_level',
      width: 90,
      render: (level: string) => (
        <Tag color={alertLevelConfig[level as keyof typeof alertLevelConfig]?.color || 'default'}>
          {alertLevelConfig[level as keyof typeof alertLevelConfig]?.text || level}
        </Tag>
      ),
    },
    {
      title: '合格',
      dataIndex: 'is_qualified',
      key: 'is_qualified',
      width: 70,
      render: (qualified: boolean) => (
        <Text type={qualified ? 'success' : 'danger'}>{qualified ? '是' : '否'}</Text>
      ),
    },
  ];

  return (
    <Card title="历史数据查询">
      <Form form={form} layout="inline" onFinish={handleSearch} style={{ marginBottom: 16 }}>
        <Form.Item name="deviceID" label="设备ID">
          <Select placeholder="选择设备" style={{ width: 140 }} allowClear>
            <Select.Option value="DEV001">DEV001</Select.Option>
            <Select.Option value="DEV002">DEV002</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="materialType" label="材质类型">
          <Select placeholder="选择材质" style={{ width: 120 }} allowClear>
            <Select.Option value="皮革">皮革</Select.Option>
            <Select.Option value="纸张">纸张</Select.Option>
            <Select.Option value="木材">木材</Select.Option>
            <Select.Option value="织物">织物</Select.Option>
            <Select.Option value="塑料">塑料</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="dateRange" label="时间范围">
          <RangePicker
            style={{ width: 280 }}
            placeholder={['开始日期', '结束日期']}
            defaultValue={[dayjs().subtract(7, 'day'), dayjs()]}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">
              查询
            </Button>
            <Button onClick={handleReset}>重置</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table
        columns={columns}
        dataSource={detections}
        rowKey="id"
        loading={loading}
        pagination={false}
        scroll={{ x: 1200, y: 400 }}
        size="small"
      />

      <Pagination
        current={page}
        pageSize={pageSize}
        total={total}
        onChange={setPage}
        onShowSizeChange={(current, size) => {
          setPage(current);
          setPageSize(size);
        }}
        showSizeChanger
        showQuickJumper
        showTotal={(total) => `共 ${total} 条记录`}
        style={{ marginTop: 16, textAlign: 'right' }}
      />
    </Card>
  );
};
