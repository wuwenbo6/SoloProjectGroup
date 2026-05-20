import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { AlertNotification } from './components/AlertNotification';
import { Dashboard } from './pages/Dashboard';
import { Analytics } from './pages/Analytics';
import { Anomaly } from './pages/Anomaly';
import { BatchComparison } from './pages/BatchComparison';
import { Alerts } from './pages/Alerts';
import { History } from './pages/History';

export default function App() {
    return (
        <Router>
            <div className="flex min-h-screen bg-gray-100">
                <Sidebar />
                <main className="flex-1 overflow-auto">
                    <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/anomaly" element={<Anomaly />} />
                        <Route path="/batches" element={<BatchComparison />} />
                        <Route path="/alerts" element={<Alerts />} />
                        <Route path="/history" element={<History />} />
                    </Routes>
                </main>
                <AlertNotification />
            </div>
        </Router>
    );
}
