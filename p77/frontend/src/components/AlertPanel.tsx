import React from 'react';
import { Card, List, Tag, Button, Space, Typography, Badge, message } from 'antd';
import { WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { AlertRecord } from '../types';
import { alertApi } from '../services/api';

const { Text } = Typography;

interface AlertPanelProps {
  alerts: AlertRecord[];
  loading?: boolean;
  onAlertHandled?: () => void;
}

const alertLevelConfig = {
  normal: { color: 'success', text: '正常' },
  warning: { color: 'warning', text: '预警' },
  error: { color: 'error', text: '异常' },
};

export const AlertPanel: React.FC<AlertPanelProps> = ({ alerts, loading, onAlertHandled }) => {
  const unhandledAlerts = alerts.filter((a) => !a.is_handled);

  const handleAlert = async (id: number) => {
    try {
      await alertApi.handle(id, '管理员');
      message.success('预警已处理');
      onAlertHandled?.();
    } catch (error) {
      message.error('处理失败');
    }
  };

  return (
    <Card
      title={
        <Space>
          <Badge count={unhandledAlerts.length} offset={[8, -2]}>
            <span>材质分级预警</span>
          </Badge>
        </Space>
      }
      loading={loading}
      extra={<Text type="danger">未处理: {unhandledAlerts.length}</Text>}
    >
      <List
        dataSource={alerts}
        renderItem={(alert) => (
          <List.Item
            key={alert.id}
            actions={
              !alert.is_handled
                ? [
                    <Button
                      type="link"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleAlert(alert.id)}
                    >
                      处理
                    </Button>,
                  ]
                : []
            }
            style={{
              backgroundColor: alert.is_handled ? '#f9f9f9' : '#fff2f0',
              borderRadius: 4,
              marginBottom: 8,
              padding: '8px 12px',
            }}
          >
            <List.Item.Meta
              avatar={
                <Tag
                  color={alertLevelConfig[alert.alert_level as keyof typeof alertLevelConfig]?.color || 'default'}
                  icon={<WarningOutlined />}
                >
                  {alertLevelConfig[alert.alert_level as keyof typeof alertLevelConfig]?.text || alert.alert_level}
                </Tag>
              }
              title={
                <Space>
                  <Text strong>{alert.alert_type}</Text>
                  <Text type="secondary">设备: {alert.device_id}</Text>
                  {alert.is_handled && <Text type="success">已处理</Text>}
                </Space>
              }
              description={
                <Space direction="vertical" size="small">
                  <Text>{alert.message}</Text>
                  <Text type="secondary">
                    时间: {dayjs(alert.created_at).format('MM-DD HH:mm:ss')}
                  </Text>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
};
