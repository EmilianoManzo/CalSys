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
      const params = {
        teacherId: filters.teacherId,
        semester: filters.semester,
        subject: filters.subject,
        partialId
      };
      if (filters.group && filters.group !== '') params.group = filters.group;

      const response = await api.get('/partials/grades', { params });
      const rawGrades = response.data.grades || [];
      const columnsData = response.data.columns || [];

      const tableData = rawGrades.map(g => {
        const row = [g.matricula, g.nombre];
        columnsData.forEach(col => {
          const val = g[`col_${col.column_name}`];
          row.push(val !== null ? parseFloat(val).toFixed(2) : '');
        });
        // Agregar estado derivado de la calificación final? La columna final ya está en columnsData.
        // Pero asumimos que la columna final es la última o la especial. 
        // Como ya tenemos la columna "🎯 CALIFICACIÓN FINAL GLOBAL" en columnsData, no necesitamos estado extra.
        // Simplemente usamos los colores en la celda final.
        return row;
      });
      setGrades(tableData);
      setColumns(columnsData);
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

  // Calcular índices de columnas finales (para colores)
  // La última columna es la calificación final (si es que el backend la envía). 
  // En nuestro backend, para partialId=4 se envía una columna "🎯 CALIFICACIÓN FINAL GLOBAL" que es la última.
  // La columna de estado no existe en el admin porque no la pedimos. Podemos agregarla si queremos.
  // Por simplicidad, solo coloreamos la columna final (que es la última de la tabla).
  const finalColIndex = 2 + columns.length - 1; // última columna

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
          <div className="text-center py-12 text-gray-500">Selecciona una materia</div>
        ) : grades.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No hay calificaciones</div>
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
            cells={(row, col) => {
              const cellProperties = {};
              // Colorear la columna final (la última)
              if (col === finalColIndex) {
                cellProperties.renderer = function(instance, td, row, col, prop, value) {
                  td.innerHTML = value !== null && value !== '' ? parseFloat(value).toFixed(2) : 'N/A';
                  td.style.fontWeight = 'bold';
                  td.style.textAlign = 'center';
                  if (value !== null && value !== '' && !isNaN(parseFloat(value))) {
                    const val = parseFloat(value);
                    if (val >= 9) {
                      td.style.backgroundColor = '#10b981';
                      td.style.color = 'white';
                    } else if (val >= 6) {
                      td.style.backgroundColor = '#3b82f6';
                      td.style.color = 'white';
                    } else {
                      td.style.backgroundColor = '#ef4444';
                      td.style.color = 'white';
                    }
                  } else {
                    td.style.backgroundColor = '#fef3c7';
                    td.style.color = '#92400e';
                  }
                  return td;
                };
              }
              return cellProperties;
            }}
          />
        )}
      </div>
    </div>
  );
}

export default GradesViewer;