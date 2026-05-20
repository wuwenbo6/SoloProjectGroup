import React, { useState, createContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import BookList from './pages/BookList';
import BookDetail from './pages/BookDetail';
import AnnotationPage from './pages/AnnotationPage';
import Navbar from './components/Navbar';

export const AuthContext = createContext();

function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);

  const login = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', userToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      <BrowserRouter>
        <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
          <Navbar />
          <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/books" element={user ? <BookList /> : <Navigate to="/login" />} />
              <Route path="/books/:id" element={user ? <BookDetail /> : <Navigate to="/login" />} />
              <Route path="/annotate/:pageId" element={user ? <AnnotationPage /> : <Navigate to="/login" />} />
              <Route path="/" element={<Navigate to="/books" />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;
