import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = sessionStorage.getItem('token');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        try {
          const response = await api.get('/auth/me');
          setUser(response.data.user);
        } catch (error) {
          console.error('Error al verificar token:', error);
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('csrfToken');
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
      const { token, csrfToken, user: userData } = response.data;
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('csrfToken', csrfToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
      return { success: true, role: userData.role, mustChangePassword: userData.mustChangePassword };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.response?.data?.error || 'Error al iniciar sesión' };
    }
  };

  const changePassword = async (currentPassword, newPassword, confirmPassword) => {
    try {
      const response = await api.post('/auth/change-password', { currentPassword, newPassword, confirmPassword });
      const { token, csrfToken, user: userData } = response.data;
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('csrfToken', csrfToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
      return { success: true, role: userData.role };
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, error: error.response?.data?.error || 'Error al cambiar contrasena' };
    }
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('csrfToken');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
