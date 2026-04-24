import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import GradesViewer from '../components/admin/GradesViewer';
import StudentsManager from '../components/admin/StudentsManager';
import UsersManager from '../components/admin/UsersManager';
import MateriasManager from '../components/admin/MateriasManager';
import api from '../api/axios';

function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('stats');
  const [stats, setStats] = useState({
    students: 0, teachers: 0, subjects: 0, grades: 0,
    average: 0, passed: 0, failed: 0, inProgress: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cargarEstadisticas = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'stats', label: '📊 Estadísticas' },
    { id: 'materias', label: '📚 Materias' },
    { id: 'grades', label: '📝 Calificaciones' },
    { id: 'students', label: '👨‍🎓 Alumnos' },
    { id: 'users', label: '👥 Usuarios' }
  ];

  const renderContent = () => {
    if (activeTab === 'stats') {
      return (
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Estadísticas del Sistema</h2>
          {loading ? (
            <div className="text-center py-12">Cargando...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="text-4xl mb-2">👨‍🎓</div>
                  <div className="text-3xl font-bold">{stats.students}</div>
                  <div className="text-sm opacity-90">Estudiantes Activos</div>
                </div>
                <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="text-4xl mb-2">👨‍🏫</div>
                  <div className="text-3xl font-bold">{stats.teachers}</div>
                  <div className="text-sm opacity-90">Maestros</div>
                </div>
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="text-4xl mb-2">📚</div>
                  <div className="text-3xl font-bold">{stats.subjects}</div>
                  <div className="text-sm opacity-90">Materias</div>
                </div>
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="text-4xl mb-2">📊</div>
                  <div className="text-3xl font-bold">{stats.grades}</div>
                  <div className="text-sm opacity-90">Calificaciones</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow border p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Rendimiento Académico</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">Promedio General</span>
                        <span className="text-sm font-bold text-purple-600">{stats.average || 0}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${(stats.average / 10) * 100}%` }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 pt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{stats.passed}</div>
                        <div className="text-xs text-gray-500">Aprobados</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                        <div className="text-xs text-gray-500">Reprobados</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
                        <div className="text-xs text-gray-500">En Progreso</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow border p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribución</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">Aprobados</span>
                        <span className="text-sm font-bold text-green-600">
                          {stats.grades > 0 ? Math.round((stats.passed / stats.grades) * 100) : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${stats.grades > 0 ? (stats.passed / stats.grades) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">Reprobados</span>
                        <span className="text-sm font-bold text-red-600">
                          {stats.grades > 0 ? Math.round((stats.failed / stats.grades) * 100) : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-red-500 h-2 rounded-full" style={{ width: `${stats.grades > 0 ? (stats.failed / stats.grades) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">En Progreso</span>
                        <span className="text-sm font-bold text-yellow-600">
                          {stats.grades > 0 ? Math.round((stats.inProgress / stats.grades) * 100) : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${stats.grades > 0 ? (stats.inProgress / stats.grades) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      );
    }
    if (activeTab === 'materias') return <MateriasManager />;
    if (activeTab === 'grades') return <GradesViewer />;
    if (activeTab === 'students') return <StudentsManager />;
    if (activeTab === 'users') return <UsersManager />;
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-purple-600">Admin Sistema</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">👑 {user?.firstName} {user?.lastName}</span>
            <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Cerrar Sesión</button>
          </div>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-b-2 border-purple-500 text-purple-600'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="p-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;