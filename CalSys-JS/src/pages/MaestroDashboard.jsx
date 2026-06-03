import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import PartialManager from '../components/PartialManager';
import api from '../api/axios';
import justoSierraLogo from '../assets/justo-sierra-logo.jpg';

function MaestroDashboard() {
  const { user, logout } = useAuth();
  const [semester, setSemester] = useState('2025-1');
  const [subject, setSubject] = useState('');
  const [group, setGroup] = useState('');
  const [subjectsList, setSubjectsList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.id) loadTeacherSubjects();
  }, [user, semester]);

  const loadTeacherSubjects = async () => {
    setLoading(true);
    setError('');
    try {
      if (!user?.id) { setError('Usuario no autenticado'); setLoading(false); return; }
      const response = await api.get('/grades/teacher/subjects', {
        params: { teacherId: user.id, semester }
      });
      if (response.data.subjects?.length) {
        setSubjectsList(response.data.subjects);
        const first = response.data.subjects[0];
        setSubject(first.subject_code);
        setGroup(first.group_code || '');
        if (first.subject_code) loadGroups(first.subject_code);
      } else {
        setSubjectsList([]);
        setSubject('');
        setGroup('');
      }
    } catch (err) {
      setError('Error al cargar materias: ' + (err.response?.data?.error || 'Error de conexión'));
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async (subjectCode) => {
    try {
      if (!user?.id) { setError('Usuario no autenticado'); return; }
      const response = await api.get('/grades/subject/groups', {
        params: { teacherId: user.id, semester, subjectCode }
      });
      setGroupsList(response.data.groups || []);
    } catch (err) {
      setError('Error al cargar grupos: ' + (err.response?.data?.error || 'Error de conexión'));
    }
  };

  const handleSubjectChange = async (e) => {
    const newSubject = e.target.value;
    setSubject(newSubject);
    const subjectData = subjectsList.find(s => s.subject_code === newSubject);
    setGroup(subjectData?.group_code || '');
    await loadGroups(newSubject);
  };

  if (loading) return (
    <div className="maestro-loading">Cargando materias...</div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .maestro-loading {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f5f5;
          font-family: 'DM Sans', sans-serif;
          color: #6b7280;
          font-size: 14px;
        }

        .maestro-wrapper {
          min-height: 100vh;
          background: #f5f5f5;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
        }

        .maestro-nav {
          background: #880000;
          border-bottom: 0.5px solid #e5e7eb;
          padding: 0 2rem;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .maestro-nav-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .maestro-nav-dot {
          width: 26px;
          height: 26px;
          background: #ffffff;
          border-radius: 50%;
          object-fit: cover;
          display: block;
          box-shadow: 0 1px 5px rgba(0, 0, 0, 0.18);
        }

        .maestro-nav-title {
          font-size: 15px;
          font-weight: 600;
          color: #ffffff;
        }

        .maestro-nav-right {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .maestro-nav-user {
          font-size: 13px;
          color: #ffffff;
        }

        .maestro-nav-btn {
          background: #ffffff;
          color: black;
          border: none;
          border-radius: 7px;
          padding: 7px 16px;
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .maestro-nav-btn:hover {
          background: var(--text-secondary);
        }

        .maestro-main-content {
          flex: 1;
          padding: 1.5rem;
          overflow-y: auto;
        }

        .maestro-filters-card {
          background: #ffffff;
          border: 0.5px solid #e5e7eb;
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 4px 32px rgba(0, 0, 0, 0.04);
        }

        .maestro-filters-title {
          font-size: 18px;
          font-weight: 500;
          color: #111111;
          margin-bottom: 1.5rem;
        }

        .maestro-alert {
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 1.25rem;
        }

        .maestro-alert-error {
          background: var(--error-bg);
          border: 0.5px solid var(--error-border);
          color: var(--error-text);
        }

        .maestro-alert-warning {
          background: var(--warning-bg);
          border: 0.5px solid #f59e0b;
          color: var(--warning-text);
        }

        .maestro-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }

        .maestro-field label {
          display: block;
          font-size: 11px;
          font-weight: 500;
          color: #9ca3af;
          letter-spacing: 0.06em; 
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .maestro-select {
          width: 100%;
          background: #fafafa;
          border: 0.5px solid #e5e7eb;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 13px;
          color: #111111;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          appearance: none;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
        }

        .maestro-select:focus {
          border-color: var(--brand);
          background: #ffffff;
        }

        .maestro-select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .maestro-partial-container {
          background: #ffffff;
          border: 0.5px solid #e5e7eb;
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 4px 32px rgba(0, 0, 0, 0.04);
        }

        .maestro-partial-container > * {
          width: 100%;
        }
      `}</style>

      <div className="maestro-wrapper">
        <nav className="maestro-nav">
          <div className="maestro-nav-left">
            <img className="maestro-nav-dot" src={justoSierraLogo} alt="Justo Sierra" />
            <span className="maestro-nav-title">Calsys · Maestro</span>
          </div>
          <div className="maestro-nav-right">
            <span className="maestro-nav-user">
              Hola, {user?.firstName} {user?.lastName}
            </span>
            <button className="maestro-nav-btn" onClick={logout}>Salir</button>
          </div>
        </nav>

        <div className="maestro-main-content">
          <div className="maestro-filters-card">
            <p className="maestro-filters-title">Captura de Calificaciones</p>

            {error && (
              <div className="maestro-alert maestro-alert-error">{error}</div>
            )}
            {!error && !subjectsList.length && (
              <div className="maestro-alert maestro-alert-warning">
                No tienes materias asignadas para este semestre.
              </div>
            )}

            <div className="maestro-grid">
              <div className="maestro-field">
                <label>Semestre</label>
                <select
                  value={semester}
                  onChange={e => setSemester(e.target.value)}
                  className="maestro-select"
                >
                  <option value="2025-1">2025-1</option>
                  <option value="2024-2">2024-2</option>
                  <option value="2024-1">2024-1</option>
                </select>
              </div>

              <div className="maestro-field">
                <label>Materia</label>
                <select
                  value={subject}
                  onChange={handleSubjectChange}
                  className="maestro-select"
                  disabled={!subjectsList.length}
                >
                  {subjectsList.map(s => (
                    <option key={s.subject_code} value={s.subject_code}>
                      {s.subject_code} ({s.total_students} alumnos)
                    </option>
                  ))}
                </select>
              </div>

              <div className="maestro-field">
                <label>Grupo</label>
                <select
                  value={group}
                  onChange={e => setGroup(e.target.value)}
                  className="maestro-select"
                  disabled={!groupsList.length}
                >
                  {groupsList.map(g => (
                    <option key={g.group_code} value={g.group_code}>
                      Grupo {g.group_code} ({g.total_students} alumnos)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {subject && (
            <div className="maestro-partial-container">
              <PartialManager
                semester={semester}
                subject={subject}
                group={group}
                teacherId={user?.id}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default MaestroDashboard;
