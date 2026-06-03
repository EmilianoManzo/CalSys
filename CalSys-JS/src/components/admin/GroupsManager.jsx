import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../../api/axios';

registerAllModules();

function GroupsManager() {
  const [groups, setGroups] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [managingGroup, setManagingGroup] = useState(null);
  const [selectedMatriculas, setSelectedMatriculas] = useState([]);
  const [formData, setFormData] = useState({ groupCode: '', name: '', description: '', isActive: true });
  const hotRef = useRef(null);
  const groupsRawRef = useRef([]);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [groupsRes, studentsRes] = await Promise.all([
        api.get('/admin/student-groups'),
        api.get('/admin/students')
      ]);
      groupsRawRef.current = groupsRes.data.groups || [];
      const data = groupsRawRef.current.map(g => [
        g.id,
        g.group_code,
        g.name,
        g.member_count || 0,
        g.is_active ? 'Activo' : 'Inactivo'
      ]);
      setGroups(data);
      setAllStudents((studentsRes.data.students || []).filter(s => s.status === 'active'));
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || 'Error al cargar grupos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingGroup) {
        await api.put(`/admin/student-groups/${editingGroup}`, {
          name: formData.name,
          description: formData.description,
          isActive: formData.isActive
        });
      } else {
        await api.post('/admin/student-groups', {
          groupCode: formData.groupCode,
          name: formData.name,
          description: formData.description
        });
      }
      setShowModal(false);
      resetForm();
      cargarDatos();
    } catch (error) {
      alert(error.response?.data?.error || 'Error');
    }
  };

  const handleEdit = (id) => {
    const group = groupsRawRef.current.find(g => g.id === id);
    if (group) {
      setFormData({
        groupCode: group.group_code,
        name: group.name,
        description: group.description || '',
        isActive: !!group.is_active
      });
      setEditingGroup(id);
      setShowModal(true);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Desactivar este grupo? Los alumnos quedarán sin grupo asignado.')) return;
    try {
      await api.delete(`/admin/student-groups/${id}`);
      cargarDatos();
    } catch (error) {
      alert(error.response?.data?.error || 'Error');
    }
  };

  const openMembers = (id) => {
    const group = groupsRawRef.current.find(g => g.id === id);
    if (!group) return;
    const members = allStudents.filter(s => s.group_id === id).map(s => s.matricula);
    setManagingGroup(group);
    setSelectedMatriculas(members);
    setShowMembersModal(true);
  };

  const toggleMatricula = (matricula) => {
    setSelectedMatriculas(prev =>
      prev.includes(matricula) ? prev.filter(m => m !== matricula) : [...prev, matricula]
    );
  };

  const saveMembers = async () => {
    try {
      await api.put(`/admin/student-groups/${managingGroup.id}/members`, {
        matriculas: selectedMatriculas
      });
      alert('Alumnos actualizados');
      setShowMembersModal(false);
      setManagingGroup(null);
      cargarDatos();
    } catch (error) {
      alert(error.response?.data?.error || 'Error');
    }
  };

  const resetForm = () => {
    setFormData({ groupCode: '', name: '', description: '', isActive: true });
    setEditingGroup(null);
  };

  const columns = [
    { data: 0, title: 'ID', readOnly: true, width: 50 },
    { data: 1, title: 'Código', readOnly: true, width: 100 },
    { data: 2, title: 'Nombre', readOnly: true, width: 200 },
    { data: 3, title: 'Alumnos', readOnly: true, width: 90 },
    { data: 4, title: 'Estado', readOnly: true, width: 90 }
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Cargando...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#111111' }}>Grupos de estudiantes</h2>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          style={{ background: 'var(--brand)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
        >
          + Nuevo grupo
        </button>
      </div>

      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '1rem' }}>
        Cada alumno puede pertenecer a un solo grupo. Al asignar materias, solo se inscriben los alumnos del grupo seleccionado.
        Cambiar el grupo de un alumno no actualiza inscripciones ya existentes.
      </p>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem' }}>
        <HotTable
          ref={hotRef}
          data={groups}
          columns={columns}
          colHeaders={true}
          rowHeaders={true}
          width="100%"
          height="400"
          licenseKey="non-commercial-and-evaluation"
          stretchH="all"
          filters={true}
          dropdownMenu={true}
          columnSorting={true}
          contextMenu={{
            items: {
              edit: { name: 'Editar', callback: (key, sel) => handleEdit(groups[sel[0].start.row][0]) },
              members: { name: 'Gestionar alumnos', callback: (key, sel) => openMembers(groups[sel[0].start.row][0]) },
              delete: { name: 'Desactivar', callback: (key, sel) => handleDelete(groups[sel[0].start.row][0]) }
            }
          }}
        />
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.5rem', maxWidth: '480px', width: '90%' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '1rem' }}>{editingGroup ? 'Editar grupo' : 'Nuevo grupo'}</h3>
            <form onSubmit={handleSubmit}>
              {!editingGroup && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Código *</label>
                  <input
                    type="text"
                    value={formData.groupCode}
                    onChange={e => setFormData({ ...formData, groupCode: e.target.value.toUpperCase() })}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}
                    required
                    maxLength={20}
                  />
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Nombre *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}
                  rows="2"
                />
              </div>
              {editingGroup && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Estado</label>
                  <select
                    value={formData.isActive ? 'active' : 'inactive'}
                    onChange={e => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1rem' }}>
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} style={{ padding: '8px 20px', border: '0.5px solid #e5e7eb', borderRadius: '8px', background: '#ffffff', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 24px', border: 'none', borderRadius: '8px', background: 'var(--brand)', color: '#ffffff', cursor: 'pointer' }}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMembersModal && managingGroup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.5rem', maxWidth: '560px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '0.5rem' }}>
              Alumnos — {managingGroup.group_code} ({managingGroup.name})
            </h3>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '1rem' }}>
              Marque los alumnos que pertenecen a este grupo.
            </p>
            <div style={{ flex: 1, overflowY: 'auto', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px' }}>
              {allStudents.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '13px' }}>No hay alumnos activos</p>
              ) : (
                allStudents.map(s => (
                  <label key={s.matricula} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedMatriculas.includes(s.matricula)}
                      onChange={() => toggleMatricula(s.matricula)}
                    />
                    <span>{s.matricula} — {s.first_name} {s.last_name}</span>
                    {s.group_id && s.group_id !== managingGroup.id && (
                      <span style={{ fontSize: '11px', color: '#b45309' }}>(en otro grupo)</span>
                    )}
                  </label>
                ))
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1rem' }}>
              <button type="button" onClick={() => { setShowMembersModal(false); setManagingGroup(null); }} style={{ padding: '8px 20px', border: '0.5px solid #e5e7eb', borderRadius: '8px', background: '#ffffff', cursor: 'pointer' }}>Cancelar</button>
              <button type="button" onClick={saveMembers} style={{ padding: '8px 24px', border: 'none', borderRadius: '8px', background: 'var(--brand)', color: '#ffffff', cursor: 'pointer' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupsManager;
