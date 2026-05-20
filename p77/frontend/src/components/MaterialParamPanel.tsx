import React from 'react';
import { Card, Table, Typography } from 'antd';
import type { MaterialParam } from '../types';

const { Text } = Typography;

interface MaterialParamPanelProps {
  params: MaterialParam[];
  loading?: boolean;
}

export const MaterialParamPanel: React.FC<MaterialParamPanelProps> = ({ params, loading }) => {
  const columns = [
    {
      title: '材质类型',
      dataIndex: 'material_type',
      key: 'material_type',
      width: 100,
      fixed: 'left' as const,
      render: (type: string) => <Text strong>{type}</Text>,
    },
    {
      title: '厚度范围(mm)',
      children: [
        {
          title: '最小值',
          dataIndex: 'min_thickness',
          key: 'min_thickness',
          width: 90,
          render: (val: number) => val?.toFixed(2),
        },
        {
          title: '最大值',
          dataIndex: 'max_thickness',
          key: 'max_thickness',
          width: 90,
          render: (val: number) => val?.toFixed(2),
        },
      ],
    },
    {
      title: '硬度范围',
      children: [
        {
          title: '最小值',
          dataIndex: 'min_hardness',
          key: 'min_hardness',
          width: 80,
          render: (val: number) => val?.toFixed(1),
        },
        {
          title: '最大值',
          dataIndex: 'max_hardness',
          key: 'max_hardness',
          width: 80,
          render: (val: number) => val?.toFixed(1),
        },
      ],
    },
    {
      title: '抗拉强度范围',
      children: [
        {
          title: '最小值',
          dataIndex: 'min_tensile_strength',
          key: 'min_tensile_strength',
          width: 90,
          render: (val: number) => val?.toFixed(1),
        },
        {
          title: '最大值',
          dataIndex: 'max_tensile_strength',
          key: 'max_tensile_strength',
          width: 90,
          render: (val: number) => val?.toFixed(1),
        },
      ],
    },
    {
      title: '湿度范围(%)',
      children: [
        {
          title: '最小值',
          dataIndex: 'min_moisture',
          key: 'min_moisture',
          width: 80,
          render: (val: number) => val?.toFixed(1),
        },
        {
          title: '最大值',
          dataIndex: 'max_moisture',
          key: 'max_moisture',
          width: 80,
          render: (val: number) => val?.toFixed(1),
        },
      ],
    },
    {
      title: '合格分数',
      dataIndex: 'pass_score',
      key: 'pass_score',
      width: 90,
      render: (val: number) => <Text type="success">{val}</Text>,
    },
    {
      title: '预警阈值',
      dataIndex: 'warn_threshold',
      key: 'warn_threshold',
      width: 90,
      render: (val: number) => <Text type="warning">{val}</Text>,
    },
  ];

  return (
    <Card title="材质参数标准" loading={loading}>
      <Table
        columns={columns}
        dataSource={params}
        rowKey="id"
        pagination={false}
        scroll={{ x: 1000 }}
        size="small"
      />
    </Card>
  );
};
