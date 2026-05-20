import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Row, Col, Card, Select, Space, Progress, List, Tag, Typography, Badge, Alert } from 'antd';
import { TemperatureCard, HumidityCard, MicrobeCard } from '../components/SensorCard';
import TrendChart from '../components/TrendChart';
import AlertsList from '../components/AlertsList';
import ExportReport from '../components/ExportReport';
import FaultDiagnosis from '../components/FaultDiagnosis';
import AdjustmentRecords from '../components/AdjustmentRecords';
import { apiService } from '../services/api';
import {
	ClockCircleOutlined,
	HeartOutlined,
	BulbOutlined,
	CheckCircleOutlined,
	PauseCircleOutlined,
	LineChartOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;
const { Option } = Select;

function Dashboard({ fermenters, settings, onSettingsUpdate }) {
	const [selectedFermenter, setSelectedFermenter] = useState(1);
	const [currentData, setCurrentData] = useState(null);
	const [historyData, setHistoryData] = useState([]);
	const [alerts, setAlerts] = useState([]);
	const [analysis, setAnalysis] = useState(null);
	const [isLoading, setIsLoading] = useState(false);

	const defaultSettings = useMemo(() => ({
		tempMin: 20,
		tempMax: 35,
		humidityMin: 40,
		humidityMax: 70,
		microbeMin: 1000,
		microbeMax: 1000000,
		sampleInterval: 5000,
		...settings,
	}), [settings]);

	const loadRealtimeData = useCallback(async () => {
		if (isLoading) return;
		setIsLoading(true);
		try {
			const [data, analysisData] = await Promise.all([
				apiService.getCurrentData(selectedFermenter),
				apiService.getAnalysis(selectedFermenter),
			]);
			setCurrentData(data);
			setAnalysis(analysisData);
		} catch (error) {
			console.error('加载实时数据失败:', error);
		} finally {
			setIsLoading(false);
		}
	}, [selectedFermenter, isLoading]);

	const loadHistoryData = useCallback(async () => {
		try {
			const [history, alertsData] = await Promise.all([
				apiService.getHistoryData(selectedFermenter, 24),
				apiService.getAlerts(),
			]);
			setHistoryData(history);
			setAlerts(alertsData);
		} catch (error) {
			console.error('加载历史数据失败:', error);
		}
	}, [selectedFermenter]);

	useEffect(() => {
		loadRealtimeData();
		loadHistoryData();
		const realtimeInterval = setInterval(loadRealtimeData, defaultSettings.sampleInterval);
		const historyInterval = setInterval(loadHistoryData, defaultSettings.sampleInterval * 6);
		return () => {
			clearInterval(realtimeInterval);
			clearInterval(historyInterval);
		};
	}, [loadRealtimeData, loadHistoryData, defaultSettings.sampleInterval]);

	useEffect(() => {
		if (onSettingsUpdate) {
			loadRealtimeData();
			loadHistoryData();
		}
	}, [onSettingsUpdate, loadRealtimeData, loadHistoryData]);

	const getStatusBadge = useCallback((status) => {
		const statusConfig = {
			running: { status: 'processing', text: '运行中' },
			idle: { status: 'default', text: '待机' },
			error: { status: 'error', text: '故障' },
		};
		const config = statusConfig[status] || statusConfig.idle;
		return <Badge status={config.status} text={config.text} />;
	}, []);

	const getTrendIcon = useCallback((trend) => {
		switch (trend) {
			case 'rising':
				return '📈';
			case 'falling':
				return '📉';
			default:
				return '➡️';
		}
	}, []);

	const memoizedTrendChart = useMemo(() => {
		return <TrendChart data={historyData} />;
	}, [historyData]);

	const memoizedFaultDiagnosis = useMemo(() => {
		return <FaultDiagnosis fermenterId={selectedFermenter} />;
	}, [selectedFermenter]);

	const memoizedAdjustmentRecords = useMemo(() => {
		return <AdjustmentRecords fermenterId={selectedFermenter} />;
	}, [selectedFermenter]);

	return (
		<Space direction="vertical" style={{ width: '100%' }} size="large">
			<Row gutter={[16, 16]}>
				<Col span={24}>
					<Card size="small">
						<Space style={{ width: '100%' }}>
							<Title level={4} style={{ margin: 0 }}>
								发酵罐选择
							</Title>
							<Select
								value={selectedFermenter}
								onChange={setSelectedFermenter}
								style={{ width: 200 }}
							>
								{fermenters.map((fermenter) => (
									<Option key={fermenter.id} value={fermenter.id}>
										<Space>
											{fermenter.name}
											{getStatusBadge(fermenter.status)}
										</Space>
									</Option>
								))}
							</Select>
						</Space>
					</Card>
				</Col>
			</Row>

			{currentData && (
				<>
					<Row gutter={[16, 16]}>
						<Col xs={24} sm={8}>
							<TemperatureCard
								value={currentData.temperature}
								min={defaultSettings.tempMin}
								max={defaultSettings.tempMax}
								status={currentData.status}
							/>
						</Col>
						<Col xs={24} sm={8}>
							<HumidityCard
								value={currentData.humidity}
								min={defaultSettings.humidityMin}
								max={defaultSettings.humidityMax}
								status={currentData.status}
							/>
						</Col>
						<Col xs={24} sm={8}>
							<MicrobeCard
								value={currentData.microbeConcentration}
								min={defaultSettings.microbeMin}
								max={defaultSettings.microbeMax}
								status={currentData.status}
							/>
						</Col>
					</Row>

					<Row gutter={[16, 16]}>
						<Col xs={24} lg={16}>
							{memoizedTrendChart}
						</Col>
						<Col xs={24} lg={8}>
							{analysis && (
								<Card title="实时分析">
									<Space direction="vertical" style={{ width: '100%' }} size="large">
										<div>
											<Text type="secondary">健康度评分</Text>
											<Progress
												type="circle"
												percent={Math.round(analysis.healthScore || 85)}
												strokeColor={{
													'0%': '#22c55e',
													'100%': '#3b82f6',
												}}
												trailColor="#334155"
												size={120}
											/>
										</div>

										<List
											size="small"
											dataSource={[
												{ label: '温度趋势', value: analysis.temperatureTrend },
												{ label: '湿度趋势', value: analysis.humidityTrend },
												{ label: '微生物趋势', value: analysis.microbeTrend },
											]}
											renderItem={(item) => (
												<List.Item>
													<Space style={{ width: '100%', justifyContent: 'space-between' }}>
														<Text type="secondary">{item.label}</Text>
														<Tag>
															{getTrendIcon(item.value)} {item.value}
														</Tag>
													</Space>
												</List.Item>
											)}
										/>

										<div>
											<Space>
												<ClockCircleOutlined style={{ color: '#3b82f6' }} />
												<Text type="secondary">预计完成:</Text>
												<Text strong>{analysis.estimatedCompletion || 72} 小时</Text>
											</Space>
										</div>

										<div>
											<Space direction="vertical" size="small">
												<Text type="secondary">
													<BulbOutlined style={{ marginRight: 4 }} />
													建议:
												</Text>
												<List
													size="small"
													dataSource={analysis.recommendations || ['发酵正常']}
													renderItem={(rec) => (
														<List.Item style={{ padding: '4px 0' }}>
															<Text style={{ fontSize: '12px' }}>• {rec}</Text>
														</List.Item>
													)}
												/>
											</Space>
										</div>
									</Space>
								</Card>
							)}
							<AlertsList alerts={alerts} />
							<ExportReport fermenterId={selectedFermenter} />
							{memoizedFaultDiagnosis}
							{memoizedAdjustmentRecords}
						</Col>
					</Row>
				</>
			)}
		</Space>
	);
}

export default Dashboard;
