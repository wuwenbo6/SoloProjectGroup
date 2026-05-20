import React, { useState } from 'react';
import CameraConnection from './components/CameraConnection';
import ParamsTuning from './components/ParamsTuning';
import Scanning from './components/Scanning';
import ImageRestoration from './components/ImageRestoration';
import ImageEnhancement from './components/ImageEnhancement';
import PhotoArchive from './components/PhotoArchive';
import TagManager from './components/TagManager';

function App() {
  const [activePage, setActivePage] = useState('camera');

  const pages = [
    { id: 'camera', name: '相机连接' },
    { id: 'params', name: '参数调试' },
    { id: 'scanning', name: '扫描转录' },
    { id: 'restoration', name: '图像修复' },
    { id: 'enhancement', name: '图像增强' },
    { id: 'archive', name: '档案管理' },
    { id: 'tags', name: '标签管理' }
  ];

  const renderPage = () => {
    switch (activePage) {
      case 'camera':
        return <CameraConnection />;
      case 'params':
        return <ParamsTuning />;
      case 'scanning':
        return <Scanning />;
      case 'restoration':
        return <ImageRestoration />;
      case 'enhancement':
        return <ImageEnhancement />;
      case 'archive':
        return <PhotoArchive />;
      case 'tags':
        return <TagManager />;
      default:
        return <CameraConnection />;
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>胶片数字化助手</h1>
        <nav className="nav">
          {pages.map(page => (
            <button
              key={page.id}
              className={activePage === page.id ? 'active' : ''}
              onClick={() => setActivePage(page.id)}
            >
              {page.name}
            </button>
          ))}
        </nav>
      </header>
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
