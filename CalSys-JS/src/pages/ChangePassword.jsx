import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import justoSierraLogo from '../assets/justo-sierra-logo-transparent.png';

function homeForRole(role) {
  if (role === 'alumno') return '/alumno';
  if (role === 'maestro') return '/maestro';
  if (role === 'director') return '/admin';
  return '/login';
}

function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('La nueva contrasena debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contrasenas no coinciden');
      return;
    }

    setIsLoading(true);
    const result = await changePassword(currentPassword, newPassword, confirmPassword);
    setIsLoading(false);

    if (result.success) {
      navigate(homeForRole(result.role), { replace: true });
    } else {
      setError(result.error);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&display=swap');

        .password-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f5f5;
          font-family: 'DM Sans', sans-serif;
          padding: 1rem;
        }

        .password-card {
          background: #ffffff;
          border: 0.5px solid #e5e7eb;
          border-radius: 16px;
          padding: 2.5rem;
          width: 100%;
          max-width: 430px;
          box-shadow: 0 4px 32px rgba(0, 0, 0, 0.07);
        }

        .password-brand {
          text-align: center;
          margin-bottom: 1.75rem;
        }

        .password-icon {
          width: 70px;
          height: 70px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.9rem;
          overflow: hidden;
        }

        .password-icon img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        .password-title {
          font-family: 'DM Serif Display', serif;
          font-size: 24px;
          font-weight: 400;
          color: #111111;
          margin: 0 0 6px;
        }

        .password-subtitle {
          font-size: 13px;
          line-height: 1.45;
          color: #6b7280;
          margin: 0;
        }

        .password-user {
          background: #fafafa;
          border: 0.5px solid #e5e7eb;
          border-radius: 8px;
          color: #374151;
          font-size: 13px;
          margin-bottom: 1.25rem;
          padding: 10px 12px;
          text-align: center;
        }

        .password-field {
          margin-bottom: 1.1rem;
        }

        .password-label {
          display: block;
          font-size: 11px;
          font-weight: 500;
          color: #9ca3af;
          margin-bottom: 6px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .password-input {
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

        .password-input:focus {
          border-color: var(--brand);
          background: #ffffff;
        }

        .password-error {
          background: var(--error-bg);
          border: 0.5px solid var(--error-border);
          color: var(--error-text);
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 1.25rem;
        }

        .password-btn {
          width: 100%;
          padding: 13px;
          background: var(--brand);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 14px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          margin-top: 0.4rem;
          transition: background 0.2s;
        }

        .password-btn:hover:not(:disabled) {
          background: var(--brand-hover);
        }

        .password-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .password-secondary {
          width: 100%;
          padding: 11px;
          background: transparent;
          border: none;
          color: var(--brand);
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          margin-top: 0.75rem;
        }
      `}</style>

      <div className="password-wrapper">
        <form className="password-card" onSubmit={handleSubmit}>
          <div className="password-brand">
            <div className="password-icon">
              <img src={justoSierraLogo} alt="Justo Sierra" />
            </div>
            <h1 className="password-title">Cambia tu contrasena</h1>
            <p className="password-subtitle">
              Por seguridad, actualiza la contrasena temporal antes de entrar a CalSys.
            </p>
          </div>

          <div className="password-user">
            {user?.firstName} {user?.lastName} · {user?.username}
          </div>

          {error && <div className="password-error">{error}</div>}

          <div className="password-field">
            <label className="password-label">Contrasena actual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="password-input"
              autoComplete="current-password"
              required
            />
          </div>

          <div className="password-field">
            <label className="password-label">Nueva contrasena</label>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="password-input"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div className="password-field">
            <label className="password-label">Confirmar contrasena</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="password-input"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <button type="submit" disabled={isLoading} className="password-btn">
            {isLoading ? 'Guardando...' : 'Guardar contrasena'}
          </button>
          <button type="button" className="password-secondary" onClick={logout}>
            Salir
          </button>
        </form>
      </div>
    </>
  );
}

export default ChangePassword;
