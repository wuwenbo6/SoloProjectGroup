import React from 'react';
import { Card, List, Tag, Space, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, WarningOutlined } from '@ant-design/icons';
import type { DeviceInfo } from '../types';

const { Text } = Typography;

interface DeviceStatusPanelProps {
  devices: DeviceInfo[];
  loading?: boolean;
}

const statusConfig = {
  online: { color: 'success', icon: <CheckCircleOutlined />, text: '在线' },
  offline: { color: 'default', icon: <CloseCircleOutlined />, text: '离线' },
  busy: { color: 'processing', icon: <WarningOutlined />, text: '忙碌' },
  error: { color: 'error', icon: <CloseCircleOutlined />, text: '故障' },
};

export const DeviceStatusPanel: React.FC<DeviceStatusPanelProps> = ({ devices, loading }) => {
  return (
    <Card
      title="设备状态监控"
      loading={loading}
      extra={
        <Space>
          <Text type="success">
            在线: {devices.filter((d) => d.status === 'online').length}
          </Text>
          <Text type="danger">
            异常: {devices.filter((d) => d.status === 'error' || d.status === 'offline').length}
          </Text>
        </Space>
      }
    >
      <List
        dataSource={devices}
        renderItem={(device) => (
          <List.Item key={device.id}>
            <List.Item.Meta
              avatar={
                <Tag color={statusConfig[device.status].color}>
                  {statusConfig[device.status].icon} {statusConfig[device.status].text}
                </Tag>
              }
              title={device.device_name}
              description={
                <Space direction="vertical" size="small">
                  <Text type="secondary">设备ID: {device.device_id}</Text>
                  <Text type="secondary">位置: {device.location}</Text>
                  <Text type="secondary">检测次数: {device.detection_count || 0}</Text>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
};
