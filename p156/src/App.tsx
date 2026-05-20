import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { DataImport } from './pages/DataImport';
import { Reduction } from './pages/Reduction';
import { Reports } from './pages/Reports';
import { History } from './pages/History';
import Targets from './pages/Targets';
import Benchmark from './pages/Benchmark';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="data-import" element={<DataImport />} />
          <Route path="targets" element={<Targets />} />
          <Route path="benchmark" element={<Benchmark />} />
          <Route path="reduction" element={<Reduction />} />
          <Route path="reports" element={<Reports />} />
          <Route path="history" element={<History />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
