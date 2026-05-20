import React, { useState, useEffect } from 'react';
import { Card, List, Tag, Button, Space, Typography, message, Tooltip } from 'antd';
import { WarningOutlined, CheckCircleOutlined, BulbOutlined, CloseCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { apiService } from '../services/api';

const { Text, Title } = Typography;

function FaultDiagnosis({ fermenterId }) {
	const [faults, setFaults] = useState([]);

	useEffect(() => {
		loadFaults();
		const interval = setInterval(loadFaults, 30000);
		return () => clearInterval(interval);
	}, [fermenterId]);

	const loadFaults = async () => {
		try {
			const data = await apiService.getFaultDiagnosis(fermenterId);
			setFaults(data || []);
		} catch (error) {
			console.error('加载故障诊断失败:', error);
		}
	};

	const handleResolve = async (faultId) => {
		try {
			await apiService.resolveFault(faultId);
			message.success('故障已标记为解决');
			loadFaults();
		} catch (error) {
			console.error('解决故障失败:', error);
			message.error('操作失败，请重试');
		}
	};

	const getSeverityIcon = (severity) => {
		switch (severity) {
			case 'danger':
				return <CloseCircleOutlined style={{ color: '#ef4444' }} />;
			case 'warning':
				return <WarningOutlined style={{ color: '#f59e0b' }} />;
			default:
				return <InfoCircleOutlined style={{ color: '#3b82f6' }} />;
		}
	};

	const getSeverityColor = (severity) => {
		switch (severity) {
			case 'danger':
				return 'red';
			case 'warning':
				return 'orange';
			default:
				return 'blue';
		}
	};

	return (
		<Card
			title={
				<Space>
					<WarningOutlined />
					<span>故障诊断</span>
					{faults.length > 0 && (
						<Tag color="red">{faults.length} 个待处理</Tag>
					)}
				</Space>
			}
			size="small"
			style={{ marginTop: 16 }}
		>
			{faults.length === 0 ? (
				<Space direction="vertical" style={{ width: '100%', textAlign: 'center', padding: '20px 0' }}>
					<CheckCircleOutlined style={{ fontSize: '48px', color: '#22c55e' }} />
					<Text type="secondary">系统运行正常，无故障检测</Text>
				</Space>
			) : (
				<List
					dataSource={faults}
					renderItem={(fault) => (
						<List.Item
							actions={[
								<Button
									type="primary"
									size="small"
									onClick={() => handleResolve(fault.id)}
								>
									标记解决
								</Button>
							]}
						>
							<List.Item.Meta
								avatar={getSeverityIcon(fault.severity)}
								title={
									<Space>
										<Text strong>{fault.faultType}</Text>
										<Tag color={getSeverityColor(fault.severity)}>{fault.severity}</Tag>
									</Space>
								}
								description={
									<Space direction="vertical" size="small" style={{ width: '100%' }}>
										<Text type="secondary">{fault.description}</Text>
										<Space>
											<BulbOutlined style={{ color: '#3b82f6' }} />
											<Text type="secondary" style={{ fontSize: '12px' }}>
												建议: {fault.suggestion}
											</Text>
										</Space>
										<Text type="secondary" style={{ fontSize: '12px' }}>
											检测时间: {new Date(fault.timestamp).toLocaleString('zh-CN')}
										</Text>
									</Space>
								}
							/>
						</List.Item>
					)}
				/>
			)}
		</Card>
	);
}

export default FaultDiagnosis;
