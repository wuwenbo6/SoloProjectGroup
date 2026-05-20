import React from 'react';
import { Card, Form, InputNumber, Button, Space, Divider } from 'antd';
import { SettingOutlined, SaveOutlined } from '@ant-design/icons';

function Settings({ settings, onUpdate }) {
  const [form] = Form.useForm();

  const handleSubmit = (values) => {
    if (onUpdate) {
      onUpdate(values);
    }
  };

  return (
    <Card
      title={
        <Space>
          <SettingOutlined />
          <span>参数配置</span>
        </Space>
      }
      size="small"
      style={{ marginBottom: 16 }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={settings || {}}
        onFinish={handleSubmit}
        size="small"
      >
        <Divider style={{ margin: '8px 0' }}>温度范围 (°C)</Divider>
        <Form.Item label="最低温度" name="tempMin">
          <InputNumber min={0} max={50} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="最高温度" name="tempMax">
          <InputNumber min={0} max={50} style={{ width: '100%' }} />
        </Form.Item>

        <Divider style={{ margin: '8px 0' }}>湿度范围 (%)</Divider>
        <Form.Item label="最低湿度" name="humidityMin">
          <InputNumber min={0} max={100} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="最高湿度" name="humidityMax">
          <InputNumber min={0} max={100} style={{ width: '100%' }} />
        </Form.Item>

        <Divider style={{ margin: '8px 0' }}>微生物浓度 (CFU/mL)</Divider>
        <Form.Item label="最低浓度" name="microbeMin">
          <InputNumber min={0} max={10000000} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="最高浓度" name="microbeMax">
          <InputNumber min={0} max={10000000} style={{ width: '100%' }} />
        </Form.Item>

        <Divider style={{ margin: '8px 0' }}>采样设置</Divider>
        <Form.Item label="采样间隔 (ms)" name="sampleInterval">
          <InputNumber min={1000} max={60000} step={1000} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} block>
            保存配置
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

export default Settings;
