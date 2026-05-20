import React from 'react';
import { Card, Table, Tag, Progress, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import type { DetectionRecord } from '../types';

const { Text } = Typography;

interface DetectionPanelProps {
  detections: DetectionRecord[];
  loading?: boolean;
  title?: string;
}

const alertLevelConfig = {
  normal: { color: 'success', text: '正常' },
  warning: { color: 'warning', text: '预警' },
  error: { color: 'error', text: '异常' },
};

export const DetectionPanel: React.FC<DetectionPanelProps> = ({
  detections,
  loading,
  title = '实时检测结果',
}) => {
  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time: string) => dayjs(time).format('MM-DD HH:mm:ss'),
    },
    {
      title: '设备',
      dataIndex: 'device_id',
      key: 'device_id',
      width: 100,
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
          status={score >= 70 ? 'normal' : score >= 50 ? 'exception' : 'exception'}
          strokeColor={score >= 70 ? '#52c41a' : score >= 50 ? '#faad14' : '#ff4d4f'}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'alert_level',
      key: 'alert_level',
      width: 80,
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
    <Card title={title} loading={loading}>
      <Table
        columns={columns}
        dataSource={detections}
        rowKey="id"
        pagination={false}
        scroll={{ y: 400 }}
        size="small"
      />
    </Card>
  );
};
