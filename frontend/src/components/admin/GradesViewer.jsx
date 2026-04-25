import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../../api/axios';

registerAllModules();

function GradesViewer() {
  const [grades, setGrades] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subjectsList, setSubjectsList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [teachersList, setTeachersList] = useState([]);
  const [semestersList, setSemestersList] = useState([]);
  const [partialId, setPartialId] = useState(1);
  const [filters, setFilters] = useState({
    semester: '',
    subject: '',
    group: '',
    teacherId: ''
  });
  const hotRef = useRef(null);

  useEffect(() => {
    cargarMaterias();
    cargarMaestros();
    cargarSemestres();
  }, []);

  useEffect(() => {
    if (filters.subject && filters.semester && filters.teacherId) {
      cargarCalificaciones();
    }
  }, [filters, partialId]);

  const cargarMaterias = async () => {
    try {
      const response = await api.get('/admin/subjects');
      setSubjectsList(response.data.subjects || []);
    } catch (error) {
      console.error('Error cargando materias:', error);
    }
  };

  const cargarMaestros = async () => {
    try {
      const response = await api.get('/admin/teachers');
      setTeachersList(response.data.teachers || []);
    } catch (error) {
      console.error('Error cargando maestros:', error);
    }
  };

  const cargarSemestres = async () => {
    try {
      const response = await api.get('/admin/semesters');
      setSemestersList(response.data.semesters || []);
      if (response.data.semesters && response.data.semesters.length > 0) {
        setFilters(prev => ({ ...prev, semester: response.data.semesters[0] }));
      }
    } catch (error) {
      console.error('Error cargando semestres:', error);
    }
  };

  const cargarGrupos = async (subjectCode, teacherId) => {
    if (!subjectCode) {
      setGroupsList([]);
      return;
    }
    try {
      const params = { subjectCode };
      if (filters.semester) params.semester = filters.semester;
      if (teacherId) params.teacherId = teacherId;
      const response = await api.get('/admin/subject-groups', { params });
      setGroupsList(response.data.groups || []);
    } catch (error) {
      console.error('Error cargando grupos:', error);
    }
  };

  const cargarCalificaciones = async () => {
    setLoading(true);
    try {
      // Parámetros para obtener columnas
      const paramsColumns = {
        teacherId: filters.teacherId,
        semester: filters.semester,
        subject: filters.subject,
        partialId
      };
      if (filters.group && filters.group !== '') {
        paramsColumns.group = filters.group;
      }
      const columnsRes = await api.get('/partials/config', { params: paramsColumns });
      const configColumns = columnsRes.data.columns || [];
      setColumns(configColumns);

      // Parámetros para obtener calificaciones
      const paramsGrades = {
        teacherId: filters.teacherId,
        semester: filters.semester,
        subject: filters.subject,
        partialId
      };
      if (filters.group && filters.group !== '') {
        paramsGrades.group = filters.group;
      }
      const gradesRes = await api.get('/partials/grades', { params: paramsGrades });
      const rawGrades = gradesRes.data.grades || [];

      const tableData = rawGrades.map(g => {
        const row = [g.matricula, g.nombre];
        configColumns.forEach(col => {
          const val = g[`col_${col.column_name}`];
          row.push(val !== null ? parseFloat(val).toFixed(2) : '');
        });
        return row;
      });
      setGrades(tableData);
    } catch (error) {
      console.error('Error cargando calificaciones:', error);
      alert('Error al cargar calificaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectChange = async (e) => {
    const subjectCode = e.target.value;
    const selectedSubject = subjectsList.find(s => s.subject_code === subjectCode);
    const teacherId = selectedSubject ? selectedSubject.teacher_id : '';
    setFilters(prev => ({ ...prev, subject: subjectCode, group: '', teacherId }));
    if (subjectCode && teacherId) {
      await cargarGrupos(subjectCode, teacherId);
    } else {
      setGroupsList([]);
    }
  };

  const resetFilters = () => {
    setFilters({
      semester: semestersList[0] || '',
      subject: '',
      group: '',
      teacherId: ''
    });
    setGroupsList([]);
    setPartialId(1);
  };

  const buildColumns = () => {
    const base = [
      { data: 0, title: 'Matrícula', readOnly: true, width: 100 },
      { data: 1, title: 'Alumno', readOnly: true, width: 200 }
    ];
    columns.forEach((col, idx) => {
      base.push({
        data: 2 + idx,
        title: `${col.column_name}${col.is_special ? ' ⭐' : ''} (${col.weight}% / ${col.max_value})`,
        readOnly: true,
        type: 'numeric',
        numericFormat: { pattern: '0.00' },
        width: 140
      });
    });
    return base;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">📊 Calificaciones</h2>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">📅 Semestre</label>
            <select
              value={filters.semester}
              onChange={e => setFilters({ ...filters, semester: e.target.value, subject: '', group: '', teacherId: '' })}
              className="w-full border-2 rounded-lg px-3 py-2"
            >
              <option value="">Todos</option>
              {semestersList.map(sem => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">📚 Materia</label>
            <select
              value={filters.subject}
              onChange={handleSubjectChange}
              className="w-full border-2 rounded-lg px-3 py-2"
            >
              <option value="">Seleccionar materia</option>
              {subjectsList.map(subj => (
                <option key={`${subj.subject_code}-${subj.teacher_id}`} value={subj.subject_code}>
                  {subj.subject_code} (Profesor ID: {subj.teacher_id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">👥 Grupo</label>
            <select
              value={filters.group}
              onChange={e => setFilters({ ...filters, group: e.target.value })}
              className="w-full border-2 rounded-lg px-3 py-2"
              disabled={!filters.subject}
            >
              <option value="">Todos</option>
              {groupsList.map(g => (
                <option key={g.group_code} value={g.group_code}>
                  Grupo {g.group_code} - {g.total_students} alumnos
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">🎯 Tipo</label>
            <select
              value={partialId}
              onChange={e => setPartialId(parseInt(e.target.value))}
              className="w-full border-2 rounded-lg px-3 py-2"
            >
              <option value={1}>📘 Parcial 1</option>
              <option value={2}>📗 Parcial 2</option>
              <option value={3}>📙 Parcial 3</option>
              <option value={4}>🎓 Calificación Final</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => cargarCalificaciones()}
              className="w-full bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 font-semibold"
            >
              🔄 Actualizar
            </button>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={resetFilters}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {loading ? (
          <div className="text-center py-12">Cargando calificaciones...</div>
        ) : !filters.subject ? (
          <div className="text-center py-12 text-gray-500">
            Selecciona una materia para ver sus calificaciones
          </div>
        ) : grades.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No hay calificaciones registradas para los filtros seleccionados
          </div>
        ) : (
          <HotTable
            ref={hotRef}
            data={grades}
            columns={buildColumns()}
            colHeaders={true}
            rowHeaders={true}
            width="100%"
            height="500"
            licenseKey="non-commercial-and-evaluation"
            stretchH="all"
            filters={true}
            dropdownMenu={true}
            columnSorting={true}
          />
        )}
      </div>
    </div>
  );
}

export default GradesViewer;