import React, { useState } from 'react';
import { Card, Button, Space, Form, Select, DatePicker, message, Spin, Typography } from 'antd';
import { DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import { exportApi } from '../services/api';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

type ExportType = 'detections' | 'alerts' | 'statistics';

export const ExportPanel: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [exportType, setExportType] = useState<ExportType>('detections');

  const handleExport = async (values: any) => {
    setLoading(true);
    try {
      let blob: Blob;
      let filename: string;

      const params = {
        deviceId: values.deviceId,
        materialType: values.materialType,
        startDate: values.dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: values.dateRange?.[1]?.format('YYYY-MM-DD'),
      };

      switch (exportType) {
        case 'detections':
          blob = await exportApi.exportDetections(params);
          filename = `检测记录_${new Date().toLocaleDateString()}.csv`;
          break;
        case 'alerts':
          blob = await exportApi.exportAlerts({
            alertLevel: values.alertLevel,
            isHandled: values.isHandled,
          });
          filename = `告警记录_${new Date().toLocaleDateString()}.csv`;
          break;
        case 'statistics':
          blob = await exportApi.exportStatistics({ days: 30 });
          filename = `统计数据_${new Date().toLocaleDateString()}.csv`;
          break;
        default:
          return;
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success('导出成功');
    } catch (error) {
      console.error('Export failed:', error);
      message.error('导出失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title={
        <Space>
          <FileExcelOutlined />
          <span>数据导出</span>
        </Space>
      }
    >
      <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleExport}
          initialValues={{
            exportType: 'detections',
          }}
        >
          <Form.Item
            name="exportType"
            label="导出类型"
            rules={[{ required: true, message: '请选择导出类型' }]}
          >
            <Select
              onChange={(value) => setExportType(value)}
              options={[
                { value: 'detections', label: '检测记录' },
                { value: 'alerts', label: '告警记录' },
                { value: 'statistics', label: '统计数据' },
              ]}
            />
          </Form.Item>

          {exportType === 'detections' && (
            <>
              <Form.Item name="deviceId" label="设备ID">
                <Select
                  allowClear
                  placeholder="选择设备"
                  options={[
                    { value: 'DEV001', label: 'DEV001' },
                    { value: 'DEV002', label: 'DEV002' },
                  ]}
                />
              </Form.Item>

              <Form.Item name="materialType" label="材质类型">
                <Select
                  allowClear
                  placeholder="选择材质"
                  options={[
                    { value: '皮革', label: '皮革' },
                    { value: '纸张', label: '纸张' },
                    { value: '木材', label: '木材' },
                    { value: '织物', label: '织物' },
                    { value: '塑料', label: '塑料' },
                  ]}
                />
              </Form.Item>

              <Form.Item name="dateRange" label="日期范围">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}

          {exportType === 'alerts' && (
            <>
              <Form.Item name="alertLevel" label="告警级别">
                <Select
                  allowClear
                  placeholder="选择告警级别"
                  options={[
                    { value: 'normal', label: '正常' },
                    { value: 'warning', label: '预警' },
                    { value: 'error', label: '异常' },
                  ]}
                />
              </Form.Item>

              <Form.Item name="isHandled" label="处理状态">
                <Select
                  allowClear
                  placeholder="选择处理状态"
                  options={[
                    { value: true, label: '已处理' },
                    { value: false, label: '未处理' },
                  ]}
                />
              </Form.Item>
            </>
          )}

          {exportType === 'statistics' && (
            <div style={{ padding: '16px 0', color: '#666' }}>
              <Text type="secondary">导出最近30天的统计数据</Text>
            </div>
          )}

          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<DownloadOutlined />} block>
              导出CSV文件
            </Button>
          </Form.Item>
        </Form>

        <Card size="small" title="导出说明" type="inner">
          <ul style={{ margin: 0, paddingLeft: 20, color: '#666' }}>
            <li>检测记录：包含所有检测数据的详细信息</li>
            <li>告警记录：包含所有材质异常告警信息</li>
            <li>统计数据：包含每日检测数量和合格率统计</li>
            <li>导出格式为CSV，可直接用Excel打开</li>
          </ul>
        </Card>
      </Spin>
    </Card>
  );
};
