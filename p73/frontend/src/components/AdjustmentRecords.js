import React, { useState, useEffect } from 'react';
import { Card, List, Tag, Space, Typography, Tooltip } from 'antd';
import { ThunderboltOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { apiService } from '../services/api';

const { Text } = Typography;

function AdjustmentRecords({ fermenterId }) {
	const [records, setRecords] = useState([]);

	useEffect(() => {
		loadRecords();
		const interval = setInterval(loadRecords, 30000);
		return () => clearInterval(interval);
	}, [fermenterId]);

	const loadRecords = async () => {
		try {
			const data = await apiService.getAdjustmentRecords(fermenterId, 10);
			setRecords(data || []);
		} catch (error) {
			console.error('加载调整记录失败:', error);
		}
	};

	const getParameterIcon = (parameter) => {
		if (parameter.includes('温度')) {
			return <ThunderboltOutlined style={{ color: '#f59e0b' }} />;
		} else if (parameter.includes('湿度')) {
			return <ThunderboltOutlined style={{ color: '#3b82f6' }} />;
		}
		return <ThunderboltOutlined style={{ color: '#22c55e' }} />;
	};

	const getTrendIcon = (oldValue, newValue) => {
		if (newValue > oldValue) {
			return <ArrowUpOutlined style={{ color: '#ef4444' }} />;
		}
		return <ArrowDownOutlined style={{ color: '#22c55e' }} />;
	};

	return (
		<Card
			title={
				<Space>
					<ThunderboltOutlined />
					<span>自动调整记录</span>
				</Space>
			}
			size="small"
			style={{ marginTop: 16 }}
		>
			{records.length === 0 ? (
				<Space direction="vertical" style={{ width: '100%', textAlign: 'center', padding: '20px 0' }}>
					<Text type="secondary">暂无自动调整记录</Text>
				</Space>
			) : (
				<List
					dataSource={records}
					renderItem={(record) => (
						<List.Item>
							<List.Item.Meta
								avatar={getParameterIcon(record.parameter)}
								title={
									<Space>
										<Text strong>{record.parameter}</Text>
										{record.autoAdjusted && (
											<Tag color="blue">自动调整</Tag>
										)}
									</Space>
								}
								description={
									<Space direction="vertical" size="small" style={{ width: '100%' }}>
										<Space>
											<Text type="secondary">调整前:</Text>
											<Text strong>{record.oldValue.toFixed(2)}</Text>
											{getTrendIcon(record.oldValue, record.newValue)}
											<Text type="secondary">调整后:</Text>
											<Text strong style={{ color: '#22c55e' }}>{record.newValue.toFixed(2)}</Text>
										</Space>
										<Text type="secondary" style={{ fontSize: '12px' }}>
											原因: {record.reason}
										</Text>
										<Text type="secondary" style={{ fontSize: '12px' }}>
											时间: {new Date(record.timestamp).toLocaleString('zh-CN')}
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

export default AdjustmentRecords;
