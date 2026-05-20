import React from 'react';
import FactoryScene from './components/FactoryScene';
import DevicePanel from './components/DevicePanel';
import Header from './components/Header';

function App() {
  return (
    <div className="app">
      <Header />
      <FactoryScene />
      <DevicePanel />
    </div>
  );
}

export default App;
