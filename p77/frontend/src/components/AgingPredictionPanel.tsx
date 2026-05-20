import React, { useState, useEffect, useMemo } from 'react';
import { Card, Select, Progress, Space, Typography, Row, Col, Tag, Alert } from 'antd';
import ReactECharts from 'echarts-for-react';
import { predictionApi } from '../services/api';
import type { AgingPrediction } from '../types';

const { Title, Text } = Typography;

const trendLabels: Record<string, string> = {
  stable: '稳定',
  improving: '改善',
  degrading: '老化中',
  unknown: '未知',
};

const warningLevelColors: Record<string, string> = {
  normal: 'green',
  warning: 'orange',
  critical: 'red',
};

export const AgingPredictionPanel: React.FC = () => {
  const [selectedMaterial, setSelectedMaterial] = useState<string>('皮革');
  const [predictions, setPredictions] = useState<AgingPrediction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPredictions();
  }, []);

  const fetchPredictions = async () => {
    setLoading(true);
    try {
      const res = await predictionApi.getAll(30);
      if (res.code === 0) {
        setPredictions(res.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentPrediction = predictions.find((p) => p.material_type === selectedMaterial);

  const chartOption = useMemo(() => {
    if (!currentPrediction) return {};

    const historyDates = currentPrediction.history_data.map((d) => d.date);
    const historyValues = currentPrediction.history_data.map((d) => d.quality);
    const predictedDates = currentPrediction.predicted_data.map((d) => d.date);
    const predictedValues = currentPrediction.predicted_data.map((d) => d.quality);

    return {
      tooltip: {
        trigger: 'axis',
      },
      legend: {
        data: ['历史质量', '预测质量'],
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: [...historyDates, ...predictedDates],
        axisLabel: {
          rotate: 45,
          fontSize: 10,
        },
      },
      yAxis: {
        type: 'value',
        name: '质量评分',
        min: 0,
        max: 100,
      },
      series: [
        {
          name: '历史质量',
          type: 'line',
          smooth: true,
          data: [...historyValues, ...Array(predictedValues.length).fill(null)],
          lineStyle: {
            color: '#1890ff',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
                { offset: 1, color: 'rgba(24, 144, 255, 0.05)' },
              ],
            },
          },
        },
        {
          name: '预测质量',
          type: 'line',
          smooth: true,
          lineStyle: {
            color: '#faad14',
            type: 'dashed',
          },
          data: [...Array(historyValues.length - 1).fill(null), historyValues[historyValues.length - 1] || 60, ...predictedValues],
        },
        {
          name: '警戒线',
          type: 'line',
          lineStyle: {
            color: '#ff4d4f',
            type: 'dotted',
          },
          data: Array(historyValues.length + predictedValues.length).fill(50),
          symbol: 'none',
        },
      ],
    };
  }, [currentPrediction]);

  return (
    <Card
      title="材质老化趋势预测"
      loading={loading}
      extra={
        <Select
          value={selectedMaterial}
          onChange={setSelectedMaterial}
          style={{ width: 120 }}
          options={[
            { value: '皮革', label: '皮革' },
            { value: '纸张', label: '纸张' },
            { value: '木材', label: '木材' },
            { value: '织物', label: '织物' },
            { value: '塑料', label: '塑料' },
          ]}
        />
      }
    >
      {currentPrediction ? (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small" bordered={false}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text type="secondary">当前质量</Text>
                  <Title level={3} style={{ margin: 0 }}>
                    {currentPrediction.current_quality.toFixed(1)}
                  </Title>
                  <Progress
                    percent={Math.round(currentPrediction.current_quality)}
                    status={currentPrediction.current_quality < 50 ? 'exception' : 'active'}
                    size="small"
                  />
                </Space>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" bordered={false}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text type="secondary">剩余寿命</Text>
                  <Title level={3} style={{ margin: 0 }}>
                    {currentPrediction.predicted_days}
                    <Text style={{ fontSize: 14, marginLeft: 4 }}>天</Text>
                  </Title>
                  <Tag color={warningLevelColors[currentPrediction.warning_level] || 'default'}>
                    {currentPrediction.warning_level === 'normal'
                      ? '正常'
                      : currentPrediction.warning_level === 'warning'
                      ? '预警'
                      : '紧急'}
                  </Tag>
                </Space>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" bordered={false}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text type="secondary">趋势状态</Text>
                  <Title level={3} style={{ margin: 0, fontSize: 20 }}>
                    {trendLabels[currentPrediction.trend] || currentPrediction.trend}
                  </Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    置信度: {(currentPrediction.confidence * 100).toFixed(0)}%
                  </Text>
                </Space>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" bordered={false}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text type="secondary">数据点数</Text>
                  <Title level={3} style={{ margin: 0 }}>
                    {currentPrediction.history_data.length}
                    <Text style={{ fontSize: 14, marginLeft: 4 }}>个</Text>
                  </Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    预测 {currentPrediction.predicted_data.length} 天
                  </Text>
                </Space>
              </Card>
            </Col>
          </Row>

          {currentPrediction.warning_level === 'critical' && (
            <Alert
              message="材质老化紧急预警"
              description={`检测到 ${selectedMaterial} 质量下降迅速，预计仅剩余 ${currentPrediction.predicted_days} 天将达到临界值，建议尽快更换材质或采取防护措施。`}
              type="error"
              showIcon
              closable
              style={{ marginBottom: 16 }}
            />
          )}

          <ReactECharts option={chartOption} style={{ height: 350 }} />
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          暂无预测数据，请稍后再试
        </div>
      )}
    </Card>
  );
};
