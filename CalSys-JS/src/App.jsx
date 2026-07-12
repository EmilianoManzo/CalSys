import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import AlumnoDashboard from './pages/AlumnoDashboard';
import MaestroDashboard from './pages/MaestroDashboard';
import AdminDashboard from './pages/AdminDashboard';

function LoadingSpinner() {
  return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
}

function homeForRole(role) {
  if (role === 'alumno') return '/alumno';
  if (role === 'maestro') return '/maestro';
  if (role === 'director') return '/admin';
  return '/login';
}

function ProtectedRoute({ allowed, children }) {
  const { user } = useAuth();
  if (!user || !allowed.includes(user.role)) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  return (
    <Routes>
      <Route path="/login" element={user && !user.mustChangePassword ? <Navigate to={homeForRole(user.role)} replace /> : <Login />} />
      <Route path="/change-password" element={user ? <ChangePassword /> : <Navigate to="/login" replace />} />
      <Route path="/alumno" element={<ProtectedRoute allowed={['alumno']}><AlumnoDashboard /></ProtectedRoute>} />
      <Route path="/maestro" element={<ProtectedRoute allowed={['maestro', 'director']}><MaestroDashboard /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute allowed={['director']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
