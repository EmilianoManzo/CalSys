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
    username: '', firstName: '', lastName: '', email: '', password: '', role: 'maestro', phone: '', isActive: true
  });
  const hotRef = useRef(null);

  useEffect(() => { cargarUsuarios(); }, []);

  const cargarUsuarios = async () => {
    try {
      const response = await api.get('/admin/users');
      const data = response.data.users.map(u => [
        u.id, u.username, u.first_name, u.last_name, u.email,
        u.role === 'maestro' ? '👨‍🏫 Maestro' : u.role === 'admin' ? '👑 Admin' : '📋 Director',
        u.is_active ? 'Activo' : 'Inactivo'
      ]);
      setUsers(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) await api.put(`/admin/users/${editingUser}`, formData);
      else await api.post('/admin/users', formData);
      alert(editingUser ? 'Usuario actualizado' : 'Usuario creado');
      setShowModal(false); resetForm(); cargarUsuarios();
    } catch (error) { alert(error.response?.data?.error || 'Error'); }
  };

  const handleEdit = (id) => {
    api.get('/admin/users').then(response => {
      const user = response.data.users.find(u => u.id === id);
      if (user) {
        setFormData({
          username: user.username, firstName: user.first_name, lastName: user.last_name,
          email: user.email, password: '', role: user.role, phone: user.phone || '', isActive: user.is_active
        });
        setEditingUser(id); setShowModal(true);
      }
    });
  };

  const handleDeactivate = async (id) => {
    if (!confirm('¿Desactivar este usuario/maestro? No podrá iniciar sesión, pero su cuenta se conserva.')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      alert('Usuario desactivado');
      cargarUsuarios();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al desactivar');
    }
  };

  const handlePermanentDelete = async (id) => {
    if (!confirm('¿BORRAR PERMANENTEMENTE este usuario?\n\nSe eliminarán sus asignaciones, calificaciones y la cuenta. No se puede deshacer.')) return;
    if (!confirm('Confirme de nuevo: eliminar permanentemente el usuario ID ' + id)) return;
    try {
      await api.delete(`/admin/users/${id}?permanent=true`);
      alert('Usuario eliminado permanentemente');
      cargarUsuarios();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al borrar');
    }
  };

  const resetForm = () => {
    setFormData({ username: '', firstName: '', lastName: '', email: '', password: '', role: 'maestro', phone: '', isActive: true });
    setEditingUser(null);
  };

  const columns = [
    { data: 0, title: 'ID', readOnly: true, width: 60 },
    { data: 1, title: 'Usuario', readOnly: true, width: 120 },
    { data: 2, title: 'Nombre', readOnly: true, width: 150 },
    { data: 3, title: 'Apellido', readOnly: true, width: 150 },
    { data: 4, title: 'Email', readOnly: true, width: 200 },
    { data: 5, title: 'Rol', readOnly: true, width: 120 },
    { data: 6, title: 'Estado', readOnly: true, width: 100 }
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Cargando...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#111111' }}>Gestión de usuarios y maestros</h2>
        <button onClick={() => { resetForm(); setShowModal(true); }} style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>+ Agregar Usuario</button>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem' }}>
        <HotTable ref={hotRef} data={users} columns={columns} colHeaders={true} rowHeaders={true} width="100%" height="500"
          licenseKey="non-commercial-and-evaluation" stretchH="all" filters={true} dropdownMenu={true} columnSorting={true}
          contextMenu={{
            items: {
              edit: { name: 'Editar', callback: (key, sel) => handleEdit(users[sel[0].start.row][0]) },
              deactivate: { name: 'Desactivar usuario', callback: (key, sel) => handleDeactivate(users[sel[0].start.row][0]) },
              permanent: { name: 'Borrar permanentemente', callback: (key, sel) => handlePermanentDelete(users[sel[0].start.row][0]) }
            }
          }}
        />
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>Clic derecho: editar, desactivar o borrar permanentemente (maestros y staff).</p>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.5rem', maxWidth: '700px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '1rem' }}>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Usuario *</label>
                  <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} disabled={editingUser}
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
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Contraseña {!editingUser && '*'}</label>
                  <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required={!editingUser} /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Rol *</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
                    <option value="maestro">Maestro</option><option value="director">Director</option><option value="admin">Administrador</option>
                  </select></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Teléfono</label>
                  <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Estado</label>
                  <select value={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.value === 'true'})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
                    <option value="true">Activo</option><option value="false">Inactivo</option>
                  </select></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} style={{ padding: '8px 20px', border: '0.5px solid #e5e7eb', borderRadius: '8px', background: '#ffffff', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 24px', border: 'none', borderRadius: '8px', background: '#10b981', color: '#ffffff', cursor: 'pointer' }}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersManager;