import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import GradesViewer from '../components/admin/GradesViewer';
import StudentsManager from '../components/admin/StudentsManager';
import UsersManager from '../components/admin/UsersManager';
import MateriasManager from '../components/admin/MateriasManager';
import api from '../api/axios';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('stats');
  const [stats, setStats] = useState({
    students: 0, teachers: 0, subjects: 0, grades: 0,
    average: 0, passed: 0, failed: 0, inProgress: 0,
    subjectStats: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cargarEstadisticas = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/stats');
      // Asegurar valores numéricos
      const data = response.data;
      setStats({
        students: Number(data.students) || 0,
        teachers: Number(data.teachers) || 0,
        subjects: Number(data.subjects) || 0,
        grades: Number(data.grades) || 0,
        average: Number(data.average) || 0,
        passed: Number(data.passed) || 0,
        failed: Number(data.failed) || 0,
        inProgress: Number(data.inProgress) || 0,
        subjectStats: Array.isArray(data.subjectStats) ? data.subjectStats : []
      });
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

  // Datos para gráfico de distribución
  const distributionData = {
    labels: ['Aprobados', 'Reprobados', 'En Progreso'],
    datasets: [{
      data: [stats.passed, stats.failed, stats.inProgress],
      backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
      borderWidth: 0
    }]
  };

  // Datos para gráfico de promedios por materia (evitar NaN)
  const subjectNames = stats.subjectStats.map(s => s.subject_code);
  const subjectAverages = stats.subjectStats.map(s => {
    const prom = Number(s.promedio);
    return isNaN(prom) ? 0 : prom;
  });
  const barData = {
    labels: subjectNames,
    datasets: [{
      label: 'Promedio',
      data: subjectAverages,
      backgroundColor: '#3b82f6',
      borderRadius: 8
    }]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 10,
        title: { display: true, text: 'Calificación' }
      }
    },
    plugins: {
      legend: { position: 'top' },
      tooltip: { callbacks: { label: (ctx) => `${ctx.raw.toFixed(2)}` } }
    }
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
            {activeTab === 'stats' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">📈 Panel de Análisis</h2>
                {loading ? (
                  <div className="text-center py-12">Cargando estadísticas...</div>
                ) : (
                  <>
                    {/* Tarjetas de resumen */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow p-6 text-white">
                        <div className="text-4xl mb-2">👨‍🎓</div>
                        <div className="text-3xl font-bold">{stats.students}</div>
                        <div className="text-sm opacity-90">Estudiantes Activos</div>
                      </div>
                      <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow p-6 text-white">
                        <div className="text-4xl mb-2">👨‍🏫</div>
                        <div className="text-3xl font-bold">{stats.teachers}</div>
                        <div className="text-sm opacity-90">Maestros</div>
                      </div>
                      <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow p-6 text-white">
                        <div className="text-4xl mb-2">📚</div>
                        <div className="text-3xl font-bold">{stats.subjects}</div>
                        <div className="text-sm opacity-90">Materias</div>
                      </div>
                      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow p-6 text-white">
                        <div className="text-4xl mb-2">📊</div>
                        <div className="text-3xl font-bold">{stats.grades}</div>
                        <div className="text-sm opacity-90">Calificaciones</div>
                      </div>
                    </div>

                    {/* Fila de métricas clave */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <div className="bg-white rounded-xl shadow border p-6 text-center">
                        <p className="text-gray-500 text-sm">Promedio General</p>
                        <p className="text-5xl font-bold text-purple-600">
                          {typeof stats.average === 'number' ? stats.average.toFixed(1) : '0.0'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Sobre 10</p>
                      </div>
                      <div className="bg-white rounded-xl shadow border p-6 text-center">
                        <p className="text-gray-500 text-sm">Tasa de Aprobación</p>
                        <p className="text-5xl font-bold text-green-600">
                          {stats.passed + stats.failed > 0 ? Math.round((stats.passed / (stats.passed + stats.failed)) * 100) : 0}%
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{stats.passed} aprobados / {stats.failed} reprobados</p>
                      </div>
                      <div className="bg-white rounded-xl shadow border p-6 text-center">
                        <p className="text-gray-500 text-sm">Estudiantes en Progreso</p>
                        <p className="text-5xl font-bold text-yellow-600">{stats.inProgress}</p>
                        <p className="text-xs text-gray-400 mt-1">Aún sin calificación completa</p>
                      </div>
                    </div>

                    {/* Gráficos */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                      <div className="bg-white rounded-xl shadow border p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribución de Rendimiento</h3>
                        <div className="h-64 flex justify-center">
                          <Pie data={distributionData} options={{ maintainAspectRatio: false }} />
                        </div>
                        <div className="mt-4 grid grid-cols-3 text-center text-sm">
                          <div><span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-1"></span> Aprobados: {stats.passed}</div>
                          <div><span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-1"></span> Reprobados: {stats.failed}</div>
                          <div><span className="inline-block w-3 h-3 bg-yellow-500 rounded-full mr-1"></span> En Progreso: {stats.inProgress}</div>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl shadow border p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Promedio por Materia</h3>
                        {stats.subjectStats.length === 0 ? (
                          <div className="text-center text-gray-500 py-12">Sin datos suficientes</div>
                        ) : (
                          <div className="h-64">
                            <Bar data={barData} options={barOptions} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tabla de materias (detalle) */}
                    {stats.subjectStats.length > 0 && (
                      <div className="bg-white rounded-xl shadow border overflow-hidden">
                        <h3 className="text-lg font-semibold text-gray-800 p-4 border-b">Desglose por Materia</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Materia</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estudiantes</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Promedio</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rendimiento</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {stats.subjectStats.map((subj, idx) => {
                                const promedio = Number(subj.promedio);
                                const isInvalid = isNaN(promedio);
                                const barColor = isInvalid ? 'bg-gray-400' : (promedio < 6 ? 'bg-red-500' : (promedio < 7 ? 'bg-yellow-500' : 'bg-green-500'));
                                const percent = isInvalid ? 0 : (promedio / 10) * 100;
                                const displayPromedio = isInvalid ? 'N/A' : promedio.toFixed(2);
                                return (
                                  <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap font-medium">{subj.subject_code}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{subj.estudiantes || 0}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{displayPromedio}</td>
                                    <td className="px-6 py-4 w-48">
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                                          <div className={`${barColor} h-2 rounded-full`} style={{ width: `${percent}%` }} />
                                        </div>
                                        <span className="text-xs text-gray-600">{Math.round(percent)}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'materias' && <MateriasManager />}
            {activeTab === 'grades' && <GradesViewer />}
            {activeTab === 'students' && <StudentsManager />}
            {activeTab === 'users' && <UsersManager />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;