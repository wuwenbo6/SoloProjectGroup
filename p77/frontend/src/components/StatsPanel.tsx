import React from 'react';
import { Card, Row, Col, Statistic, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, BarChartOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { DetectionStats } from '../types';

interface StatsPanelProps {
  stats: DetectionStats[];
  loading?: boolean;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, loading }) => {
  const totalCount = stats.reduce((sum, s) => sum + s.total_count, 0);
  const passCount = stats.reduce((sum, s) => sum + s.pass_count, 0);
  const failCount = totalCount - passCount;
  const avgPassRate = totalCount > 0 ? (passCount / totalCount) * 100 : 0;

  const chartOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
    legend: {
      data: ['检测数量', '合格数量', '合格率(%)'],
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: stats.map((s) => s.date),
      axisLabel: {
        rotate: 30,
      },
    },
    yAxis: [
      {
        type: 'value',
        name: '数量',
        position: 'left',
      },
      {
        type: 'value',
        name: '合格率(%)',
        position: 'right',
        min: 0,
        max: 100,
      },
    ],
    series: [
      {
        name: '检测数量',
        type: 'bar',
        data: stats.map((s) => s.total_count),
        itemStyle: { color: '#1890ff' },
      },
      {
        name: '合格数量',
        type: 'bar',
        data: stats.map((s) => s.pass_count),
        itemStyle: { color: '#52c41a' },
      },
      {
        name: '合格率(%)',
        type: 'line',
        yAxisIndex: 1,
        data: stats.map((s) => s.pass_rate.toFixed(1)),
        itemStyle: { color: '#fa8c16' },
        smooth: true,
      },
    ],
  };

  return (
    <Card title="检测统计分析" loading={loading} extra={<BarChartOutlined />}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Statistic
            title="总检测数"
            value={totalCount}
            valueStyle={{ color: '#1890ff' }}
            prefix={<BarChartOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="合格数"
            value={passCount}
            valueStyle={{ color: '#52c41a' }}
            prefix={<CheckCircleOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="不合格数"
            value={failCount}
            valueStyle={{ color: '#ff4d4f' }}
            prefix={<CloseCircleOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="平均合格率"
            value={avgPassRate}
            precision={1}
            suffix="%"
            valueStyle={{ color: avgPassRate >= 80 ? '#52c41a' : '#fa8c16' }}
          />
        </Col>
      </Row>
      <ReactECharts option={chartOption} style={{ height: 300 }} />
    </Card>
  );
};
