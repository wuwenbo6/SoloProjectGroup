import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ProcessForm from './pages/ProcessForm';
import ProcessDetail from './pages/ProcessDetail';
import UserProfile from './pages/UserProfile';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">加载中...</div>;
  return user ? children : <Navigate to="/login" />;
};

function App() {
  const { loading } = useAuth();
  
  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="app">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/process/new" element={
            <PrivateRoute><ProcessForm /></PrivateRoute>
          } />
          <Route path="/process/edit/:id" element={
            <PrivateRoute><ProcessForm /></PrivateRoute>
          } />
          <Route path="/process/:id" element={<ProcessDetail />} />
          <Route path="/user/:id" element={<UserProfile />} />
          <Route path="/profile" element={
            <PrivateRoute><UserProfile /></PrivateRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

export default App;
