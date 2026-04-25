import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AlumnoDashboard from './pages/AlumnoDashboard';
import MaestroDashboard from './pages/MaestroDashboard';
import AdminDashboard from './pages/AdminDashboard';

function LoadingSpinner() {
  return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/alumno" element={user?.role === 'alumno' ? <AlumnoDashboard /> : <Navigate to="/login" replace />} />
      <Route path="/maestro" element={user?.role === 'maestro' || user?.role === 'admin' ? <MaestroDashboard /> : <Navigate to="/login" replace />} />
      <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/login" replace />} />
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