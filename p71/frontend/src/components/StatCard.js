import React from 'react';
import { Monitor, HardDrive, Activity, AlertTriangle } from 'lucide-react';

const iconMap = {
  devices: <Monitor size={24} color="white" />,
  connected: <HardDrive size={24} color="white" />,
  running: <Activity size={24} color="white" />,
  alerts: <AlertTriangle size={24} color="white" />,
};

const colorMap = {
  devices: 'blue',
  connected: 'green',
  running: 'orange',
  alerts: 'red',
};

const StatCard = ({ title, value, type }) => {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        <div className={`stat-card-icon ${colorMap[type]}`}>
          {iconMap[type]}
        </div>
      </div>
      <div className="stat-card-value">{value}</div>
    </div>
  );
};

export default StatCard;