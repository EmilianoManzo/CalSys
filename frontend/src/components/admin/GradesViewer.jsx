import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../../api/axios';

registerAllModules();

function GradesViewer() {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subjectsList, setSubjectsList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [teachersList, setTeachersList] = useState([]);
  const [semestersList, setSemestersList] = useState([]);
  const [filters, setFilters] = useState({ semester: '', subject: '', group: '', teacherId: '' });
  const hotRef = useRef(null);

  useEffect(() => {
    cargarMaterias(); cargarMaestros(); cargarSemestres();
  }, []);
  useEffect(() => { if (filters.subject) cargarCalificaciones(); }, [filters]);

  const cargarMaterias = async () => {
    const res = await api.get('/admin/subjects');
    setSubjectsList(res.data.subjects || []);
  };
  const cargarMaestros = async () => {
    const res = await api.get('/admin/teachers');
    setTeachersList(res.data.teachers || []);
  };
  const cargarSemestres = async () => {
    const res = await api.get('/admin/semesters');
    setSemestersList(res.data.semesters || []);
    if (res.data.semesters?.length) setFilters(prev => ({ ...prev, semester: res.data.semesters[0] }));
  };
  const cargarGrupos = async (subjectCode) => {
    if (!subjectCode) { setGroupsList([]); return; }
    const res = await api.get('/admin/subject-groups', { params: { subjectCode, semester: filters.semester, teacherId: filters.teacherId } });
    setGroupsList(res.data.groups || []);
  };
  const cargarCalificaciones = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.semester) params.semester = filters.semester;
      if (filters.subject) params.subject = filters.subject;
      if (filters.group) params.group = filters.group;
      if (filters.teacherId) params.teacherId = filters.teacherId;
      const res = await api.get('/admin/all-grades-with-columns', { params });
      const columns = res.data.columns || [];
      const data = res.data.grades.map(g => {
        const row = [
          g.matricula, g.alumno, g.semester_code, g.subject_code, g.group_code || 'N/A', g.maestro,
          g.parcial_1 ?? '', g.parcial_2 ?? '', g.parcial_3 ?? '', g.promedio_parciales ?? '', g.ordinario ?? ''
        ];
        columns.forEach(col => {
          if (!col.is_special) {
            const val = g[`col_${col.id}`];
            row.push(val !== null ? parseFloat(val).toFixed(2) : '');
          }
        });
        row.push(g.final_grade !== null ? parseFloat(g.final_grade).toFixed(2) : 'N/A');
        row.push(g.status === 'passed' ? 'Aprobado' : g.status === 'failed' ? 'Reprobado' : 'En Progreso');
        return row;
      });
      setGrades(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };
  const handleSubjectChange = async (e) => {
    const code = e.target.value;
    setFilters(prev => ({ ...prev, subject: code, group: '' }));
    await cargarGrupos(code);
  };
  const resetFilters = () => {
    setFilters({ semester: semestersList[0] || '', subject: '', group: '', teacherId: '' });
    setGroupsList([]);
  };
  const buildColumns = () => {
    const base = [
      { data: 0, title: 'Matrícula', width: 100 }, { data: 1, title: 'Alumno', width: 200 },
      { data: 2, title: 'Semestre', width: 90 }, { data: 3, title: 'Materia', width: 100 },
      { data: 4, title: 'Grupo', width: 70 }, { data: 5, title: 'Maestro', width: 180 },
      { data: 6, title: 'Parcial 1', type: 'numeric', width: 90 }, { data: 7, title: 'Parcial 2', type: 'numeric', width: 90 },
      { data: 8, title: 'Parcial 3', type: 'numeric', width: 90 }, { data: 9, title: 'Promedio', type: 'numeric', width: 100 },
      { data: 10, title: 'Evaluación Final', type: 'numeric', width: 110 }
    ];
    // Aquí se podrían agregar las columnas personalizadas si se desea, pero para admin es opcional.
    base.push(
      { data: 11, title: '⭐ Final', type: 'numeric', width: 90 },
      { data: 12, title: 'Estado', width: 100 }
    );
    return base;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">📝 Todas las Calificaciones</h2>
      <div className="bg-white p-4 rounded shadow">
        <div className="grid grid-cols-4 gap-4">
          <select value={filters.semester} onChange={e => setFilters({...filters, semester: e.target.value, subject: '', group: ''})} className="border p-2">
            <option value="">Semestre</option>
            {semestersList.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filters.subject} onChange={handleSubjectChange} className="border p-2">
            <option value="">Materia</option>
            {subjectsList.map(s => <option key={s.subject_code} value={s.subject_code}>{s.subject_code}</option>)}
          </select>
          <select value={filters.group} onChange={e => setFilters({...filters, group: e.target.value})} className="border p-2" disabled={!filters.subject}>
            <option value="">Grupo</option>
            {groupsList.map(g => <option key={g.group_code} value={g.group_code}>Grupo {g.group_code}</option>)}
          </select>
          <select value={filters.teacherId} onChange={e => setFilters({...filters, teacherId: e.target.value})} className="border p-2">
            <option value="">Maestro</option>
            {teachersList.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
          </select>
        </div>
        <button onClick={resetFilters} className="mt-4 bg-gray-500 text-white px-4 py-2 rounded">Limpiar</button>
      </div>
      <div className="bg-white p-6 rounded shadow">
        {loading ? <div className="text-center py-12">Cargando...</div>
        : !filters.subject ? <div className="text-center py-12">Selecciona una materia</div>
        : grades.length === 0 ? <div className="text-center py-12">No hay calificaciones</div>
        : <HotTable ref={hotRef} data={grades} columns={buildColumns()} colHeaders={true} rowHeaders={true} width="100%" height="500"
            licenseKey="non-commercial-and-evaluation" stretchH="all" filters={true} dropdownMenu={true} columnSorting={true} />}
      </div>
    </div>
  );
}

export default GradesViewer;