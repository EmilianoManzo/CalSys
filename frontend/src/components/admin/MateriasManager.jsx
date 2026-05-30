import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../../api/axios';

registerAllModules();

function MateriasManager() {
  const [materias, setMaterias] = useState([]);
  const [profesores, setProfesores] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAsignarModal, setShowAsignarModal] = useState(false);
  const [nuevaMateria, setNuevaMateria] = useState({ subject_code: '', subject_name: '', credits: 5, description: '' });
  const [asignacion, setAsignacion] = useState({ subject_code: '', teacher_id: '', semester_code: '2025-1', group_code: '' });
  const hotMateriasRef = useRef(null);
  const hotAsignacionesRef = useRef(null);
  const materiasRawRef = useRef([]);
  const asignacionesRawRef = useRef([]);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [materiasRes, profesoresRes, gruposRes, asignacionesRes] = await Promise.all([
        api.get('/admin/materias'), api.get('/admin/profesores'), api.get('/admin/grupos'), api.get('/admin/asignaciones')
      ]);
      materiasRawRef.current = materiasRes.data.materias || [];
      asignacionesRawRef.current = asignacionesRes.data.asignaciones || [];
      setMaterias(materiasRawRef.current);
      setProfesores(profesoresRes.data.profesores);
      setGrupos(gruposRes.data.grupos);
      setAsignaciones(asignacionesRawRef.current);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleCrearMateria = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/materias', nuevaMateria);
      alert('Materia creada exitosamente');
      setShowModal(false);
      setNuevaMateria({ subject_code: '', subject_name: '', credits: 5, description: '' });
      cargarDatos();
    } catch (error) { alert(error.response?.data?.error || 'Error'); }
  };

  const handleAsignarMateria = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/asignar-materia', asignacion);
      alert('Materia asignada exitosamente');
      setShowAsignarModal(false);
      setAsignacion({ subject_code: '', teacher_id: '', semester_code: '2025-1', group_code: '' });
      cargarDatos();
    } catch (error) { alert(error.response?.data?.error || 'Error'); }
  };

  const handleDeleteMateria = async (id) => {
    const m = materiasRawRef.current.find(x => x.id === id);
    if (!m) return;
    const msg = (m.total_estudiantes || 0) > 0
      ? `¿Eliminar la materia "${m.subject_code}"? Se borrarán también todas las asignaciones y calificaciones asociadas.`
      : `¿Eliminar la materia "${m.subject_code}" del catálogo?`;
    if (!confirm(msg)) return;
    try {
      await api.delete(`/admin/materias/${id}`);
      alert('Materia eliminada');
      cargarDatos();
    } catch (error) { alert(error.response?.data?.error || 'Error al eliminar'); }
  };

  const handleDeleteAsignacion = async (index) => {
    const a = asignacionesRawRef.current[index];
    if (!a) return;
    const grupoLabel = a.group_code || 'sin grupo';
    if (!confirm(`¿Eliminar la asignación de ${a.subject_code} (${a.semester_code}, grupo ${grupoLabel}) con ${a.teacher_name}? Se borrarán inscripciones y calificaciones de esa clase.`)) return;
    try {
      const params = new URLSearchParams({
        subject_code: a.subject_code,
        teacher_id: String(a.teacher_id),
        semester_code: a.semester_code
      });
      if (a.group_code) params.set('group_code', a.group_code);
      await api.delete(`/admin/asignaciones?${params.toString()}`);
      alert('Asignación eliminada');
      cargarDatos();
    } catch (error) { alert(error.response?.data?.error || 'Error al eliminar'); }
  };

  const materiasData = materias.map(m => [m.id, m.subject_code, m.subject_name, m.credits || 5, m.total_estudiantes || 0, m.total_maestros || 0]);
  const asignacionesData = asignaciones.map((a, i) => [i, a.subject_code, a.subject_name || a.subject_code, a.teacher_name || 'Sin asignar', a.semester_code, a.group_code || '—', a.total_estudiantes || 0]);

  const materiasColumns = [
    { data: 0, title: 'ID', readOnly: true, width: 50 },
    { data: 1, title: 'Código', readOnly: true, width: 110 },
    { data: 2, title: 'Nombre', readOnly: true, width: 180 },
    { data: 3, title: 'Créditos', readOnly: true, width: 80 },
    { data: 4, title: 'Estudiantes', readOnly: true, width: 90 },
    { data: 5, title: 'Maestros', readOnly: true, width: 90 }
  ];

  const asignacionesColumns = [
    { data: 1, title: 'Código', readOnly: true, width: 100 },
    { data: 2, title: 'Materia', readOnly: true, width: 140 },
    { data: 3, title: 'Profesor', readOnly: true, width: 160 },
    { data: 4, title: 'Semestre', readOnly: true, width: 90 },
    { data: 5, title: 'Grupo', readOnly: true, width: 80 },
    { data: 6, title: 'Estudiantes', readOnly: true, width: 90 }
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Cargando...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#111111' }}>📚 Gestión de Materias</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setShowModal(true)} style={{ background: 'var(--brand)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>+ Nueva Materia</button>
          <button onClick={() => setShowAsignarModal(true)} style={{ background: 'var(--brand)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>📌 Asignar</button>
        </div>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '1rem' }}>📖 Catálogo de Materias</h3>
        <HotTable ref={hotMateriasRef} data={materiasData} columns={materiasColumns} colHeaders={true} rowHeaders={true} width="100%" height="300"
          licenseKey="non-commercial-and-evaluation" stretchH="all" filters={true} dropdownMenu={true} columnSorting={true}
          contextMenu={{
            items: {
              delete: {
                name: 'Eliminar materia',
                callback: (key, sel) => handleDeleteMateria(materiasData[sel[0].start.row][0])
              }
            }
          }}
        />
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '1rem' }}>📌 Asignaciones Actuales</h3>
        <HotTable ref={hotAsignacionesRef} data={asignacionesData} columns={asignacionesColumns} colHeaders={true} rowHeaders={true} width="100%" height="300"
          licenseKey="non-commercial-and-evaluation" stretchH="all" filters={true} dropdownMenu={true} columnSorting={true}
          contextMenu={{
            items: {
              delete: {
                name: 'Eliminar asignación',
                callback: (key, sel) => handleDeleteAsignacion(asignacionesData[sel[0].start.row][0])
              }
            }
          }}
        />
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>Clic derecho en una fila para eliminar materia o asignación.</p>
      </div>

      {/* Modal Nueva Materia */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.5rem', maxWidth: '500px', width: '90%' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '1rem' }}>📖 Nueva Materia</h3>
            <form onSubmit={handleCrearMateria}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Código *</label>
                <input type="text" value={nuevaMateria.subject_code} onChange={e => setNuevaMateria({...nuevaMateria, subject_code: e.target.value.toUpperCase()})}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Nombre *</label>
                <input type="text" value={nuevaMateria.subject_name} onChange={e => setNuevaMateria({...nuevaMateria, subject_name: e.target.value})}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Créditos</label>
                <input type="number" value={nuevaMateria.credits} onChange={e => setNuevaMateria({...nuevaMateria, credits: parseInt(e.target.value)})}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} min="1" max="10" />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Descripción</label>
                <textarea value={nuevaMateria.description} onChange={e => setNuevaMateria({...nuevaMateria, description: e.target.value})}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} rows="3" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 20px', border: '0.5px solid #e5e7eb', borderRadius: '8px', background: '#ffffff', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 24px', border: 'none', borderRadius: '8px', background: 'var(--brand)', color: '#ffffff', cursor: 'pointer' }}>Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Asignar Materia */}
      {showAsignarModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.5rem', maxWidth: '500px', width: '90%' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '1rem' }}>📌 Asignar Materia</h3>
            <form onSubmit={handleAsignarMateria}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Materia *</label>
                <select value={asignacion.subject_code} onChange={e => setAsignacion({...asignacion, subject_code: e.target.value})}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required>
                  <option value="">Seleccionar</option>
                  {materias.map(m => <option key={m.subject_code} value={m.subject_code}>{m.subject_code} - {m.subject_name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Profesor *</label>
                <select value={asignacion.teacher_id} onChange={e => setAsignacion({...asignacion, teacher_id: e.target.value})}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required>
                  <option value="">Seleccionar</option>
                  {profesores.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Semestre *</label>
                <select value={asignacion.semester_code} onChange={e => setAsignacion({...asignacion, semester_code: e.target.value})}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
                  <option value="2025-1">2025-1</option><option value="2024-2">2024-2</option><option value="2024-1">2024-1</option>
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Grupo</label>
                <select value={asignacion.group_code} onChange={e => setAsignacion({...asignacion, group_code: e.target.value})}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
                  <option value="">Sin grupo</option>
                  {grupos.map(g => <option key={g} value={g}>Grupo {g}</option>)}
                </select>
              </div>
              <div style={{ background: 'var(--warning-bg)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', color: 'var(--warning-text)', marginBottom: '1rem' }}>
                Solo se inscribirán los alumnos del grupo seleccionado. Si deja &quot;Sin grupo&quot;, solo alumnos sin grupo asignado.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setShowAsignarModal(false)} style={{ padding: '8px 20px', border: '0.5px solid #e5e7eb', borderRadius: '8px', background: '#ffffff', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 24px', border: 'none', borderRadius: '8px', background: 'var(--brand)', color: '#ffffff', cursor: 'pointer' }}>Asignar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MateriasManager;