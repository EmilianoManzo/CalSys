import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api/axios';
import { useIsMobile } from '../hooks/useIsMobile';

function AttendanceTable({ semester, subject, group, teacherId }) {
  const [dates, setDates] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedDateId, setSelectedDateId] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [lastChange, setLastChange] = useState(null);
  const [dragStartX, setDragStartX] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const isMobile = useIsMobile();

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/attendance/records', {
        params: { teacherId, semester, subject, group }
      });
      const nextDates = response.data.dates || [];
      setDates(nextDates);
      setRecords(response.data.records || []);
      setSelectedDateId(prev => nextDates.some(d => String(d.id) === String(prev)) ? prev : nextDates[0]?.id || '');
      setActiveIndex(0);
      setLastChange(null);
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

  useEffect(() => {
    setActiveIndex(0);
    setLastChange(null);
  }, [selectedDateId]);

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
    if (!confirm('Seguro que deseas eliminar esta fecha y todas sus asistencias?')) return;
    try {
      await api.delete(`/attendance/dates/${id}`);
      loadAttendance();
    } catch {
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

  const setAttendanceValue = (matricula, dateId, isPresent, advance = false) => {
    setRecords(prev => prev.map(row => {
      if (row.matricula !== matricula) return row;
      const key = `date_${dateId}`;
      setLastChange({ matricula, dateId, previousValue: !!row[key], index: activeIndex });
      return { ...row, [key]: isPresent };
    }));
    if (advance) setActiveIndex(prev => Math.min(prev + 1, records.length));
  };

  const handleUndo = () => {
    if (!lastChange) return;
    setRecords(prev => prev.map(row => {
      if (row.matricula !== lastChange.matricula) return row;
      return { ...row, [`date_${lastChange.dateId}`]: lastChange.previousValue };
    }));
    setActiveIndex(lastChange.index);
    setLastChange(null);
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
    } catch {
      alert('Error al guardar asistencias');
    } finally {
      setSaving(false);
    }
  };

  const selectedDate = dates.find(d => String(d.id) === String(selectedDateId));
  const activeStudent = records[activeIndex];
  const attendanceSummary = useMemo(() => {
    if (!selectedDateId) return { present: 0, absent: 0 };
    return records.reduce((acc, row) => {
      if (row[`date_${selectedDateId}`]) acc.present += 1;
      else acc.absent += 1;
      return acc;
    }, { present: 0, absent: 0 });
  }, [records, selectedDateId]);

  const completeCount = Math.min(activeIndex, records.length);
  const dragIntent = dragOffset > 70 ? 'absent' : dragOffset < -70 ? 'present' : '';

  const styles = {
    container: { fontFamily: 'DM Sans, sans-serif' },
    header: { marginBottom: '1.5rem', backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '12px', border: '0.5px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' },
    form: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' },
    label: { fontSize: '13px', fontWeight: 500, color: '#374151' },
    input: { border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' },
    addBtn: { background: 'var(--brand)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' },
    saveBtn: { background: 'var(--brand)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 24px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' },
    table: { width: '100%', backgroundColor: '#ffffff', border: '0.5px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', fontSize: '13px' },
    th: { borderBottom: '0.5px solid #e5e7eb', padding: '12px 8px', textAlign: 'left', backgroundColor: '#f9fafb', fontWeight: 600, color: '#374151' },
    td: { borderBottom: '0.5px solid #e5e7eb', padding: '10px 8px' },
    stickyLeft: { position: 'sticky', left: 0, backgroundColor: '#ffffff', zIndex: 10 },
    emptyState: { textAlign: 'center', padding: '2rem', color: '#9ca3af' }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', fontFamily: 'DM Sans, sans-serif', color: '#6b7280' }}>Cargando asistencia...</div>;

  return (
    <>
      <style>{`
        .attendance-mobile-shell {
          display: grid;
          gap: 14px;
          padding-bottom: 88px;
        }

        .attendance-mobile-datebar,
        .attendance-mobile-summary,
        .attendance-mobile-card,
        .attendance-mobile-empty {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(17, 24, 39, 0.06);
        }

        .attendance-mobile-datebar {
          padding: 14px;
          display: grid;
          gap: 12px;
        }

        .attendance-mobile-datebar form,
        .attendance-mobile-date-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .attendance-mobile-datebar input,
        .attendance-mobile-datebar select {
          min-height: 42px;
          min-width: 0;
          flex: 1;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 0 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
        }

        .attendance-mobile-datebar button,
        .attendance-mobile-actions button,
        .attendance-mobile-save button {
          min-height: 42px;
          border: none;
          border-radius: 8px;
          padding: 0 14px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .attendance-mobile-datebar button,
        .attendance-mobile-save button {
          background: var(--brand);
          color: #ffffff;
        }

        .attendance-mobile-delete {
          background: #fee2e2 !important;
          color: #991b1b !important;
        }

        .attendance-mobile-summary {
          padding: 14px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          text-align: center;
        }

        .attendance-mobile-summary strong {
          display: block;
          color: #111827;
          font-size: 18px;
        }

        .attendance-mobile-summary span {
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .attendance-mobile-card {
          min-height: 260px;
          padding: 22px;
          display: grid;
          align-content: center;
          justify-items: center;
          gap: 12px;
          text-align: center;
          touch-action: pan-y;
          transition: border-color 0.15s, transform 0.15s;
          user-select: none;
        }

        .attendance-mobile-card.present {
          border-color: #16a34a;
        }

        .attendance-mobile-card.absent {
          border-color: #dc2626;
        }

        .attendance-avatar {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #f3f4f6;
          color: var(--brand);
          font-size: 24px;
          font-weight: 800;
        }

        .attendance-student-name {
          color: #111827;
          font-size: 20px;
          font-weight: 800;
          line-height: 1.2;
        }

        .attendance-student-id {
          color: #6b7280;
          font-size: 13px;
          font-weight: 700;
        }

        .attendance-mobile-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .attendance-mobile-actions .present-btn {
          background: #dcfce7;
          color: #166534;
        }

        .attendance-mobile-actions .absent-btn {
          background: #fee2e2;
          color: #991b1b;
        }

        .attendance-mobile-save {
          position: fixed;
          left: 12px;
          right: 12px;
          bottom: 12px;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          background: #111827;
          color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 12px 32px rgba(17, 24, 39, 0.22);
        }

        .attendance-mobile-save span {
          display: block;
          color: #d1d5db;
          font-size: 12px;
        }

        .attendance-mobile-empty {
          padding: 28px 18px;
          text-align: center;
          color: #6b7280;
          font-size: 14px;
        }
      `}</style>

      <div style={styles.container}>
        {isMobile ? (
          <div className="attendance-mobile-shell">
            <div className="attendance-mobile-datebar">
              <form onSubmit={handleAddDate}>
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  aria-label="Nueva fecha de clase"
                />
                <button type="submit">Anadir</button>
              </form>

              {dates.length > 0 && (
                <div className="attendance-mobile-date-row">
                  <select value={selectedDateId} onChange={e => setSelectedDateId(e.target.value)} aria-label="Fecha de asistencia">
                    {dates.map(d => (
                      <option key={d.id} value={d.id}>{d.class_date}</option>
                    ))}
                  </select>
                  <button className="attendance-mobile-delete" type="button" onClick={() => handleDeleteDate(selectedDateId)}>
                    Eliminar
                  </button>
                </div>
              )}
            </div>

            {dates.length === 0 ? (
              <div className="attendance-mobile-empty">
                No hay fechas registradas. Anade una fecha para comenzar a tomar asistencia.
              </div>
            ) : records.length === 0 ? (
              <div className="attendance-mobile-empty">No hay alumnos cargados para esta clase.</div>
            ) : (
              <>
                <div className="attendance-mobile-summary">
                  <div><strong>{completeCount}/{records.length}</strong><span>Avance</span></div>
                  <div><strong>{attendanceSummary.present}</strong><span>Presentes</span></div>
                  <div><strong>{attendanceSummary.absent}</strong><span>Ausentes</span></div>
                </div>

                {activeStudent ? (
                  <>
                    <article
                      className={`attendance-mobile-card ${dragIntent}`}
                      style={{ transform: `translateX(${dragOffset}px) rotate(${dragOffset / 24}deg)` }}
                      onPointerDown={(e) => setDragStartX(e.clientX)}
                      onPointerMove={(e) => {
                        if (dragStartX === null) return;
                        setDragOffset(Math.max(-120, Math.min(120, e.clientX - dragStartX)));
                      }}
                      onPointerUp={() => {
                        if (dragOffset < -70) setAttendanceValue(activeStudent.matricula, selectedDateId, true, true);
                        if (dragOffset > 70) setAttendanceValue(activeStudent.matricula, selectedDateId, false, true);
                        setDragStartX(null);
                        setDragOffset(0);
                      }}
                    >
                      <div className="attendance-avatar">
                        {(activeStudent.nombre || 'A').split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase()}
                      </div>
                      <div>
                        <div className="attendance-student-name">{activeStudent.nombre}</div>
                        <div className="attendance-student-id">{activeStudent.matricula}</div>
                      </div>
                      <div className="attendance-student-id">
                        {selectedDate?.class_date} - {activeStudent[`date_${selectedDateId}`] ? 'Presente' : 'Ausente'}
                      </div>
                    </article>

                    <div className="attendance-mobile-actions">
                      <button
                        className="present-btn"
                        type="button"
                        onClick={() => setAttendanceValue(activeStudent.matricula, selectedDateId, true, true)}
                      >
                        Presente
                      </button>
                      <button
                        className="absent-btn"
                        type="button"
                        onClick={() => setAttendanceValue(activeStudent.matricula, selectedDateId, false, true)}
                      >
                        Ausente
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="attendance-mobile-empty">Asistencia lista para guardar.</div>
                )}

                {lastChange && (
                  <button type="button" style={{ ...styles.addBtn, background: '#f3f4f6', color: '#374151' }} onClick={handleUndo}>
                    Deshacer
                  </button>
                )}

                <div className="attendance-mobile-save">
                  <div>
                    <strong>Asistencia</strong>
                    <span>{selectedDate?.class_date || 'Sin fecha seleccionada'}</span>
                  </div>
                  <button type="button" onClick={handleSave} disabled={saving || dates.length === 0}>
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
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
                              style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '11px' }}
                              title="Eliminar fecha"
                            >
                              x
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
                              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--brand)' }}
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
          </>
        )}
      </div>
    </>
  );
}

export default AttendanceTable;
