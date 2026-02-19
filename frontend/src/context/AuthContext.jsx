import { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/auth/me');
      console.log('Usuario recuperado:', response.data.user);
      setUser(response.data.user);
    } catch (error) {
      console.error('Error al verificar auth:', error);
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials, isStudent = false) => {
    const endpoint = isStudent ? '/auth/login-student' : '/auth/login';
    console.log('Llamando a:', endpoint);
    
    const response = await api.post(endpoint, credentials);
    console.log('Respuesta del servidor:', response.data);
    
    const { token, user } = response.data;
    
    localStorage.setItem('token', token);
    console.log('Token guardado:', token);
    
    setUser(user);
    console.log('Usuario guardado en estado:', user);
    
    return user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}