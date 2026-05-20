import React, { useState } from 'react';
import { Card, Button, Space, Select, DatePicker, message, Typography, DownloadOutlined } from 'antd';
import { apiService } from '../services/api';

const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

function ExportReport({ fermenterId }) {
	const [timeRange, setTimeRange] = useState([
		new Date(Date.now() - 24 * 60 * 60 * 1000),
		new Date()
	]);
	const [format, setFormat] = useState('csv');
	const [loading, setLoading] = useState(false);

	const handleExport = async () => {
		if (!fermenterId) {
			message.warning('请选择发酵罐');
			return;
		}

		setLoading(true);
		try {
			const startTime = timeRange[0].toISOString();
			const endTime = timeRange[1].toISOString();

			const blob = await apiService.exportReport(fermenterId, startTime, endTime, format);

			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `fermentation_report_${fermenterId}_${new Date().toISOString().slice(0, 10)}.${format}`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);

			message.success('报表导出成功');
		} catch (error) {
			console.error('导出失败:', error);
			message.error('导出失败，请重试');
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card
			title={
				<Space>
					<DownloadOutlined />
					<span>数据导出</span>
				</Space>
			}
			size="small"
			style={{ marginTop: 16 }}
		>
			<Space direction="vertical" style={{ width: '100%' }} size="middle">
				<div>
					<Title level={5} style={{ marginBottom: 8 }}>时间范围</Title>
					<RangePicker
						value={timeRange}
						onChange={setTimeRange}
						showTime
						style={{ width: '100%' }}
						disabledDate={(current) => current && current > Date.now()}
					/>
				</div>

				<div>
					<Title level={5} style={{ marginBottom: 8 }}>导出格式</Title>
					<Select
						value={format}
						onChange={setFormat}
						style={{ width: '100%' }}
					>
						<Option value="csv">CSV 格式</Option>
						<Option value="json">JSON 格式</Option>
					</Select>
				</div>

				<Button
					type="primary"
					icon={<DownloadOutlined />}
					onClick={handleExport}
					loading={loading}
					block
				>
					导出报表
				</Button>
			</Space>
		</Card>
	);
}

export default ExportReport;
