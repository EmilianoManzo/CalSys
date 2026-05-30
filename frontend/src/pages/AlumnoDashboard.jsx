import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { gradeStyle } from '../theme';
import justoSierraLogo from '../assets/justo-sierra-logo.jpg';

function AlumnoDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState(1);
  const [materias, setMaterias] = useState([]);
  const [selectedMateria, setSelectedMateria] = useState('');
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [promedio, setPromedio] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMaterias, setLoadingMaterias] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const cargarMaterias = async () => {
      if (!user?.matricula) {
        setError('Usuario no autenticado');
        setLoadingMaterias(false);
        return;
      }
      try {
        const response = await api.get('/grades/student-subjects', {
          params: { matricula: user.matricula }
        });
        setMaterias(response.data.subjects || []);
        if (response.data.subjects && response.data.subjects.length > 0) {
          setSelectedMateria(response.data.subjects[0].subject_code);
        }
      } catch (error) {
        console.error(error);
        setError('Error al cargar materias: ' + (error.response?.data?.error || 'Error de conexión'));
      } finally {
        setLoadingMaterias(false);
      }
    };
    cargarMaterias();
  }, [user?.matricula]);

  const cargarParcial = useCallback(async (parcialId, subjectCode) => {
    setLoading(true);
    setError('');
    try {
      if (!user?.matricula) {
        setError('Usuario no autenticado');
        setLoading(false);
        return;
      }
      const response = await api.get('/grades/student-grades', {
        params: { matricula: user.matricula, parcialId, subjectCode }
      });
      const cols = response.data.columns || [];
      const grades = response.data.grades || [];
      const prom = response.data.promedio;
      setColumns(cols);
      setPromedio(prom);
      const gradesMap = {};
      grades.forEach(g => { gradesMap[g.columnName] = g.value; });
      const row = [user.matricula, `${user.firstName} ${user.lastName}`];
      cols.forEach(col => {
        const val = gradesMap[col.name];
        const parsedVal = val !== undefined && val !== null ? parseFloat(val) : NaN;
        row.push(!isNaN(parsedVal) ? parsedVal.toFixed(2) : '');
      });
      setData([row]);
    } catch (error) {
      console.error(error);
      setError('Error al cargar calificaciones del parcial: ' + (error.response?.data?.error || 'Error de conexión'));
    } finally {
      setLoading(false);
    }
  }, [user?.matricula, user?.firstName, user?.lastName]);

  const cargarFinal = useCallback(async (subjectCode) => {
    setLoading(true);
    setError('');
    try {
      if (!user?.matricula) {
        setError('Usuario no autenticado');
        setLoading(false);
        return;
      }
      const response = await api.get('/grades/student-final', {
        params: { matricula: user.matricula, subjectCode }
      });
      const cols = response.data.columns || [];
      const grades = response.data.grades || [];
      const prom = response.data.promedio;
      setColumns(cols);
      setPromedio(prom);
      const gradesMap = {};
      grades.forEach(g => { gradesMap[g.columnName] = g.value; });
      const row = [user.matricula, `${user.firstName} ${user.lastName}`];
      cols.forEach(col => {
        const val = gradesMap[col.name];
        const parsedVal = val !== undefined && val !== null ? parseFloat(val) : NaN;
        row.push(!isNaN(parsedVal) ? parsedVal.toFixed(2) : '');
      });
      setData([row]);
    } catch (error) {
      console.error(error);
      setError('Error al cargar calificación final: ' + (error.response?.data?.error || 'Error de conexión'));
    } finally {
      setLoading(false);
    }
  }, [user?.matricula, user?.firstName, user?.lastName]);

  const cargarAsistencia = useCallback(async (subjectCode) => {
    setLoading(true);
    setError('');
    try {
      if (!user?.matricula) {
        setError('Usuario no autenticado');
        setLoading(false);
        return;
      }
      const response = await api.get('/attendance/student', {
        params: { matricula: user.matricula, subjectCode }
      });
      setAttendanceData(response.data);
    } catch (error) {
      console.error(error);
      setError('Error al cargar asistencia: ' + (error.response?.data?.error || 'Error de conexión'));
    } finally {
      setLoading(false);
    }
  }, [user?.matricula]);

  useEffect(() => {
    if (selectedMateria && user?.matricula) {
      if (activeTab === 5) {
        cargarAsistencia(selectedMateria);
      } else if (activeTab === 4) {
        cargarFinal(selectedMateria);
      } else {
        cargarParcial(activeTab, selectedMateria);
      }
    }
  }, [activeTab, selectedMateria, user?.matricula, cargarParcial, cargarFinal, cargarAsistencia]);

  const tabs = [
    { id: 1, label: 'Parcial 1', icon: '📘' },
    { id: 2, label: 'Parcial 2', icon: '📗' },
    { id: 3, label: 'Parcial 3', icon: '📙' },
    { id: 4, label: 'Calificación Final', icon: '🎓' },
    { id: 5, label: 'Asistencia', icon: '📅' }
  ];

  const getGradeColor = (value) => {
    const style = gradeStyle(value);
    if (value !== '' && !isNaN(parseFloat(value))) {
      return { bg: style.soft.bg, text: style.soft.text };
    }
    return { bg: '', text: '' };
  };

  const renderTabContent = () => {
    if (loading) return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ marginBottom: '8px' }}>⏳</div>
        Cargando información...
      </div>
    );
    
    if (activeTab === 5) {
      if (!attendanceData || attendanceData.dates?.length === 0) {
        return (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', fontFamily: 'DM Sans, sans-serif' }}>
            No hay registros de asistencia para esta materia.
          </div>
        );
      }
      return (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{
              background: '#eff6ff',
              padding: '1rem',
              borderRadius: '12px',
              textAlign: 'center',
              border: '0.5px solid #dbeafe'
            }}>
              <p style={{ fontSize: '12px', color: '#4b5563', marginBottom: '4px' }}>Clases Totales</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: '#1e40af' }}>{attendanceData.summary?.total || 0}</p>
            </div>
            <div style={{
              background: '#f0fdf4',
              padding: '1rem',
              borderRadius: '12px',
              textAlign: 'center',
              border: '0.5px solid #dcfce7'
            }}>
              <p style={{ fontSize: '12px', color: '#4b5563', marginBottom: '4px' }}>Asistencias</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: '#166534' }}>{attendanceData.summary?.attended || 0}</p>
            </div>
            <div style={{
              background: '#f5f3ff',
              padding: '1rem',
              borderRadius: '12px',
              textAlign: 'center',
              border: '0.5px solid #ede9fe'
            }}>
              <p style={{ fontSize: '12px', color: '#4b5563', marginBottom: '4px' }}>Porcentaje</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: '#5b21b6' }}>{attendanceData.summary?.percentage || 0}%</p>
            </div>
          </div>
          
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <table style={{ width: '100%', backgroundColor: '#ffffff', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Fecha</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Asistió</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData.dates.map((d, idx) => (
                  <tr key={d.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '10px 16px', borderBottom: '0.5px solid #f0f0f0' }}>{d.date}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', borderBottom: '0.5px solid #f0f0f0' }}>
                      {d.present ? (
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>✔️ Sí</span>
                      ) : (
                        <span style={{ color: 'var(--error)', fontWeight: 600 }}>❌ No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (columns.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', fontFamily: 'DM Sans, sans-serif' }}>
          No hay actividades configuradas para esta evaluación.
        </div>
      );
    }

    return (
      <div>
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', backgroundColor: '#ffffff', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Matrícula</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Alumno</th>
                {columns.map(col => (
                  <th key={col.name} style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>
                    {col.name}{col.isSpecial ? ' ⭐' : ''}
                    <div style={{ fontSize: '10px', fontWeight: 400, color: '#6b7280', marginTop: '2px' }}>
                      ({col.weight}% / {col.maxValue})
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIdx) => (
                <tr key={rowIdx} style={{ backgroundColor: rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  {row.map((cell, cellIdx) => {
                    const gradeColor = cellIdx >= 2 ? getGradeColor(cell) : { bg: '', text: '' };
                    const isNumeric = cellIdx >= 2 && !isNaN(parseFloat(cell)) && cell !== '';
                    return (
                      <td 
                        key={cellIdx} 
                        style={{
                          padding: '10px 12px',
                          borderBottom: '0.5px solid #f0f0f0',
                          textAlign: cellIdx >= 2 ? 'center' : 'left',
                          fontWeight: cellIdx < 2 ? 500 : 'normal',
                          backgroundColor: gradeColor.bg,
                          color: gradeColor.text
                        }}
                      >
                        {cell !== '' ? cell : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem 1.5rem',
          background: '#f0f9ff',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderLeft: '4px solid #0284c7'
        }}>
          <p style={{ fontWeight: 600, color: '#0c4a6e' }}>
            {activeTab === 4 ? '🎯 Calificación Final Global:' : '📊 Calificación Final del Parcial:'}
          </p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#0284c7' }}>
            {promedio !== null ? promedio.toFixed(2) : 'N/A'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        fontFamily: 'DM Sans, sans-serif'
      }}>
        {/* Navbar */}
        <nav style={{
          background: '#880000',
          padding: '0 2rem',
          height: '56px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src={justoSierraLogo}
              alt="Justo Sierra"
              style={{ width: '26px', height: '26px', objectFit: 'cover', borderRadius: '50%', background: '#ffffff', boxShadow: '0 1px 5px rgba(0, 0, 0, 0.18)' }}
            />
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>Calsys · Alumno</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '13px', color: '#ffffff' }}>
              Hola, {user?.firstName} {user?.lastName}
            </span>
            <button 
              onClick={logout} 
              style={{
                background: '#ffffff',
                color: '#000000',
                border: 'none',
                borderRadius: '7px',
                padding: '7px 16px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.target.style.background = 'var(--text-secondary)'}
              onMouseLeave={e => e.target.style.background = '#ffffff'}
            >
              Salir
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '0.5px solid #e5e7eb',
            padding: '1.5rem',
            boxShadow: '0 4px 32px rgba(0, 0, 0, 0.04)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#111111', marginBottom: '1.5rem' }}>
              Mis Calificaciones
            </h2>

            {error && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '1.25rem',
                background: 'var(--error-bg)',
                border: '0.5px solid var(--error-border)',
                color: 'var(--error-text)'
              }}>
                {error}
              </div>
            )}

            {!error && !materias.length && !loadingMaterias && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '1.25rem',
                background: 'var(--warning-bg)',
                border: '0.5px solid #f59e0b',
                color: 'var(--warning-text)'
              }}>
                No tienes materias asignadas.
              </div>
            )}

            {/* Selector de materia */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 500,
                color: '#9ca3af',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: '6px'
              }}>
                Materia
              </label>
              {loadingMaterias ? (
                <p style={{ fontSize: '13px', color: '#6b7280' }}>Cargando materias...</p>
              ) : (
                <select
                  value={selectedMateria}
                  onChange={(e) => setSelectedMateria(e.target.value)}
                  disabled={!materias.length}
                  style={{
                    width: '100%',
                    maxWidth: '300px',
                    background: '#fafafa',
                    border: '0.5px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '13px',
                    color: '#111111',
                    fontFamily: 'DM Sans, sans-serif',
                    outline: 'none',
                    cursor: materias.length ? 'pointer' : 'not-allowed',
                    transition: 'border-color 0.2s, background 0.2s'
                  }}
                >
                  {materias.map(m => (
                    <option key={m.subject_code} value={m.subject_code}>
                      {m.subject_code} - {m.semester_code}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Tabs */}
            <div style={{
              borderBottom: '0.5px solid #e5e7eb',
              marginBottom: '1.5rem'
            }}>
              <nav style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '8px 8px 0 0',
                      fontSize: '13px',
                      fontWeight: 500,
                      fontFamily: 'DM Sans, sans-serif',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: activeTab === tab.id ? '#880000' : '#f3f4f6',
                      color: activeTab === tab.id ? '#ffffff' : '#4b5563'
                    }}
                    onMouseEnter={e => {
                      if (activeTab !== tab.id) {
                        e.target.style.background = '#e5e7eb';
                      }
                    }}
                    onMouseLeave={e => {
                      if (activeTab !== tab.id) {
                        e.target.style.background = '#f3f4f6';
                      }
                    }}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            {renderTabContent()}
          </div>
        </div>
      </div>
    </>
  );
}

export default AlumnoDashboard;
