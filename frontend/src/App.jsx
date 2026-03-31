import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import DirectorDashboard from './pages/DirectorDashboard';
import MaestroDashboard from './pages/MaestroDashboard';
import AlumnoDashboard from './pages/AlumnoDashboard';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl font-semibold text-gray-600">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Ruta de Login */}
      <Route 
        path="/login" 
        element={
          user ? (
            <Navigate 
              to={user.role === 'student' ? '/alumno' : `/${user.role}`} 
              replace 
            />
          ) : (
            <Login />
          )
        } 
      />

      {/* Dashboard de Administrador */}
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />

      {/* Dashboard de Director */}
      <Route 
        path="/director" 
        element={
          <ProtectedRoute allowedRoles={['director']}>
            <DirectorDashboard />
          </ProtectedRoute>
        } 
      />

      {/* Dashboard de Maestro */}
      <Route 
        path="/maestro" 
        element={
          <ProtectedRoute allowedRoles={['maestro']}>
            <MaestroDashboard />
          </ProtectedRoute>
        } 
      />

      {/* Dashboard de Alumno */}
      <Route 
        path="/alumno" 
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <AlumnoDashboard />
          </ProtectedRoute>
        } 
      />

      {/* Ruta raíz - redirige a login */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Ruta 404 - cualquier otra ruta redirige a login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;