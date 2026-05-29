import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import GradesViewer from '../components/admin/GradesViewer';
import StudentsManager from '../components/admin/StudentsManager';
import UsersManager from '../components/admin/UsersManager';
import MateriasManager from '../components/admin/MateriasManager';
import GroupsManager from '../components/admin/GroupsManager';
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
    { id: 'stats', label: 'Estadísticas', icon: '📊' },
    { id: 'materias', label: 'Materias', icon: '📚' },
    { id: 'grades', label: 'Calificaciones', icon: '📝' },
    { id: 'students', label: 'Alumnos', icon: '👨‍🎓' },
    { id: 'groups', label: 'Grupos', icon: '🏫' },
    { id: 'users', label: 'Usuarios', icon: '👥' }
  ];

  const distributionData = {
    labels: ['Aprobados', 'Reprobados', 'En Progreso'],
    datasets: [{
      data: [stats.passed, stats.failed, stats.inProgress],
      backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
      borderWidth: 0
    }]
  };

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
      backgroundColor: '#880000',
      borderRadius: 8
    }]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true, max: 10, title: { display: true, text: 'Calificación' } }
    },
    plugins: {
      legend: { position: 'top' },
      tooltip: { callbacks: { label: (ctx) => `${ctx.raw.toFixed(2)}` } }
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: 'DM Sans, sans-serif' }}>
        {/* Navbar */}
        <nav style={{ background: '#880000', padding: '0 2rem', height: '56px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '10px', height: '10px', background: '#ffffff', borderRadius: '50%' }} />
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>Calsys · Administrador</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '13px', color: '#ffffff' }}>👑 {user?.firstName} {user?.lastName}</span>
            <button 
              onClick={logout} 
              style={{ background: '#ffffff', color: '#000000', border: 'none', borderRadius: '7px', padding: '7px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={e => e.target.style.background = '#929292'}
              onMouseLeave={e => e.target.style.background = '#ffffff'}
            >
              Salir
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '0.5px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 4px 32px rgba(0, 0, 0, 0.04)' }}>
            {/* Tabs */}
            <div style={{ borderBottom: '0.5px solid #e5e7eb', padding: '0 1.5rem' }}>
              <nav style={{ display: 'flex', gap: '4px', overflowX: 'auto' }}>
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '12px 20px',
                      fontSize: '13px',
                      fontWeight: 500,
                      fontFamily: 'DM Sans, sans-serif',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      color: activeTab === tab.id ? '#880000' : '#6b7280',
                      borderBottom: activeTab === tab.id ? '2px solid #880000' : '2px solid transparent'
                    }}
                    onMouseEnter={e => { if (activeTab !== tab.id) e.target.style.color = '#374151'; }}
                    onMouseLeave={e => { if (activeTab !== tab.id) e.target.style.color = '#6b7280'; }}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem' }}>
              {activeTab === 'stats' && (
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#111111', marginBottom: '1.5rem' }}>📈 Panel de Análisis</h2>
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Cargando estadísticas...</div>
                  ) : (
                    <>
                      {/* Tarjetas de resumen */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        {[
                          { icon: '👨‍🎓', label: 'Estudiantes Activos', value: stats.students, color: '#3b82f6' },
                          { icon: '👨‍🏫', label: 'Maestros', value: stats.teachers, color: '#10b981' },
                          { icon: '📚', label: 'Materias', value: stats.subjects, color: '#8b5cf6' },
                          { icon: '📊', label: 'Calificaciones', value: stats.grades, color: '#f59e0b' }
                        ].map((card, idx) => (
                          <div key={idx} style={{ background: `linear-gradient(135deg, ${card.color} 0%, ${card.color}cc 100%)`, borderRadius: '12px', padding: '1rem', color: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                            <div style={{ fontSize: '28px', marginBottom: '8px' }}>{card.icon}</div>
                            <div style={{ fontSize: '28px', fontWeight: 700 }}>{card.value}</div>
                            <div style={{ fontSize: '12px', opacity: 0.9 }}>{card.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Métricas clave */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem', textAlign: 'center' }}>
                          <p style={{ fontSize: '12px', color: '#6b7280' }}>Promedio General</p>
                          <p style={{ fontSize: '36px', fontWeight: 700, color: '#880000' }}>{stats.average.toFixed(1)}</p>
                          <p style={{ fontSize: '10px', color: '#9ca3af' }}>Sobre 10</p>
                        </div>
                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem', textAlign: 'center' }}>
                          <p style={{ fontSize: '12px', color: '#6b7280' }}>Tasa de Aprobación</p>
                          <p style={{ fontSize: '36px', fontWeight: 700, color: '#10b981' }}>
                            {stats.passed + stats.failed > 0 ? Math.round((stats.passed / (stats.passed + stats.failed)) * 100) : 0}%
                          </p>
                          <p style={{ fontSize: '10px', color: '#9ca3af' }}>{stats.passed} aprobados / {stats.failed} reprobados</p>
                        </div>
                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem', textAlign: 'center' }}>
                          <p style={{ fontSize: '12px', color: '#6b7280' }}>En Progreso</p>
                          <p style={{ fontSize: '36px', fontWeight: 700, color: '#f59e0b' }}>{stats.inProgress}</p>
                          <p style={{ fontSize: '10px', color: '#9ca3af' }}>Sin calificación completa</p>
                        </div>
                      </div>

                      {/* Gráficos */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem' }}>
                          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '1rem' }}>Distribución de Rendimiento</h3>
                          <div style={{ height: '250px' }}>
                            <Pie data={distributionData} options={{ maintainAspectRatio: false }} />
                          </div>
                        </div>
                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem' }}>
                          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '1rem' }}>Promedio por Materia</h3>
                          <div style={{ height: '250px' }}>
                            {stats.subjectStats.length === 0 ? (
                              <div style={{ textAlign: 'center', paddingTop: '80px', color: '#9ca3af' }}>Sin datos suficientes</div>
                            ) : (
                              <Bar data={barData} options={barOptions} />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tabla de materias */}
                      {stats.subjectStats.length > 0 && (
                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
                          <h3 style={{ fontSize: '14px', fontWeight: 600, padding: '1rem', borderBottom: '0.5px solid #e5e7eb' }}>Desglose por Materia</h3>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', fontSize: '13px' }}>
                              <thead style={{ background: '#f9fafb' }}>
                                <tr>
                                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Materia</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Estudiantes</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Promedio</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Rendimiento</th>
                                </tr>
                              </thead>
                              <tbody>
                                {stats.subjectStats.map((subj, idx) => {
                                  const promedio = Number(subj.promedio);
                                  const isInvalid = isNaN(promedio);
                                  const barColor = isInvalid ? '#9ca3af' : (promedio < 6 ? '#ef4444' : (promedio < 7 ? '#f59e0b' : '#10b981'));
                                  const percent = isInvalid ? 0 : (promedio / 10) * 100;
                                  return (
                                    <tr key={idx} style={{ borderBottom: '0.5px solid #f0f0f0' }}>
                                      <td style={{ padding: '10px 16px' }}>{subj.subject_code}</td>
                                      <td style={{ padding: '10px 16px' }}>{subj.estudiantes || 0}</td>
                                      <td style={{ padding: '10px 16px' }}>{isInvalid ? 'N/A' : promedio.toFixed(2)}</td>
                                      <td style={{ padding: '10px 16px', width: '200px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <div style={{ flex: 1, background: '#e5e7eb', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                                            <div style={{ width: `${percent}%`, height: '100%', background: barColor, borderRadius: '9999px' }} />
                                          </div>
                                          <span style={{ fontSize: '11px', color: '#6b7280' }}>{Math.round(percent)}%</span>
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
              {activeTab === 'groups' && <GroupsManager />}
              {activeTab === 'users' && <UsersManager />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default AdminDashboard;