import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('alumno');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const result = await login(username, password, role);
    setIsLoading(false);
    if (result.success) {
      if (result.role === 'alumno') navigate('/alumno');
      else if (result.role === 'maestro') navigate('/maestro');
      else if (result.role === 'admin') navigate('/admin');
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Iniciar Sesión</h2>
        {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Usuario / Matrícula</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Rol</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="alumno">Alumno</option>
              <option value="maestro">Maestro</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
            {isLoading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;