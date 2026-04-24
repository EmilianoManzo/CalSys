import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../../api/axios';

registerAllModules();

function StudentsManager() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState({
    matricula: '', firstName: '', lastName: '', email: '', password: '',
    dateOfBirth: '', phone: '', address: '', status: 'active'
  });
  const hotRef = useRef(null);

  useEffect(() => { cargarEstudiantes(); }, []);

  const cargarEstudiantes = async () => {
    try {
      const response = await api.get('/admin/students');
      const data = response.data.students.map(s => [
        s.matricula, s.first_name, s.last_name, s.email, s.phone || '', s.status === 'active' ? 'Activo' : 'Inactivo'
      ]);
      setStudents(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingStudent) await api.put(`/admin/students/${editingStudent}`, formData);
      else await api.post('/admin/students', formData);
      alert(editingStudent ? 'Estudiante actualizado' : 'Estudiante creado');
      setShowModal(false); resetForm(); cargarEstudiantes();
    } catch (error) { alert(error.response?.data?.error || 'Error'); }
  };

  const handleEdit = (matricula) => {
    api.get('/admin/students').then(response => {
      const student = response.data.students.find(s => s.matricula === matricula);
      if (student) {
        setFormData({
          matricula: student.matricula, firstName: student.first_name, lastName: student.last_name,
          email: student.email, password: '', dateOfBirth: student.date_of_birth || '',
          phone: student.phone || '', address: student.address || '', status: student.status
        });
        setEditingStudent(matricula); setShowModal(true);
      }
    });
  };

  const handleDelete = async (matricula) => {
    if (confirm('¿Desactivar este estudiante?')) {
      try { await api.delete(`/admin/students/${matricula}`); alert('Estudiante desactivado'); cargarEstudiantes(); } 
      catch (error) { alert('Error'); }
    }
  };

  const resetForm = () => {
    setFormData({ matricula: '', firstName: '', lastName: '', email: '', password: '', dateOfBirth: '', phone: '', address: '', status: 'active' });
    setEditingStudent(null);
  };

  const columns = [
    { data: 0, title: 'Matrícula', readOnly: true, width: 100 },
    { data: 1, title: 'Nombre', readOnly: true, width: 150 },
    { data: 2, title: 'Apellido', readOnly: true, width: 150 },
    { data: 3, title: 'Email', readOnly: true, width: 200 },
    { data: 4, title: 'Teléfono', readOnly: true, width: 120 },
    { data: 5, title: 'Estado', readOnly: true, width: 100 }
  ];

  if (loading) return <div className="text-center py-12">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">👨‍🎓 Gestión de Estudiantes</h2>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">+ Agregar Estudiante</button>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <HotTable ref={hotRef} data={students} columns={columns} colHeaders={true} rowHeaders={true} width="100%" height="500"
          licenseKey="non-commercial-and-evaluation" stretchH="all" filters={true} dropdownMenu={true} columnSorting={true}
          contextMenu={{
            items: {
              edit: { name: '✏️ Editar', callback: (key, sel) => handleEdit(students[sel[0].start.row][0]) },
              delete: { name: '🗑️ Desactivar', callback: (key, sel) => handleDelete(students[sel[0].start.row][0]) }
            }
          }}
        />
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h3 className="text-2xl font-bold mb-4">{editingStudent ? 'Editar Estudiante' : 'Nuevo Estudiante'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold mb-1">Matrícula *</label><input type="text" value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value})} disabled={editingStudent} className="w-full border-2 rounded px-3 py-2" required /></div>
                <div><label className="block text-sm font-semibold mb-1">Email *</label><input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border-2 rounded px-3 py-2" required /></div>
                <div><label className="block text-sm font-semibold mb-1">Nombre *</label><input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full border-2 rounded px-3 py-2" required /></div>
                <div><label className="block text-sm font-semibold mb-1">Apellido *</label><input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full border-2 rounded px-3 py-2" required /></div>
                <div><label className="block text-sm font-semibold mb-1">Contraseña {!editingStudent && '*'}</label><input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full border-2 rounded px-3 py-2" required={!editingStudent} /></div>
                <div><label className="block text-sm font-semibold mb-1">Estado</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full border-2 rounded px-3 py-2"><option value="active">Activo</option><option value="inactive">Inactivo</option></select></div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="px-6 py-2 border-2 rounded">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentsManager;