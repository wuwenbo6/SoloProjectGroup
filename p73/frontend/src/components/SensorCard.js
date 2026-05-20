import React from 'react';
import { Card, Statistic, Progress, Space, Tag, Typography } from 'antd';
import {
  ThermometerOutlined,
  DropletOutlined,
  BugOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

function SensorCard({ title, icon, value, unit, min, max, status, suffix, precision = 2 }) {
  const percentage = ((value - min) / (max - min)) * 100;
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  const getStatusColor = () => {
    if (value < min || value > max) return '#ef4444';
    if (value < min + (max - min) * 0.1 || value > max - (max - min) * 0.1) return '#eab308';
    return '#22c55e';
  };

  const getStatusIcon = () => {
    if (value < min || value > max) return <CloseCircleOutlined style={{ color: '#ef4444' }} />;
    if (value < min + (max - min) * 0.1 || value > max - (max - min) * 0.1)
      return <WarningOutlined style={{ color: '#eab308' }} />;
    return <CheckCircleOutlined style={{ color: '#22c55e' }} />;
  };

  return (
    <Card size="small">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          {icon}
          <Text strong style={{ fontSize: '16px' }}>
            {title}
          </Text>
          {getStatusIcon()}
        </Space>
        <Statistic
          value={value}
          precision={precision}
          suffix={
            <Space>
              <span style={{ fontSize: '16px' }}>{unit}</span>
              {suffix}
            </Space>
          }
          valueStyle={{ color: getStatusColor() }}
        />
        <Progress
          percent={Math.round(clampedPercentage)}
          showInfo={false}
          strokeColor={[
            {
              offset: 0,
              color: '#3b82f6',
            },
            {
              offset: 100,
              color: getStatusColor(),
            },
          ]}
          trailColor="#334155"
        />
        <Space style={{ width: '100%', justifyContent: 'space-between' }} size="small">
          <Text type="secondary" style={{ fontSize: '12px' }}>
            最小: {min}
            {unit}
          </Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            最大: {max}
            {unit}
          </Text>
        </Space>
      </Space>
    </Card>
  );
}

export function TemperatureCard({ value, min, max, status }) {
  return (
    <SensorCard
      title="温度"
      icon={<ThermometerOutlined style={{ fontSize: '20px', color: '#f59e0b' }} />}
      value={value}
      unit="°C"
      min={min}
      max={max}
      status={status}
    />
  );
}

export function HumidityCard({ value, min, max, status }) {
  return (
    <SensorCard
      title="湿度"
      icon={<DropletOutlined style={{ fontSize: '20px', color: '#3b82f6' }} />}
      value={value}
      unit="%"
      min={min}
      max={max}
      status={status}
    />
  );
}

export function MicrobeCard({ value, min, max, status }) {
  const formatValue = (val) => {
    if (val >= 1000000) return (val / 1000000).toFixed(2) + 'M';
    if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
    return val.toFixed(0);
  };

  return (
    <SensorCard
      title="微生物浓度"
      icon={<BugOutlined style={{ fontSize: '20px', color: '#22c55e' }} />}
      value={value}
      unit="CFU/mL"
      min={min}
      max={max}
      status={status}
      suffix={<Tag color="green">{formatValue(value)}</Tag>}
      precision={0}
    />
  );
}

export default SensorCard;
