import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

function AttendanceTable({ semester, subject, group, teacherId }) {
  const [dates, setDates] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/attendance/records', {
        params: { teacherId, semester, subject, group }
      });
      setDates(response.data.dates || []);
      setRecords(response.data.records || []);
    } catch (error) {
      console.error(error);
      alert('Error cargando asistencias');
    } finally {
      setLoading(false);
    }
  }, [teacherId, semester, subject, group]);

  useEffect(() => {
    if (subject) loadAttendance();
  }, [subject, loadAttendance]);

  const handleAddDate = async (e) => {
    e.preventDefault();
    if (!newDate) return;
    try {
      await api.post('/attendance/dates', {
        teacherId, semester, subject, group, date: newDate
      });
      setNewDate('');
      loadAttendance();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al agregar fecha');
    }
  };

  const handleDeleteDate = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar esta fecha y todas sus asistencias?')) return;
    try {
      await api.delete(`/attendance/dates/${id}`);
      loadAttendance();
    } catch (error) {
      alert('Error al eliminar fecha');
    }
  };

  const handleToggle = (matricula, dateId) => {
    setRecords(prev => prev.map(row => {
      if (row.matricula === matricula) {
        return { ...row, [`date_${dateId}`]: !row[`date_${dateId}`] };
      }
      return row;
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [];
      records.forEach(row => {
        dates.forEach(d => {
          updates.push({
            matricula: row.matricula,
            dateId: d.id,
            isPresent: row[`date_${d.id}`] ? true : false
          });
        });
      });
      await api.post('/attendance/records', { updates });
      alert('Asistencias guardadas correctamente');
      loadAttendance();
    } catch (error) {
      alert('Error al guardar asistencias');
    } finally {
      setSaving(false);
    }
  };

  const styles = {
    container: { fontFamily: 'DM Sans, sans-serif' },
    header: { marginBottom: '1.5rem', backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '12px', border: '0.5px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' },
    form: { display: 'flex', gap: '0.5rem', alignItems: 'center' },
    label: { fontSize: '13px', fontWeight: 500, color: '#374151' },
    input: { border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' },
    addBtn: { background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' },
    saveBtn: { background: '#880000', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 24px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' },
    table: { width: '100%', backgroundColor: '#ffffff', border: '0.5px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', fontSize: '13px' },
    th: { borderBottom: '0.5px solid #e5e7eb', padding: '12px 8px', textAlign: 'left', backgroundColor: '#f9fafb', fontWeight: 600, color: '#374151' },
    td: { borderBottom: '0.5px solid #e5e7eb', padding: '10px 8px' },
    stickyLeft: { position: 'sticky', left: 0, backgroundColor: '#ffffff', zIndex: 10 },
    emptyState: { textAlign: 'center', padding: '2rem', color: '#9ca3af' }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', fontFamily: 'DM Sans, sans-serif', color: '#6b7280' }}>Cargando asistencia...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <form onSubmit={handleAddDate} style={styles.form}>
          <label style={styles.label}>Nueva fecha de clase:</label>
          <input 
            type="date" 
            value={newDate} 
            onChange={e => setNewDate(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.addBtn}>
            Añadir
          </button>
        </form>
        <button 
          onClick={handleSave} 
          disabled={saving || dates.length === 0}
          style={{ ...styles.saveBtn, opacity: (saving || dates.length === 0) ? 0.5 : 1 }}
        >
          {saving ? 'Guardando...' : 'Guardar Asistencias'}
        </button>
      </div>

      {dates.length === 0 ? (
        <div style={styles.emptyState}>
          No hay fechas registradas. Añade una fecha para comenzar a tomar asistencia.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.stickyLeft, left: 0, minWidth: '100px' }}>Matrícula</th>
                <th style={{ ...styles.th, ...styles.stickyLeft, left: '100px', minWidth: '200px' }}>Alumno</th>
                {dates.map(d => (
                  <th key={d.id} style={{ ...styles.th, textAlign: 'center', minWidth: '100px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <span>{d.class_date}</span>
                      <button 
                        onClick={() => handleDeleteDate(d.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}
                        title="Eliminar fecha"
                      >
                        ✕
                      </button>
                    </div>
                  </th>
                ))}
                <th style={{ ...styles.th, textAlign: 'center', backgroundColor: '#fef3c7', fontWeight: 700 }}>% Final</th>
              </tr>
            </thead>
            <tbody>
              {records.map((row, idx) => (
                <tr key={row.matricula} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ ...styles.td, ...styles.stickyLeft, left: 0, fontWeight: 500 }}>{row.matricula}</td>
                  <td style={{ ...styles.td, ...styles.stickyLeft, left: '100px' }}>{row.nombre}</td>
                  {dates.map(d => (
                    <td key={d.id} style={{ ...styles.td, textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={row[`date_${d.id}`] || false}
                        onChange={() => handleToggle(row.matricula, d.id)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#880000' }}
                      />
                    </td>
                  ))}
                  <td style={{ ...styles.td, textAlign: 'center', fontWeight: 700, backgroundColor: '#fef3c7' }}>
                    {row.percentage}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AttendanceTable;