import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout, Tabs, Row, Col, Badge, message, notification } from 'antd';
import {
  DashboardOutlined,
  HistoryOutlined,
  WifiOutlined,
  LineChartOutlined,
  ToolOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { DeviceStatusPanel } from '../components/DeviceStatusPanel';
import { DetectionPanel } from '../components/DetectionPanel';
import { MaterialParamPanel } from '../components/MaterialParamPanel';
import { AlertPanel } from '../components/AlertPanel';
import { StatsPanel } from '../components/StatsPanel';
import { HistoryQuery } from '../components/HistoryQuery';
import { AgingPredictionPanel } from '../components/AgingPredictionPanel';
import { DiagnosticPanel } from '../components/DiagnosticPanel';
import { ExportPanel } from '../components/ExportPanel';
import { useWebSocket } from '../hooks/useWebSocket';
import { deviceApi, detectionApi, materialApi, alertApi } from '../services/api';
import type { DeviceInfo, DetectionRecord, MaterialParam, AlertRecord, DetectionStats } from '../types';

const { Header, Content } = Layout;

export const Dashboard: React.FC = () => {
  const { isConnected, latestDetection, latestAlert } = useWebSocket();
  
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [detections, setDetections] = useState<DetectionRecord[]>([]);
  const [materialParams, setMaterialParams] = useState<MaterialParam[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [stats, setStats] = useState<DetectionStats[]>([]);
  const [loading, setLoading] = useState(false);

  const lastDetectionIdRef = useRef<number | null>(null);
  const lastAlertIdRef = useRef<number | null>(null);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [devicesRes, detectionsRes, paramsRes, alertsRes, statsRes] = await Promise.all([
        deviceApi.getAll(),
        detectionApi.getLatest(10),
        materialApi.getAll(),
        alertApi.getLatest(10),
        detectionApi.getStats(7),
      ]);

      if (devicesRes.code === 0) setDevices(devicesRes.data || []);
      if (detectionsRes.code === 0) setDetections(detectionsRes.data || []);
      if (paramsRes.code === 0) setMaterialParams(paramsRes.data || []);
      if (alertsRes.code === 0) setAlerts(alertsRes.data || []);
      if (statsRes.code === 0) setStats(statsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 30000);
    return () => {
      clearInterval(interval);
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (latestDetection && latestDetection.id !== lastDetectionIdRef.current) {
      lastDetectionIdRef.current = latestDetection.id;
      
      setDetections((prev) => {
        if (prev.some(d => d.id === latestDetection.id)) {
          return prev;
        }
        return [latestDetection, ...prev.slice(0, 9)];
      });

      const levelText = latestDetection.alert_level === 'error' ? '异常' : 
                        latestDetection.alert_level === 'warning' ? '预警' : '正常';
      const msgType = latestDetection.alert_level === 'error' ? 'error' : 
                      latestDetection.alert_level === 'warning' ? 'warning' : 'success';
      
      message[msgType]({
        content: `新检测结果: ${latestDetection.material_type} - 评分: ${latestDetection.quality_score.toFixed(1)} - ${levelText}`,
        duration: 3,
      });
    }
  }, [latestDetection]);

  useEffect(() => {
    if (latestAlert && latestAlert.id !== lastAlertIdRef.current && !latestAlert.is_handled) {
      lastAlertIdRef.current = latestAlert.id;
      
      setAlerts((prev) => {
        if (prev.some(a => a.id === latestAlert.id)) {
          return prev;
        }
        return [latestAlert, ...prev.slice(0, 9)];
      });

      const notifType = latestAlert.alert_level === 'error' ? 'error' : 'warning';
      notification[notifType]({
        message: `材质${latestAlert.alert_level === 'error' ? '异常' : '预警'}`,
        description: `[${latestAlert.device_id}] ${latestAlert.message}`,
        duration: latestAlert.alert_level === 'error' ? 8 : 5,
        placement: 'topRight',
      });
    }
  }, [latestAlert]);

  const tabItems = [
    {
      key: '1',
      label: (
        <span>
          <DashboardOutlined />
          监控操作台
        </span>
      ),
      children: (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <DeviceStatusPanel devices={devices} loading={loading} />
            </Col>
            <Col span={16}>
              <StatsPanel stats={stats} loading={loading} />
            </Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={16}>
              <DetectionPanel detections={detections} loading={loading} />
            </Col>
            <Col span={8}>
              <AlertPanel alerts={alerts} loading={loading} onAlertHandled={fetchAllData} />
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <MaterialParamPanel params={materialParams} loading={loading} />
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: '2',
      label: (
        <span>
          <HistoryOutlined />
          历史数据查询
        </span>
      ),
      children: <HistoryQuery />,
    },
    {
      key: '3',
      label: (
        <span>
          <LineChartOutlined />
          老化预测
        </span>
      ),
      children: <AgingPredictionPanel />,
    },
    {
      key: '4',
      label: (
        <span>
          <ToolOutlined />
          设备诊断
        </span>
      ),
      children: <DiagnosticPanel />,
    },
    {
      key: '5',
      label: (
        <span>
          <DownloadOutlined />
          数据导出
        </span>
      ),
      children: <ExportPanel />,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          background: '#001529',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1 style={{ color: '#fff', margin: 0, fontSize: 20 }}>皮影道具材质检测监控平台</h1>
        <div style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 20 }}>
          <Badge status={isConnected ? 'success' : 'error'} />
          <span>{isConnected ? <WifiOutlined /> : '断开连接'}</span>
          <span>{new Date().toLocaleString()}</span>
        </div>
      </Header>
      <Content style={{ padding: 24, background: '#f0f2f5' }}>
        <Tabs defaultActiveKey="1" items={tabItems} />
      </Content>
    </Layout>
  );
};
