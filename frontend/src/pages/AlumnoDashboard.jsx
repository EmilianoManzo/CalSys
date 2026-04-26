import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

function AlumnoDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState(1);
  const [materias, setMaterias] = useState([]);
  const [selectedMateria, setSelectedMateria] = useState('');
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [promedio, setPromedio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMaterias, setLoadingMaterias] = useState(true);

  // Cargar materias del alumno
  useEffect(() => {
    const cargarMaterias = async () => {
      if (!user?.matricula) return;
      try {
        const response = await api.get('/grades/student-subjects', {
          params: { matricula: user.matricula }
        });
        setMaterias(response.data.subjects);
        if (response.data.subjects.length > 0) {
          setSelectedMateria(response.data.subjects[0].subject_code);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingMaterias(false);
      }
    };
    cargarMaterias();
  }, [user?.matricula]);

  // Cargar datos según la pestaña (parcial o final)
  const cargarParcial = useCallback(async (parcialId, subjectCode) => {
    setLoading(true);
    try {
      const response = await api.get('/grades/student-grades', {
        params: { matricula: user.matricula, parcialId, subjectCode }
      });
      // La respuesta trae columns y grades
      const cols = response.data.columns || [];
      const grades = response.data.grades || [];
      const prom = response.data.promedio;
      setColumns(cols);
      setPromedio(prom);
      // Transformar grades a un mapa accesible por nombre de columna
      const gradesMap = {};
      grades.forEach(g => { gradesMap[g.columnName] = g.value; });
      // Construir una sola fila para este alumno (el dashboard solo muestra un alumno)
      const row = [user.matricula, user.firstName + ' ' + user.lastName];
      cols.forEach(col => {
        const val = gradesMap[col.name];
        row.push(val !== undefined && val !== null ? parseFloat(val).toFixed(2) : '');
      });
      setData([row]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user?.matricula, user?.firstName, user?.lastName]);

  const cargarFinal = useCallback(async (subjectCode) => {
    setLoading(true);
    try {
      const response = await api.get('/grades/student-final', {
        params: { matricula: user.matricula, subjectCode }
      });
      const cols = response.data.columns || [];
      const grades = response.data.grades || [];
      const prom = response.data.promedio;
      setColumns(cols);
      setPromedio(prom);
      const gradesMap = {};
      grades.forEach(g => { gradesMap[g.columnName] = g.value; });
      const row = [user.matricula, user.firstName + ' ' + user.lastName];
      cols.forEach(col => {
        const val = gradesMap[col.name];
        row.push(val !== undefined && val !== null ? parseFloat(val).toFixed(2) : '');
      });
      setData([row]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user?.matricula, user?.firstName, user?.lastName]);

  // Cuando cambia la materia o la pestaña, cargar los datos
  useEffect(() => {
    if (selectedMateria && user?.matricula) {
      if (activeTab === 4) {
        cargarFinal(selectedMateria);
      } else {
        cargarParcial(activeTab, selectedMateria);
      }
    }
  }, [activeTab, selectedMateria, user?.matricula, cargarParcial, cargarFinal]);

  const tabs = [
    { id: 1, label: '📘 Parcial 1' },
    { id: 2, label: '📗 Parcial 2' },
    { id: 3, label: '📙 Parcial 3' },
    { id: 4, label: '🎓 Calificación Final' }
  ];

  const renderTabContent = () => {
    if (loading) return <div className="text-center py-8">Cargando...</div>;
    if (columns.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No hay actividades configuradas para esta evaluación.
          <p className="text-sm mt-2">Materia: {selectedMateria}</p>
        </div>
      );
    }
    return (
      <div>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded-lg overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-4 py-2 text-left">Matrícula</th>
                <th className="border px-4 py-2 text-left">Alumno</th>
                {columns.map(col => (
                  <th key={col.name} className="border px-4 py-2 text-center">
                    {col.name}{col.isSpecial ? ' ⭐' : ''}
                    <span className="text-xs block font-normal">
                      ({col.weight}% / {col.maxValue})
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-gray-50">
                  {row.map((cell, cellIdx) => {
                    let bgColor = '', textColor = '';
                    if (cellIdx >= 2 && !isNaN(parseFloat(cell))) {
                      const val = parseFloat(cell);
                      if (val >= 9) { bgColor = 'bg-green-100'; textColor = 'text-green-800'; }
                      else if (val >= 6) { bgColor = 'bg-yellow-100'; textColor = 'text-yellow-800'; }
                      else if (val !== '') { bgColor = 'bg-red-100'; textColor = 'text-red-800'; }
                    }
                    return (
                      <td key={cellIdx} className={`border px-4 py-2 ${cellIdx === 0 || cellIdx === 1 ? 'font-medium' : 'text-center'} ${bgColor} ${textColor}`}>
                        {cell !== '' ? cell : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 p-4 bg-blue-50 rounded-lg flex justify-between items-center">
          <p className="text-lg font-semibold">
            {activeTab === 4 ? '🎯 Calificación Final Global:' : '📊 Calificación Final del Parcial:'}
          </p>
          <p className="text-3xl font-bold text-blue-700">
            {promedio !== null ? promedio.toFixed(2) : 'N/A'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-lg p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-green-600">Calsys - Alumno</h1>
        <div className="flex gap-4 items-center">
          <span>Hola, {user?.firstName} {user?.lastName}</span>
          <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded">Salir</button>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-6">Mis Calificaciones</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Materia</label>
            {loadingMaterias ? (
              <p>Cargando materias...</p>
            ) : (
              <select
                value={selectedMateria}
                onChange={(e) => setSelectedMateria(e.target.value)}
                className="border rounded px-3 py-2 w-64"
              >
                {materias.map(m => (
                  <option key={m.subject_code} value={m.subject_code}>
                    {m.subject_code} - {m.semester_code}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="border-b border-gray-200 mb-4">
            <nav className="flex gap-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                    activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}

export default AlumnoDashboard;