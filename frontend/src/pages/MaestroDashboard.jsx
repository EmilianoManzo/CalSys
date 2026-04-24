import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import PartialManager from '../components/PartialManager';
import api from '../api/axios';

function MaestroDashboard() {
  const { user, logout } = useAuth();
  const [semester, setSemester] = useState('2025-1');
  const [subject, setSubject] = useState('');
  const [group, setGroup] = useState('');
  const [subjectsList, setSubjectsList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) loadTeacherSubjects();
  }, [user, semester]);

  const loadTeacherSubjects = async () => {
    setLoading(true);
    try {
      const response = await api.get('/grades/teacher/subjects', {
        params: { teacherId: user.id, semester }
      });
      if (response.data.subjects?.length) {
        setSubjectsList(response.data.subjects);
        const first = response.data.subjects[0];
        setSubject(first.subject_code);
        setGroup(first.group_code || '');
        if (first.subject_code) loadGroups(first.subject_code);
      } else {
        setSubjectsList([]);
        setSubject('');
        setGroup('');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async (subjectCode) => {
    try {
      const response = await api.get('/grades/subject/groups', {
        params: { teacherId: user.id, semester, subjectCode }
      });
      setGroupsList(response.data.groups || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSubjectChange = async (e) => {
    const newSubject = e.target.value;
    setSubject(newSubject);
    const subjectData = subjectsList.find(s => s.subject_code === newSubject);
    setGroup(subjectData?.group_code || '');
    await loadGroups(newSubject);
  };

  if (loading) return <div className="min-h-screen bg-gray-100 flex items-center justify-center">Cargando materias...</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-lg p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-600">Calsys - Maestro</h1>
        <div className="flex gap-4 items-center">
          <span>Hola, {user?.firstName} {user?.lastName}</span>
          <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded">Salir</button>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-6">Captura de Calificaciones</h2>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Semestre</label>
              <select value={semester} onChange={e => setSemester(e.target.value)} className="w-full border rounded p-2">
                <option value="2025-1">2025-1</option>
                <option value="2024-2">2024-2</option>
                <option value="2024-1">2024-1</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Materia</label>
              <select value={subject} onChange={handleSubjectChange} className="w-full border rounded p-2" disabled={!subjectsList.length}>
                {subjectsList.map(s => (
                  <option key={s.subject_code} value={s.subject_code}>
                    {s.subject_code} ({s.total_students} alumnos)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Grupo</label>
              <select value={group} onChange={e => setGroup(e.target.value)} className="w-full border rounded p-2" disabled={!groupsList.length}>
                {groupsList.map(g => (
                  <option key={g.group_code} value={g.group_code}>
                    Grupo {g.group_code} ({g.total_students} alumnos)
                  </option>
                ))}
              </select>
            </div>
          </div>
          {subject && <PartialManager semester={semester} subject={subject} group={group} teacherId={user?.id} />}
        </div>
      </div>
    </div>
  );
}

export default MaestroDashboard;