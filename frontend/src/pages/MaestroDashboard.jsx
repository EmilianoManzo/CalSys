import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import GradesTable from '../components/GradesTable';

function MaestroDashboard() {
  const { user, logout } = useAuth();
  const [semester, setSemester] = useState('2025-1');
  const [subject, setSubject] = useState('CALC-101');
  const [group, setGroup] = useState('1A');

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">Calsys - Maestro</h1>
          <div className="flex items-center gap-4">
            <span>Hola, {user?.firstName}</span>
            <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded">
              Salir
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-6">Captura de Calificaciones</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Semestre</label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="2025-1">2025-1</option>
                <option value="2024-2">2024-2</option>
                <option value="2024-1">2024-1</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Materia</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="CALC-101">Calculo I</option>
                <option value="FIS-101">Fisica I</option>
                <option value="PROG-101">Programacion I</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Grupo</label>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="1A">1A</option>
                <option value="1B">1B</option>
                <option value="2A">2A</option>
              </select>
            </div>
          </div>

          <GradesTable
            semester={semester}
            subject={subject}
            group={group}
            teacherId={user?.id}
            teacherName={`${user?.firstName} ${user?.lastName}`}
          />
        </div>
      </div>
    </div>
  );
}

export default MaestroDashboard;