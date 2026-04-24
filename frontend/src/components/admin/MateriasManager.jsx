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

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [materiasRes, profesoresRes, gruposRes, asignacionesRes] = await Promise.all([
        api.get('/admin/materias'), api.get('/admin/profesores'), api.get('/admin/grupos'), api.get('/admin/asignaciones')
      ]);
      setMaterias(materiasRes.data.materias);
      setProfesores(profesoresRes.data.profesores);
      setGrupos(gruposRes.data.grupos);
      setAsignaciones(asignacionesRes.data.asignaciones);
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

  const materiasData = materias.map(m => [m.subject_code, m.subject_name, m.credits || 5, m.total_estudiantes || 0, m.total_maestros || 0]);
  const asignacionesData = asignaciones.map(a => [a.subject_code, a.subject_name || a.subject_code, a.teacher_name || 'Sin asignar', a.semester_code, a.group_code || 'N/A', a.total_estudiantes || 0]);

  const materiasColumns = [
    { data: 0, title: 'Código', readOnly: true, width: 120 },
    { data: 1, title: 'Nombre', readOnly: true, width: 200 },
    { data: 2, title: 'Créditos', readOnly: true, width: 80 },
    { data: 3, title: 'Estudiantes', readOnly: true, width: 100, type: 'numeric' },
    { data: 4, title: 'Maestros', readOnly: true, width: 100, type: 'numeric' }
  ];

  const asignacionesColumns = [
    { data: 0, title: 'Código', readOnly: true, width: 100 },
    { data: 1, title: 'Materia', readOnly: true, width: 150 },
    { data: 2, title: 'Profesor', readOnly: true, width: 180 },
    { data: 3, title: 'Semestre', readOnly: true, width: 90 },
    { data: 4, title: 'Grupo', readOnly: true, width: 70 },
    { data: 5, title: 'Estudiantes', readOnly: true, width: 100, type: 'numeric' }
  ];

  if (loading) return <div className="text-center py-12">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">📚 Gestión de Materias</h2>
        <div className="flex gap-3">
          <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">+ Nueva Materia</button>
          <button onClick={() => setShowAsignarModal(true)} className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">📌 Asignar a Profesor</button>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">📖 Catálogo de Materias</h3>
        <HotTable ref={hotMateriasRef} data={materiasData} columns={materiasColumns} colHeaders={true} rowHeaders={true} width="100%" height="300"
          licenseKey="non-commercial-and-evaluation" stretchH="all" filters={true} dropdownMenu={true} columnSorting={true} />
        {materias.length === 0 && <div className="text-center py-8 text-gray-500">No hay materias registradas</div>}
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">📌 Asignaciones Actuales</h3>
        <HotTable ref={hotAsignacionesRef} data={asignacionesData} columns={asignacionesColumns} colHeaders={true} rowHeaders={true} width="100%" height="300"
          licenseKey="non-commercial-and-evaluation" stretchH="all" filters={true} dropdownMenu={true} columnSorting={true} />
        {asignaciones.length === 0 && <div className="text-center py-8 text-gray-500">No hay asignaciones</div>}
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold mb-4">📖 Nueva Materia</h3>
            <form onSubmit={handleCrearMateria} className="space-y-4">
              <div><label className="block text-sm font-semibold mb-1">Código *</label><input type="text" value={nuevaMateria.subject_code} onChange={e => setNuevaMateria({...nuevaMateria, subject_code: e.target.value.toUpperCase()})} className="w-full border-2 rounded px-3 py-2" required /></div>
              <div><label className="block text-sm font-semibold mb-1">Nombre *</label><input type="text" value={nuevaMateria.subject_name} onChange={e => setNuevaMateria({...nuevaMateria, subject_name: e.target.value})} className="w-full border-2 rounded px-3 py-2" required /></div>
              <div><label className="block text-sm font-semibold mb-1">Créditos</label><input type="number" value={nuevaMateria.credits} onChange={e => setNuevaMateria({...nuevaMateria, credits: parseInt(e.target.value)})} className="w-full border-2 rounded px-3 py-2" min="1" max="10" /></div>
              <div><label className="block text-sm font-semibold mb-1">Descripción</label><textarea value={nuevaMateria.description} onChange={e => setNuevaMateria({...nuevaMateria, description: e.target.value})} className="w-full border-2 rounded px-3 py-2" rows="3" /></div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 border-2 rounded">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showAsignarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold mb-4">📌 Asignar Materia</h3>
            <form onSubmit={handleAsignarMateria} className="space-y-4">
              <div><label className="block text-sm font-semibold mb-1">Materia *</label><select value={asignacion.subject_code} onChange={e => setAsignacion({...asignacion, subject_code: e.target.value})} className="w-full border-2 rounded px-3 py-2" required><option value="">Seleccionar</option>{materias.map(m => <option key={m.subject_code} value={m.subject_code}>{m.subject_code} - {m.subject_name}</option>)}</select></div>
              <div><label className="block text-sm font-semibold mb-1">Profesor *</label><select value={asignacion.teacher_id} onChange={e => setAsignacion({...asignacion, teacher_id: e.target.value})} className="w-full border-2 rounded px-3 py-2" required><option value="">Seleccionar</option>{profesores.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></div>
              <div><label className="block text-sm font-semibold mb-1">Semestre *</label><select value={asignacion.semester_code} onChange={e => setAsignacion({...asignacion, semester_code: e.target.value})} className="w-full border-2 rounded px-3 py-2"><option value="2025-1">2025-1</option><option value="2024-2">2024-2</option><option value="2024-1">2024-1</option></select></div>
              <div><label className="block text-sm font-semibold mb-1">Grupo</label><select value={asignacion.group_code} onChange={e => setAsignacion({...asignacion, group_code: e.target.value})} className="w-full border-2 rounded px-3 py-2"><option value="">Sin grupo</option>{grupos.map(g => <option key={g} value={g}>Grupo {g}</option>)}</select></div>
              <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800">⚠️ Al asignar, la materia se asignará a TODOS los estudiantes activos</div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowAsignarModal(false)} className="px-6 py-2 border-2 rounded">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded">Asignar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MateriasManager;