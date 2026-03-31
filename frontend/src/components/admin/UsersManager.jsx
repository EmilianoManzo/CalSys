import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../../api/axios';

registerAllModules();

function UsersManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'maestro',
    phone: '',
    isActive: true
  });
  const hotRef = useRef(null);

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      const response = await api.get('/admin/users');
      const data = response.data.users.map(u => [
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        u.is_active ? 'Activo' : 'Inactivo'
      ]);
      setUsers(data);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await api.put(`/admin/users/${editingUser}`, formData);
        alert('Usuario actualizado exitosamente');
      } else {
        await api.post('/admin/users', formData);
        alert('Usuario creado exitosamente');
      }
      setShowModal(false);
      resetForm();
      cargarUsuarios();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al guardar usuario');
    }
  };

  const handleEdit = (id) => {
    api.get('/admin/users').then(response => {
      const user = response.data.users.find(u => u.id === id);
      if (user) {
        setFormData({
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          password: '',
          role: user.role,
          phone: user.phone || '',
          isActive: user.is_active
        });
        setEditingUser(id);
        setShowModal(true);
      }
    });
  };

  const handleDelete = async (id) => {
    if (confirm('¿Estás seguro de desactivar este usuario?')) {
      try {
        await api.delete(`/admin/users/${id}`);
        alert('Usuario desactivado');
        cargarUsuarios();
      } catch (error) {
        alert('Error al desactivar usuario');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'maestro',
      phone: '',
      isActive: true
    });
    setEditingUser(null);
  };

  const columns = [
    { data: 0, title: 'ID', readOnly: true, width: 60 },
    { data: 1, title: 'Usuario', readOnly: true, width: 120 },
    { data: 2, title: 'Nombre', readOnly: true, width: 150 },
    { data: 3, title: 'Apellido', readOnly: true, width: 150 },
    { data: 4, title: 'Email', readOnly: true, width: 200 },
    { data: 5, title: 'Rol', readOnly: true, width: 100 },
    { data: 6, title: 'Estado', readOnly: true, width: 100 }
  ];

  if (loading) return <div className="text-center py-12">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Gestión de Usuarios/Staff</h2>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-semibold"
        >
          + Agregar Usuario
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <HotTable
          ref={hotRef}
          data={users}
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
                  const id = users[row][0];
                  handleEdit(id);
                }
              },
              'delete': {
                name: 'Desactivar',
                callback: (key, selection) => {
                  const row = selection[0].start.row;
                  const id = users[row][0];
                  handleDelete(id);
                }
              }
            }
          }}
        />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h3 className="text-2xl font-bold mb-4">
              {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Usuario *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    disabled={editingUser}
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
                    Contraseña {editingUser ? '(dejar vacío para no cambiar)' : '*'}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="w-full border-2 rounded-lg px-3 py-2"
                    required={!editingUser}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Rol *</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
                    className="w-full border-2 rounded-lg px-3 py-2"
                    required
                  >
                    <option value="maestro">Maestro</option>
                    <option value="director">Director</option>
                    <option value="admin">Administrador</option>
                  </select>
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
                    value={formData.isActive}
                    onChange={e => setFormData({...formData, isActive: e.target.value === 'true'})}
                    className="w-full border-2 rounded-lg px-3 py-2"
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
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
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                >
                  {editingUser ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersManager;