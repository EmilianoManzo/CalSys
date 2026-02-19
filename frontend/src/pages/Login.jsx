import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [isStudent, setIsStudent] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loginData = isStudent 
        ? { matricula: credentials.username, password: credentials.password }
        : { username: credentials.username, password: credentials.password };

      console.log('Intentando login con:', loginData);

      const user = await login(loginData, isStudent);
      
      console.log('Usuario logueado:', user);
      console.log('Rol del usuario:', user.role);
      
      // Redirigir según el rol
      if (user.role === 'admin') {
        console.log('Redirigiendo a /admin');
        navigate('/admin', { replace: true });
      } else if (user.role === 'director') {
        console.log('Redirigiendo a /director');
        navigate('/director', { replace: true });
      } else if (user.role === 'maestro') {
        console.log('Redirigiendo a /maestro');
        navigate('/maestro', { replace: true });
      } else if (user.role === 'student') {
        console.log('Redirigiendo a /alumno');
        navigate('/alumno', { replace: true });
      } else {
        console.log('Rol desconocido:', user.role);
        setError('Rol de usuario no reconocido');
      }
      
    } catch (err) {
      console.error('Error completo:', err);
      setError(err.response?.data?.error || 'Error al iniciar sesion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">Calsys</h1>
          <p className="text-gray-600">Sistema de Calificaciones</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button 
            onClick={() => setIsStudent(false)} 
            className={`flex-1 py-2 px-4 rounded-lg font-semibold ${!isStudent ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Staff
          </button>
          <button 
            onClick={() => setIsStudent(true)} 
            className={`flex-1 py-2 px-4 rounded-lg font-semibold ${isStudent ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Alumno
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isStudent ? 'Matricula' : 'Usuario'}
            </label>
            <input 
              type="text" 
              value={credentials.username} 
              onChange={(e) => setCredentials({ ...credentials, username: e.target.value })} 
              className="w-full px-4 py-2 border rounded-lg" 
              placeholder={isStudent ? '2025001' : 'admin'}
              required 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contrasena
            </label>
            <input 
              type="password" 
              value={credentials.password} 
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} 
              className="w-full px-4 py-2 border rounded-lg" 
              placeholder="********"
              required 
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Cargando...' : 'Iniciar Sesion'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs">
          <p className="font-semibold mb-2">Usuarios de prueba:</p>
          <p>Staff: admin / password123</p>
          <p>Alumno: 2025001 / password123</p>
        </div>
      </div>
    </div>
  );
}

export default Login;