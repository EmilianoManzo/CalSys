import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

function StudentDashboard() {
  const { user, logout } = useAuth();
  const [activeParcial, setActiveParcial] = useState('1');
  const [materias, setMaterias] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.matricula) cargarCalificaciones();
  }, [user, activeParcial]);

  const cargarCalificaciones = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/grades/student/${user.matricula}/grades?parcialId=${activeParcial}`);
      setMaterias(res.data.materias);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const parciales = [
    { id: '1', nombre: '📘 Parcial 1' },
    { id: '2', nombre: '📗 Parcial 2' },
    { id: '3', nombre: '📙 Parcial 3' },
    { id: '0', nombre: '🎯 Calificación Final' }
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-lg p-4 flex justify-between">
        <h1 className="text-2xl font-bold text-blue-600">📊 Calsys - Alumno</h1>
        <div className="flex gap-4 items-center">
          <span>👨‍🎓 {user?.firstName} {user?.lastName}</span>
          <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded">Salir</button>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-6">📝 Mis Calificaciones</h2>
          <div className="mb-6 border-b border-gray-200">
            <ul className="flex flex-wrap -mb-px text-sm font-medium">
              {parciales.map(p => (
                <li className="mr-2" key={p.id}>
                  <button
                    onClick={() => setActiveParcial(p.id)}
                    className={`inline-block p-4 rounded-t-lg transition-colors ${
                      activeParcial === p.id
                        ? 'text-blue-600 border-b-2 border-blue-500'
                        : 'text-gray-500 hover:text-gray-600'
                    }`}
                  >
                    {p.nombre}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {loading ? (
            <div className="text-center py-12">Cargando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded shadow">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">Materia</th>
                    <th className="p-3 text-center">Calificación</th>
                    <th className="p-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {materias.length === 0 ? (
                    <tr><td colSpan="3" className="text-center py-8 text-gray-500">No hay calificaciones para este parcial</td></tr>
                  ) : (
                    materias.map(m => (
                      <tr key={m.subject_code} className="border-t">
                        <td className="p-3">{m.subject_name || m.subject_code}</td>
                        <td className="p-3 text-center font-bold">
                          {m.grade !== null ? m.grade : 'N/A'}
                        </td>
                        <td className="p-3 text-center">
                          {m.status === 'passed' ? '✅ Aprobado' : m.status === 'failed' ? '❌ Reprobado' : '⏳ Pendiente'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentDashboard;