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
    matricula: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    dateOfBirth: '',
    phone: '',
    address: '',
    status: 'active'
  });
  const hotRef = useRef(null);

  useEffect(() => {
    cargarEstudiantes();
  }, []);

  const cargarEstudiantes = async () => {
    try {
      const response = await api.get('/admin/students');
      const data = response.data.students.map(s => [
        s.matricula,
        s.first_name,
        s.last_name,
        s.email,
        s.phone || '',
        s.status
      ]);
      setStudents(data);
    } catch (error) {
      console.error('Error cargando estudiantes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingStudent) {
        await api.put(`/admin/students/${editingStudent}`, formData);
        alert('Estudiante actualizado exitosamente');
      } else {
        await api.post('/admin/students', formData);
        alert('Estudiante creado exitosamente');
      }
      setShowModal(false);
      resetForm();
      cargarEstudiantes();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al guardar estudiante');
    }
  };

  const handleEdit = (matricula) => {
    api.get('/admin/students').then(response => {
      const student = response.data.students.find(s => s.matricula === matricula);
      if (student) {
        setFormData({
          matricula: student.matricula,
          firstName: student.first_name,
          lastName: student.last_name,
          email: student.email,
          password: '',
          dateOfBirth: student.date_of_birth || '',
          phone: student.phone || '',
          address: student.address || '',
          status: student.status
        });
        setEditingStudent(matricula);
        setShowModal(true);
      }
    });
  };

  const handleDelete = async (matricula) => {
    if (confirm('¿Estás seguro de desactivar este estudiante?')) {
      try {
        await api.delete(`/admin/students/${matricula}`);
        alert('Estudiante desactivado');
        cargarEstudiantes();
      } catch (error) {
        alert('Error al desactivar estudiante');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      matricula: '',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      dateOfBirth: '',
      phone: '',
      address: '',
      status: 'active'
    });
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
        <h2 className="text-2xl font-bold text-gray-800">Gestión de Estudiantes</h2>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-semibold"
        >
          + Agregar Estudiante
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <HotTable
          ref={hotRef}
          data={students}
          columns={columns}
          colHeaders={true}
          rowHeaders={true}
          width="100%"
          height="500"
          licenseKey="non-commercial-and-evaluation"
          stretchH="all"
          filters={true}
          dropdownMenu={['filter_by_value', 'filter_action_bar']}
          columnSorting={true}
          contextMenu={{
            items: {
              'edit': {
                name: 'Editar',
                callback: (key, selection) => {
                  const row = selection[0].start.row;
                  const matricula = students[row][0];
                  handleEdit(matricula);
                }
              },
              'delete': {
                name: 'Desactivar',
                callback: (key, selection) => {
                  const row = selection[0].start.row;
                  const matricula = students[row][0];
                  handleDelete(matricula);
                }
              }
            }
          }}
        />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4">
              {editingStudent ? 'Editar Estudiante' : 'Nuevo Estudiante'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Matrícula *</label>
                  <input
                    type="text"
                    value={formData.matricula}
                    onChange={e => setFormData({...formData, matricula: e.target.value})}
                    disabled={editingStudent}
                    className="w-full border-2 rounded-lg px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full border-2 rounded-lg px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={e => setFormData({...formData, firstName: e.target.value})}
                    className="w-full border-2 rounded-lg px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Apellido *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={e => setFormData({...formData, lastName: e.target.value})}
                    className="w-full border-2 rounded-lg px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Contraseña {editingStudent ? '(dejar vacío para no cambiar)' : '*'}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="w-full border-2 rounded-lg px-3 py-2"
                    required={!editingStudent}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Fecha de Nacimiento</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={e => setFormData({...formData, dateOfBirth: e.target.value})}
                    className="w-full border-2 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full border-2 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Estado</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                    className="w-full border-2 rounded-lg px-3 py-2"
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                    <option value="suspended">Suspendido</option>
                    <option value="graduated">Graduado</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold mb-1">Dirección</label>
                  <textarea
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                    className="w-full border-2 rounded-lg px-3 py-2"
                    rows="2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-6 py-2 border-2 rounded-lg hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                >
                  {editingStudent ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentsManager;