import React, { useState, useEffect } from 'react';
import { Layout, ConfigProvider, theme } from 'antd';
import { DashboardOutlined } from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Settings from './components/Settings';
import { apiService } from './services/api';
import './App.css';

const { Header, Content, Sider } = Layout;

function App() {
  const [settings, setSettings] = useState(null);
  const [fermenters, setFermenters] = useState([]);
  const [settingsUpdated, setSettingsUpdated] = useState(0);

  useEffect(() => {
    loadSettings();
    loadFermenters();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await apiService.getSettings();
      setSettings(data);
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  };

  const loadFermenters = async () => {
    try {
      const data = await apiService.getFermenters();
      setFermenters(data);
    } catch (error) {
      console.error('加载发酵罐列表失败:', error);
    }
  };

  const handleSettingsUpdate = async (newSettings) => {
    try {
      await apiService.updateSettings(newSettings);
      setSettings(newSettings);
      setSettingsUpdated(prev => prev + 1);
    } catch (error) {
      console.error('更新配置失败:', error);
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#3b82f6',
        },
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
          <DashboardOutlined style={{ fontSize: '24px', marginRight: '12px' }} />
          <h1 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>酿酒发酵监控操作台</h1>
        </Header>
        <Layout>
          <Sider width={280} style={{ background: '#1e293b', padding: '16px' }}>
            <Settings settings={settings} onUpdate={handleSettingsUpdate} />
          </Sider>
          <Layout style={{ padding: '24px' }}>
            <Content>
              <Dashboard fermenters={fermenters} settings={settings} onSettingsUpdate={settingsUpdated} />
            </Content>
          </Layout>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
