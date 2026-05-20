import React from 'react';
import { Card, List, Tag, Typography, Space } from 'antd';
import {
  AlertOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

function AlertsList({ alerts }) {
  const getAlertIcon = (type) => {
    switch (type) {
      case 'danger':
        return <CloseCircleOutlined style={{ color: '#ef4444' }} />;
      case 'warning':
        return <WarningOutlined style={{ color: '#eab308' }} />;
      default:
        return <InfoCircleOutlined style={{ color: '#3b82f6' }} />;
    }
  };

  const getAlertColor = (type) => {
    switch (type) {
      case 'danger':
        return 'red';
      case 'warning':
        return 'orange';
      default:
        return 'blue';
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  };

  return (
    <Card
      title={
        <Space>
          <AlertOutlined />
          <span>告警记录</span>
          <Tag color="red">{alerts.filter((a) => a.type === 'danger').length}</Tag>
        </Space>
      }
      size="small"
      style={{ marginTop: 16 }}
    >
      <List
        size="small"
        dataSource={alerts.slice(0, 10)}
        renderItem={(alert) => (
          <List.Item>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Space>
                {getAlertIcon(alert.type)}
                <Tag color={getAlertColor(alert.type)}>发酵罐 #{alert.fermenterId}</Tag>
                <Text strong>{alert.message}</Text>
              </Space>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {formatTime(alert.timestamp)}
              </Text>
            </Space>
          </List.Item>
        )}
        locale={{ emptyText: '暂无告警记录' }}
      />
    </Card>
  );
}

export default AlertsList;
