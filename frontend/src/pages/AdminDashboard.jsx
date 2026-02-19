import { useAuth } from '../context/AuthContext';

function AdminDashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">📊 Calsys - Admin</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">Hola, {user?.firstName}</span>
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
          <h2 className="text-2xl font-bold mb-4">Panel de Administrador</h2>
          <p className="text-gray-600">Bienvenido al sistema Calsys</p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="font-bold text-lg mb-2">Gestión de Alumnos</h3>
              <p className="text-sm text-gray-600">Crear, editar y gestionar alumnos</p>
            </div>
            <div className="bg-green-50 p-6 rounded-lg">
              <h3 className="font-bold text-lg mb-2">Gestión de Usuarios</h3>
              <p className="text-sm text-gray-600">Administrar maestros y directores</p>
            </div>
            <div className="bg-purple-50 p-6 rounded-lg">
              <h3 className="font-bold text-lg mb-2">Reportes</h3>
              <p className="text-sm text-gray-600">Ver estadísticas del sistema</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;