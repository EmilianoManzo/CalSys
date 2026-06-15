import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../../api/axios';
import { gradeStyle, colors } from '../../theme';

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
  const [filters, setFilters] = useState({ semester: '', subject: '', group: '', teacherId: '' });
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
    } catch (error) { console.error(error); }
  };

  const cargarMaestros = async () => {
    try {
      const response = await api.get('/admin/teachers');
      setTeachersList(response.data.teachers || []);
    } catch (error) { console.error(error); }
  };

  const cargarSemestres = async () => {
    try {
      const response = await api.get('/admin/semesters');
      setSemestersList(response.data.semesters || []);
      if (response.data.semesters?.length > 0) {
        setFilters(prev => ({ ...prev, semester: response.data.semesters[0] }));
      }
    } catch (error) { console.error(error); }
  };

  const cargarGrupos = async (subjectCode, teacherId) => {
    if (!subjectCode) { setGroupsList([]); return; }
    try {
      const params = { subjectCode };
      if (filters.semester) params.semester = filters.semester;
      if (teacherId) params.teacherId = teacherId;
      const response = await api.get('/admin/subject-groups', { params });
      setGroupsList(response.data.groups || []);
    } catch (error) { console.error(error); }
  };

  const cargarCalificaciones = async () => {
    setLoading(true);
    try {
      const params = { teacherId: filters.teacherId, semester: filters.semester, subject: filters.subject, partialId };
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
        return row;
      });
      setGrades(tableData);
      setColumns(columnsData);
    } catch (error) {
      console.error(error);
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
    if (subjectCode && teacherId) await cargarGrupos(subjectCode, teacherId);
    else setGroupsList([]);
  };

  const resetFilters = () => {
    setFilters({ semester: semestersList[0] || '', subject: '', group: '', teacherId: '' });
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
        title: `${col.column_name}${col.is_special ? ' ⭐' : ''}`,
        readOnly: true,
        type: 'numeric',
        numericFormat: { pattern: '0.00' },
        width: 140
      });
    });
    return base;
  };

  const finalColIndex = 2 + columns.length - 1;

  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#111111', marginBottom: '1rem' }}>📊 Calificaciones</h2>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Semestre</label>
            <select value={filters.semester} onChange={e => setFilters({ ...filters, semester: e.target.value, subject: '', group: '', teacherId: '' })}
              style={{ width: '100%', background: '#fafafa', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
              <option value="">Todos</option>
              {semestersList.map(sem => <option key={sem} value={sem}>{sem}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Materia</label>
            <select value={filters.subject} onChange={handleSubjectChange}
              style={{ width: '100%', background: '#fafafa', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
              <option value="">Seleccionar</option>
              {subjectsList.map(subj => <option key={`${subj.subject_code}-${subj.teacher_id}`} value={subj.subject_code}>{subj.subject_code}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Grupo</label>
            <select value={filters.group} onChange={e => setFilters({ ...filters, group: e.target.value })} disabled={!filters.subject}
              style={{ width: '100%', background: '#fafafa', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
              <option value="">Todos</option>
              {groupsList.map(g => <option key={g.group_code} value={g.group_code}>Grupo {g.group_code}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Tipo</label>
            <select value={partialId} onChange={e => setPartialId(parseInt(e.target.value))}
              style={{ width: '100%', background: '#fafafa', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
              <option value={1}>Parcial 1</option>
              <option value={2}>Parcial 2</option>
              <option value={3}>Parcial 3</option>
              <option value={4}>Examen Final</option>
              <option value={5}>Calificación Final</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <button onClick={() => cargarCalificaciones()}
              style={{ background: '#880000', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              🔄 Actualizar
            </button>
            <button onClick={resetFilters}
              style={{ background: '#6b7280', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              Limpiar
            </button>
          </div>
        </div>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Cargando calificaciones...</div>
        ) : !filters.subject ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Selecciona una materia</div>
        ) : grades.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>No hay calificaciones</div>
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
              if (col === finalColIndex) {
                cellProperties.renderer = function(instance, td, row, col, prop, value) {
                  td.textContent = value !== null && value !== '' ? parseFloat(value).toFixed(2) : 'N/A';
                  td.style.fontWeight = 'bold';
                  td.style.textAlign = 'center';
                  const style = gradeStyle(value);
                  if (value !== null && value !== '' && !isNaN(parseFloat(value))) {
                    td.style.backgroundColor = style.solid;
                    td.style.color = 'white';
                  } else {
                    td.style.backgroundColor = style.bg;
                    td.style.color = style.text;
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