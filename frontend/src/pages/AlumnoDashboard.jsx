import { useAuth } from '../context/AuthContext';

function AlumnoDashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">📊 Calsys - Alumno</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">
              Hola, {user?.firstName} ({user?.matricula})
            </span>
            <button
              onClick={logout}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">Mis Calificaciones</h2>
          <p className="text-gray-600">Aquí verás tus calificaciones</p>
        </div>
      </div>
    </div>
  );
}

export default AlumnoDashboard;