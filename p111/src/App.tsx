import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Alerts } from './pages/Alerts';
import { History } from './pages/History';
import { Intelligence } from './pages/Intelligence';
import { RootCauseAnalysisPage } from './pages/RootCauseAnalysis';
import { DeviceComparison } from './pages/DeviceComparison';

export default function App() {
  return (
    <Router>
      <Sidebar />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/intelligence" element={<Intelligence />} />
        <Route path="/root-cause" element={<RootCauseAnalysisPage />} />
        <Route path="/devices" element={<DeviceComparison />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </Router>
  );
}
