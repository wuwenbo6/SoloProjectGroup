import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Progress,
  List,
  Tag,
  Space,
  Typography,
  Button,
  Badge,
  Row,
  Col,
  Alert,
} from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { diagnosticApi } from '../services/api';
import type { DeviceDiagnostic, DiagnosticItem } from '../types';

const { Title, Text, Paragraph } = Typography;

const severityIcons: Record<string, React.ReactNode> = {
  normal: <CheckCircleOutlined />,
  warning: <WarningOutlined />,
  critical: <ExclamationCircleOutlined />,
};

const severityColors: Record<string, string> = {
  normal: 'success',
  warning: 'warning',
  critical: 'error',
};

const diagnosticTypeLabels: Record<string, string> = {
  connection: '连接稳定性',
  consistency: '数据一致性',
  temperature: '设备温度',
  detection_rate: '检测速率',
  error_rate: '错误率',
};

export const DiagnosticPanel: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<DeviceDiagnostic[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  useEffect(() => {
    fetchDiagnostics();
    const interval = setInterval(fetchDiagnostics, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await diagnosticApi.getAll();
      if (res.code === 0) {
        setDiagnostics(res.data || []);
        if (res.data && res.data.length > 0 && !selectedDevice) {
          setSelectedDevice(res.data[0].device_id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch diagnostics:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentDiagnostic = diagnostics.find((d) => d.device_id === selectedDevice);

  const worstSeverity = useMemo(() => {
    if (!currentDiagnostic) return 'normal';
    const severities = currentDiagnostic.diagnostics.map((d) => d.severity);
    if (severities.includes('critical')) return 'critical';
    if (severities.includes('warning')) return 'warning';
    return 'normal';
  }, [currentDiagnostic]);

  const renderDiagnosticItem = (item: DiagnosticItem) => {
    const isWarning = item.status !== 'ok';

    return (
      <List.Item
        key={item.type}
        style={{
          padding: '12px 16px',
          backgroundColor: isWarning ? 'rgba(255, 77, 79, 0.05)' : 'transparent',
          borderRadius: 8,
          marginBottom: 8,
        }}
      >
        <List.Item.Meta
          avatar={
            <Tag
              icon={severityIcons[item.severity]}
              color={severityColors[item.severity]}
              style={{ margin: 0 }}
            >
              {item.severity === 'normal' ? '正常' : item.severity === 'warning' ? '警告' : '异常'}
            </Tag>
          }
          title={
            <Space>
              <Text strong>{diagnosticTypeLabels[item.type] || item.type}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                当前值: {item.value.toFixed(1)} / 阈值: {item.threshold.toFixed(1)}
              </Text>
            </Space>
          }
          description={<Paragraph style={{ margin: 0, fontSize: 13 }}>{item.message}</Paragraph>}
        />
      </List.Item>
    );
  };

  return (
    <Card
      title={
        <Space>
          <ToolOutlined />
          <span>设备健康诊断</span>
        </Space>
      }
      loading={loading}
      extra={
        <Button icon={<ReloadOutlined />} size="small" onClick={fetchDiagnostics}>
          刷新
        </Button>
      }
    >
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card size="small" title="设备列表" style={{ height: '100%' }}>
            <List
              dataSource={diagnostics}
              renderItem={(item) => (
                <List.Item
                  key={item.device_id}
                  onClick={() => setSelectedDevice(item.device_id)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor:
                      selectedDevice === item.device_id ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
                    borderRadius: 4,
                    padding: '8px 12px',
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge
                        status={
                          item.health_score >= 80
                            ? 'success'
                            : item.health_score >= 60
                            ? 'warning'
                            : 'error'
                        }
                      />
                    }
                    title={<Text strong>{item.device_name}</Text>}
                    description={<Text type="secondary">ID: {item.device_id}</Text>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col span={18}>
          {currentDiagnostic ? (
            <div>
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <Card size="small" bordered={false}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text type="secondary">健康评分</Text>
                      <Title level={3} style={{ margin: 0 }}>
                        {currentDiagnostic.health_score.toFixed(1)}
                      </Title>
                      <Progress
                        percent={Math.round(currentDiagnostic.health_score)}
                        status={
                          currentDiagnostic.health_score < 60
                            ? 'exception'
                            : currentDiagnostic.health_score < 80
                            ? 'normal'
                            : 'active'
                        }
                        size="small"
                        strokeColor={
                          currentDiagnostic.health_score >= 80
                            ? '#52c41a'
                            : currentDiagnostic.health_score >= 60
                            ? '#faad14'
                            : '#ff4d4f'
                        }
                      />
                    </Space>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" bordered={false}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text type="secondary">设备状态</Text>
                      <Title level={3} style={{ margin: 0, fontSize: 20 }}>
                        <Badge
                          status={currentDiagnostic.status === 'online' ? 'success' : 'error'}
                          text={currentDiagnostic.status === 'online' ? '在线' : '离线'}
                        />
                      </Title>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        上次检测: {new Date(currentDiagnostic.last_check).toLocaleString()}
                      </Text>
                    </Space>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" bordered={false}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text type="secondary">维护状态</Text>
                      <Title level={3} style={{ margin: 0, fontSize: 20 }}>
                        {currentDiagnostic.maintenance_due ? (
                          <Tag color="red">需要维护</Tag>
                        ) : (
                          <Tag color="green">无需维护</Tag>
                        )}
                      </Title>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        诊断项: {currentDiagnostic.diagnostics.length} 项
                      </Text>
                    </Space>
                  </Card>
                </Col>
              </Row>

              {worstSeverity === 'critical' && (
                <Alert
                  message="设备异常警告"
                  description="检测到设备存在严重异常情况，建议立即进行维护检查，以避免生产中断。"
                  type="error"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}

              {worstSeverity === 'warning' && (
                <Alert
                  message="设备状态提醒"
                  description="设备存在部分警告项，建议在近期安排预防性维护。"
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}

              <Card size="small" title="诊断详情" style={{ marginBottom: 16 }}>
                <List dataSource={currentDiagnostic.diagnostics} renderItem={renderDiagnosticItem} />
              </Card>

              <Card size="small" title="维护建议">
                <List
                  dataSource={currentDiagnostic.recommendations}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Tag color="blue">建议</Tag>}
                        description={<Text>{item}</Text>}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
              请选择设备查看诊断详情
            </div>
          )}
        </Col>
      </Row>
    </Card>
  );
};
