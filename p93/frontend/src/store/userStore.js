import { useState, useEffect, createContext, useContext } from 'react';
import { userAPI } from '../services/api';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('ceramic_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username) => {
    const data = await userAPI.create({ username });
    setUser(data);
    localStorage.setItem('ceramic_user', JSON.stringify(data));
    return data;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ceramic_user');
  };

  const updateProfile = async (data) => {
    const updated = await userAPI.update(user.id, data);
    setUser(updated);
    localStorage.setItem('ceramic_user', JSON.stringify(updated));
    return updated;
  };

  return (
    <UserContext.Provider value={{ user, loading, login, logout, updateProfile }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
