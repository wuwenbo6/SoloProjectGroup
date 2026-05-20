import React from 'react';
import { Card, Tabs, Typography } from 'antd';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { LineChartOutlined } from '@ant-design/icons';

const { Title } = Typography;

function TrendChart({ data }) {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const formattedData = data.map((item) => ({
    ...item,
    time: formatTime(item.timestamp),
  }));

  const tempData = formattedData.map((item) => ({
    time: item.time,
    温度: item.temperature.toFixed(2),
  }));

  const humidityData = formattedData.map((item) => ({
    time: item.time,
    湿度: item.humidity.toFixed(2),
  }));

  const microbeData = formattedData.map((item) => ({
    time: item.time,
    微生物浓度: Math.round(item.microbeConcentration / 1000),
  }));

  const items = [
    {
      key: 'temperature',
      label: '温度趋势',
      children: (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={tempData}>
            <defs>
              <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} unit="°C" />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="温度"
              stroke="#f59e0b"
              fill="url(#tempGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      ),
    },
    {
      key: 'humidity',
      label: '湿度趋势',
      children: (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={humidityData}>
            <defs>
              <linearGradient id="humidityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} unit="%" />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="湿度"
              stroke="#3b82f6"
              fill="url(#humidityGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      ),
    },
    {
      key: 'microbe',
      label: '微生物浓度趋势',
      children: (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={microbeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} unit="K" />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="微生物浓度"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
  ];

  return (
    <Card
      title={
        <span>
          <LineChartOutlined style={{ marginRight: 8 }} />
          趋势分析
        </span>
      }
    >
      <Tabs items={items} defaultActiveKey="temperature" />
    </Card>
  );
}

export default TrendChart;
