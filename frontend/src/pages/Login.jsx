import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const roles = ['alumno', 'maestro', 'admin'];
const roleLabels = { alumno: 'Alumno', maestro: 'Maestro', admin: 'Director' };

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('alumno');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const result = await login(username, password, role);
    setIsLoading(false);
    if (result.success) {
      if (result.role === 'alumno') navigate('/alumno');
      else if (result.role === 'maestro') navigate('/maestro');
      else if (result.role === 'admin') navigate('/admin');
    } else {
      setError(result.error);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&display=swap');

        .login-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f5f5;
          font-family: 'DM Sans', sans-serif;
          padding: 1rem;
        }

        .login-card {
          background: #ffffff;
          border: 0.5px solid #e5e7eb;
          border-radius: 16px;
          padding: 2.5rem;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 4px 32px rgba(0, 0, 0, 0.07);
        }

        .login-brand {
          text-align: center;
          margin-bottom: 2rem;
        }

        .login-icon {
          width: 52px;
          height: 52px;
          background: #c0392b;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1rem;
        }

        .login-icon svg {
          width: 26px;
          height: 26px;
          stroke: white;
          fill: none;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .login-title {
          font-family: 'DM Serif Display', serif;
          font-size: 24px;
          font-weight: 400;
          color: #111111;
          margin: 0 0 4px;
        }

        .login-subtitle {
          font-size: 13px;
          color: #9ca3af;
          margin: 0;
        }

        .role-tabs {
          display: flex;
          gap: 6px;
          background: #5a5a5a;
          border-radius: 10px;
          padding: 4px;
          margin-bottom: 1.5rem;
        }

        .role-tab {
          flex: 1;
          padding: 9px 4px;
          border: none;
          border-radius: 7px;
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          color: #9ca3af;
          background: transparent;
        }

        .role-tab.active {
          background: #ffffff;
          color: #c0392b;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
        }

        .login-field {
          margin-bottom: 1.25rem;
        }

        .login-label {
          display: block;
          font-size: 11px;
          font-weight: 500;
          color: #9ca3af;
          margin-bottom: 6px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .login-input {
          width: 100%;
          background: #fafafa;
          border: 0.5px solid #e5e7eb;
          border-radius: 8px;
          padding: 11px 14px;
          font-size: 14px;
          color: #111111;
          font-family: 'DM Sans', sans-serif;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }

        .login-input:focus {
          border-color: #c0392b;
          background: #ffffff;
        }

        .login-input::placeholder {
          color: #d1d5db;
        }

        .login-error {
          background: #fef2f2;
          border: 0.5px solid #fca5a5;
          color: #c0392b;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 1.25rem;
        }

        .login-btn {
          width: 100%;
          padding: 13px;
          background: #c0392b;
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 14px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          margin-top: 0.5rem;
          letter-spacing: 0.02em;
          transition: background 0.2s;
        }

        .login-btn:hover:not(:disabled) {
          background: #a93226;
        }

        .login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .login-footer {
          text-align: center;
          font-size: 12px;
          color: #c0392b;
          margin-top: 1.5rem;
          cursor: pointer;
        }
      `}</style>

      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-brand">
            <div className="login-icon">
              <svg viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <h1 className="login-title">Bienvenido</h1>
            <p className="login-subtitle">Sistema Escolar · Inicia sesión</p>
          </div>

          <div className="role-tabs">
            {roles.map((r) => (
              <button
                key={r}
                type="button"
                className={`role-tab ${role === r ? 'active' : ''}`}
                onClick={() => setRole(r)}
              >
                {roleLabels[r]}
              </button>
            ))}
          </div>

          {error && <div className="login-error">{error}</div>}

          <div className="login-field">
            <label className="login-label">Usuario / Matrícula</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input"
              placeholder="Ingresa tu matrícula"
              required
            />
          </div>

          <div className="login-field">
            <label className="login-label">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="button"
            disabled={isLoading}
            className="login-btn"
            onClick={handleSubmit}
          >
            {isLoading ? 'Ingresando...' : 'Ingresar →'}
          </button>

          <p className="login-footer">¿Problemas para ingresar? Contacta a soporte</p>
        </div>
      </div>
    </>
  );
}

export default Login;