import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        try {
          const response = await api.get('/auth/me');
          setUser(response.data.user);
        } catch (error) {
          console.error('Error al verificar token:', error);
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (username, password, role) => {
    try {
      const response = await api.post('/auth/login', { username, password, role });
      const { token, user: userData } = response.data;
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
      return { success: true, role: userData.role };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.response?.data?.error || 'Error al iniciar sesión' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};