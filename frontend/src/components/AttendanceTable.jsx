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

  if (loading) return <div className="text-center py-8">Cargando asistencia...</div>;

  return (
    <div>
      <div className="mb-6 bg-gray-50 p-4 rounded border flex justify-between items-center">
        <form onSubmit={handleAddDate} className="flex gap-2 items-center">
          <label className="text-sm font-medium">Nueva fecha de clase:</label>
          <input 
            type="date" 
            value={newDate} 
            onChange={e => setNewDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
          <button type="submit" className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
            Añadir
          </button>
        </form>
        <button 
          onClick={handleSave} 
          disabled={saving || dates.length === 0}
          className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 disabled:bg-gray-400"
        >
          {saving ? 'Guardando...' : 'Guardar Asistencias'}
        </button>
      </div>

      {dates.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No hay fechas registradas. Añade una fecha para comenzar a tomar asistencia.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded-lg overflow-hidden text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-4 py-2 text-left sticky left-0 bg-gray-100 z-10 w-32">Matrícula</th>
                <th className="border px-4 py-2 text-left sticky left-32 bg-gray-100 z-10 w-64">Alumno</th>
                {dates.map(d => (
                  <th key={d.id} className="border px-2 py-2 text-center min-w-[100px]">
                    <div className="flex flex-col items-center gap-1">
                      <span>{d.class_date}</span>
                      <button 
                        onClick={() => handleDeleteDate(d.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                        title="Eliminar fecha"
                      >
                        ✕
                      </button>
                    </div>
                  </th>
                ))}
                <th className="border px-4 py-2 text-center bg-blue-50 font-bold">% Final</th>
              </tr>
            </thead>
            <tbody>
              {records.map((row, idx) => (
                <tr key={row.matricula} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border px-4 py-2 sticky left-0 z-10 font-medium" style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    {row.matricula}
                  </td>
                  <td className="border px-4 py-2 sticky left-32 z-10" style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    {row.nombre}
                  </td>
                  {dates.map(d => (
                    <td key={d.id} className="border px-2 py-2 text-center">
                      <input 
                        type="checkbox" 
                        checked={row[`date_${d.id}`] || false}
                        onChange={() => handleToggle(row.matricula, d.id)}
                        className="w-5 h-5 cursor-pointer accent-blue-600"
                      />
                    </td>
                  ))}
                  <td className="border px-4 py-2 text-center font-bold bg-blue-50">
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
