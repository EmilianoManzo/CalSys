import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../../api/axios';

registerAllModules();

function StudentsManager() {
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [formData, setFormData] = useState({
    matricula: '', firstName: '', lastName: '', email: '', password: '',
    dateOfBirth: '', phone: '', address: '', status: 'active', groupId: ''
  });
  const hotRef = useRef(null);

  useEffect(() => { cargarEstudiantes(); }, []);

  const cargarEstudiantes = async () => {
    try {
      const [studentsRes, groupsRes] = await Promise.all([
        api.get('/admin/students'),
        api.get('/admin/student-groups')
      ]);
      setGroups((groupsRes.data.groups || []).filter(g => g.is_active));
      const data = studentsRes.data.students.map(s => [
        s.matricula, s.first_name, s.last_name, s.email,
        s.group_name || s.group_code || '—',
        s.phone || '', s.status === 'active' ? 'Activo' : 'Inactivo'
      ]);
      setStudents(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = submitPayload();
      if (editingStudent) await api.put(`/admin/students/${editingStudent}`, payload);
      else await api.post('/admin/students', payload);
      setMessage({ text: editingStudent ? 'Estudiante actualizado' : 'Estudiante creado', type: 'success' });
      setShowModal(false); resetForm(); cargarEstudiantes();
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (error) { setMessage({ text: error.response?.data?.error || 'Error', type: 'error' }); }
  };

  const handleEdit = (matricula) => {
    api.get('/admin/students').then(response => {
      const student = response.data.students.find(s => s.matricula === matricula);
      if (student) {
        setFormData({
          matricula: student.matricula, firstName: student.first_name, lastName: student.last_name,
          email: student.email, password: '', dateOfBirth: student.date_of_birth || '',
          phone: student.phone || '', address: student.address || '', status: student.status,
          groupId: student.group_id || ''
        });
        setEditingStudent(matricula); setShowModal(true);
      }
    });
  };

  const handleDeactivate = async (matricula) => {
    if (!confirm('¿Desactivar este alumno? No podrá iniciar sesión, pero su registro y datos se conservan.')) return;
    try {
      await api.delete(`/admin/students/${matricula}`);
      setMessage({ text: 'Alumno desactivado', type: 'success' });
      cargarEstudiantes();
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (error) {
      setMessage({ text: error.response?.data?.error || 'Error al desactivar', type: 'error' });
    }
  };

  const handlePermanentDelete = async (matricula) => {
    if (!confirm('¿BORRAR PERMANENTEMENTE este alumno?\n\nSe eliminarán calificaciones, asistencia y el registro. Esta acción no se puede deshacer.')) return;
    if (!confirm('Confirme de nuevo: eliminar permanentemente al alumno ' + matricula)) return;
    try {
      await api.delete(`/admin/students/${matricula}?permanent=true`);
      setMessage({ text: 'Alumno eliminado permanentemente', type: 'success' });
      cargarEstudiantes();
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (error) {
      setMessage({ text: error.response?.data?.error || 'Error al borrar', type: 'error' });
    }
  };

  const resetForm = () => {
    setFormData({ matricula: '', firstName: '', lastName: '', email: '', password: '', dateOfBirth: '', phone: '', address: '', status: 'active', groupId: '' });
    setEditingStudent(null);
  };

  const submitPayload = () => ({
    ...formData,
    groupId: formData.groupId === '' ? null : formData.groupId
  });

  const columns = [
    { data: 0, title: 'Matrícula', readOnly: true, width: 100 },
    { data: 1, title: 'Nombre', readOnly: true, width: 150 },
    { data: 2, title: 'Apellido', readOnly: true, width: 150 },
    { data: 3, title: 'Email', readOnly: true, width: 180 },
    { data: 4, title: 'Grupo', readOnly: true, width: 100 },
    { data: 5, title: 'Teléfono', readOnly: true, width: 110 },
    { data: 6, title: 'Estado', readOnly: true, width: 90 }
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Cargando...</div>;

  return (
    <div>
      {message.text && (
        <div style={{ padding: '12px', borderRadius: '8px', marginBottom: '1rem', background: message.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)', color: message.type === 'success' ? 'var(--success-text)' : 'var(--error-text)' }}>
          {message.text}
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#111111' }}>👨‍🎓 Gestión de Estudiantes</h2>
        <button onClick={() => { resetForm(); setShowModal(true); }} style={{ background: 'var(--brand)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>+ Agregar Estudiante</button>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem' }}>
        <HotTable ref={hotRef} data={students} columns={columns} colHeaders={true} rowHeaders={true} width="100%" height="500"
          licenseKey="non-commercial-and-evaluation" stretchH="all" filters={true} dropdownMenu={true} columnSorting={true}
          contextMenu={{
            items: {
              edit: { name: 'Editar', callback: (key, sel) => handleEdit(students[sel[0].start.row][0]) },
              deactivate: { name: 'Desactivar alumno', callback: (key, sel) => handleDeactivate(students[sel[0].start.row][0]) },
              permanent: { name: 'Borrar permanentemente', callback: (key, sel) => handlePermanentDelete(students[sel[0].start.row][0]) }
            }
          }}
        />
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>Clic derecho: editar, desactivar (conserva datos) o borrar permanentemente.</p>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.5rem', maxWidth: '700px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '1rem' }}>{editingStudent ? 'Editar Estudiante' : 'Nuevo Estudiante'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Matrícula *</label>
                  <input type="text" value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value})} disabled={editingStudent}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Email *</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Nombre *</label>
                  <input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Apellido *</label>
                  <input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Contraseña {!editingStudent && '*'}</label>
                  <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required={!editingStudent} /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Estado</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
                    <option value="active">Activo</option><option value="inactive">Inactivo</option>
                  </select></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Grupo</label>
                  <select value={formData.groupId} onChange={e => setFormData({...formData, groupId: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
                    <option value="">Sin grupo</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.group_code} — {g.name}</option>
                    ))}
                  </select></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} style={{ padding: '8px 20px', border: '0.5px solid #e5e7eb', borderRadius: '8px', background: '#ffffff', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 24px', border: 'none', borderRadius: '8px', background: 'var(--brand)', color: '#ffffff', cursor: 'pointer' }}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentsManager;