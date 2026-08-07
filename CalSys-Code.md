# CalSys Project Code

This file contains all the source code from the CalSys project.

## Frontend (CalSys-JS)

### eslint.config.js
```javascript
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
]
```

### package.json
```json
{
  "name": "calsys-js",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.6.2",
    "chart.js": "^4.4.0",
    "handsontable": "^14.0.0",
    "react": "^18.2.0",
    "react-chartjs-2": "^5.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.2.0",
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "eslint": "^9.2.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "eslint-plugin-react-refresh": "^0.4.6",
    "globals": "^15.2.0",
    "vite": "^5.1.0"
  }
}
```

### vite.config.js
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

### src/App.jsx
```javascript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AlumnoDashboard from './pages/AlumnoDashboard';
import MaestroDashboard from './pages/MaestroDashboard';
import AdminDashboard from './pages/AdminDashboard';
import DirectorDashboard from './pages/DirectorDashboard';
import ChangePassword from './pages/ChangePassword';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'DM Sans, sans-serif',
        color: '#6b7280'
      }}>
        Cargando...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function homeForRole(role) {
  if (role === 'alumno') return '/alumno';
  if (role === 'maestro') return '/maestro';
  if (role === 'director') return '/admin';
  return '/login';
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/alumno" 
            element={
              <ProtectedRoute allowedRoles={['alumno']}>
                <AlumnoDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/maestro" 
            element={
              <ProtectedRoute allowedRoles={['maestro']}>
                <MaestroDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={['director']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/director" 
            element={
              <ProtectedRoute allowedRoles={['director']}>
                <DirectorDashboard />
              </ProtectedRoute>
            } 
          />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
```

### src/main.jsx
```javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### src/index.css
```css
:root {
  --brand: #880000;
  --brand-hover: #6b0000;
  --bg-page: #f5f5f5;
  --bg-card: #ffffff;
  --border: #e5e7eb;
  --text-primary: #111111;
  --text-secondary: #6b7280;
  --success: #10b981;
  --success-bg: #d1fae5;
  --success-text: #065f46;
  --warning: #f59e0b;
  --warning-bg: #fef3c7;
  --warning-text: #92400e;
  --error: #dc2626;
  --error-strong: #ef4444;
  --error-bg: #fef2f2;
  --error-text: #991b1b;
  --error-border: #fca5a5;
  --info: #3b82f6;
  --info-bg: #eff6ff;
  --info-text: #1e40af;
  --neutral: #9ca3af;
  --btn-secondary: #4b5563;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### src/theme.js
```javascript
export const colors = {
  brand: '#880000',
  brandHover: '#6b0000',
  bgPage: '#f5f5f5',
  bgCard: '#ffffff',
  border: '#e5e7eb',
  textPrimary: '#111111',
  textSecondary: '#6b7280',
  success: '#10b981',
  successBg: '#d1fae5',
  successText: '#065f46',
  warning: '#f59e0b',
  warningBg: '#fef3c7',
  warningText: '#92400e',
  error: '#dc2626',
  errorStrong: '#ef4444',
  errorBg: '#fef2f2',
  errorText: '#991b1b',
  errorBorder: '#fca5a5',
  info: '#3b82f6',
  infoBg: '#eff6ff',
  infoText: '#1e40af',
  neutral: '#9ca3af',
  btnSecondary: '#4b5563',
};

export function gradeStyle(value) {
  const n = parseFloat(value);
  if (isNaN(n)) return { bg: colors.warningBg, text: colors.warningText };
  if (n >= 9) return { solid: colors.success, soft: { bg: colors.successBg, text: colors.successText } };
  if (n >= 6) return { solid: colors.warning, soft: { bg: colors.warningBg, text: colors.warningText } };
  return { solid: colors.errorStrong, soft: { bg: colors.errorBg, text: colors.errorText } };
}
```

### src/api/axios.js
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  const csrfToken = sessionStorage.getItem('csrfToken');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  
  return config;
});

export default api;
```

### src/context/AuthContext.jsx
```javascript
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const csrfToken = sessionStorage.getItem('csrfToken');
    if (token && csrfToken) {
      api.get('/auth/me')
        .then(response => {
          setUser(response.data.user);
        })
        .catch(() => {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('csrfToken');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password, role) => {
    try {
      const response = await api.post('/auth/login', { username, password, role });
      const { token, csrfToken, user } = response.data;
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('csrfToken', csrfToken);
      setUser(user);
      return { success: true, role: user.role };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Error al iniciar sesión' };
    }
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('csrfToken');
    setUser(null);
  };

  const changePassword = async (currentPassword, newPassword, confirmPassword) => {
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword
      });
      const { token, csrfToken, user } = response.data;
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('csrfToken', csrfToken);
      setUser(user);
      return { success: true, role: user.role };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Error al cambiar contraseña' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

[Due to size limits, remaining files are summarized. Full code available in the project files.]

## Backend

### package.json
```json
{
  "name": "calsys-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "mysql2": "^3.2.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3"
  }
}
```

### src/server.js
```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './config/database.js';
import authRoutes from './routes/auth.routes.js';
import gradesRoutes from './routes/grades.routes.js';
import columnsRoutes from './routes/columns.routes.js';
import adminRoutes from './routes/admin.routes.js';
import partialsRoutes from './routes/partials.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import {
  authenticateToken,
  configuredOrigins,
  enforceScopedAccess,
  genericError,
  requireRoles,
  requireJsonBody,
  sanitizeRequest,
  securityHeaders,
  verifyCsrf,
  verifyOrigin
} from './middleware/security.js';
import { apiRateLimiter, authRateLimiter, enforceAuthLockout, globalRateLimiter } from './middleware/rateLimit.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
const corsOrigins = configuredOrigins();

app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido'));
  },
  credentials: true
}));
app.use(securityHeaders);
app.use(requireJsonBody);
app.use(express.json({ limit: '100kb' }));
app.use(sanitizeRequest);
app.use(globalRateLimiter);
app.use((req, res, next) => {
  res.charset = 'utf-8';
  next();
});

app.get('/', (req, res) => {
  res.json({ message: '🎓 Calsys API', version: '1.0.0', status: 'running' });
});

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'OK', database: 'connected' });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ status: 'ERROR', database: 'disconnected' });
  }
});

app.use('/api/auth/login', authRateLimiter, enforceAuthLockout);
app.use('/api/auth', authRoutes);

const protectedRoute = [authenticateToken, verifyOrigin, verifyCsrf, enforceScopedAccess, apiRateLimiter];
app.use('/api/grades', protectedRoute, gradesRoutes);
app.use('/api/columns', protectedRoute, requireRoles('director', 'maestro'), columnsRoutes);
app.use('/api/admin', protectedRoute, requireRoles('director'), adminRoutes);
app.use('/api/partials', protectedRoute, requireRoles('director', 'maestro'), partialsRoutes);
app.use('/api/attendance', protectedRoute, attendanceRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled request error:', err);
  res.status(500).json(genericError('Error interno del servidor'));
});

const server = app.listen(PORT, () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Calsys Backend: http://localhost:${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  }
});

async function shutdown(reason, error) {
  if (error) {
    console.error(reason, error);
  } else {
    console.warn(reason);
  }

  server.close(async () => {
    try {
      await db.end();
      process.exit(error ? 1 : 0);
    } catch (closeError) {
      console.error('Error closing database pool:', closeError);
      process.exit(1);
    }
  });

  setTimeout(() => process.exit(1), 20000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM received'));
process.on('SIGINT', () => shutdown('SIGINT received'));
process.on('unhandledRejection', (reason) => shutdown('Unhandled rejection', reason));
process.on('uncaughtException', (error) => shutdown('Uncaught exception', error));
```

### src/config/database.js
```javascript
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const useSsl = process.env.DB_SSL === 'true';

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME     || 'CalSysJS',
  port:             Number(process.env.DB_PORT || 3306),
  charset:          'utf8mb4',
  connectTimeout:   Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
  ssl:              useSsl ? {
    rejectUnauthorized: process.env.NODE_ENV === 'production',
    minVersion: 'TLSv1.2'
  } : undefined,
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0
});

export default pool;
```

[Due to size limits, remaining backend files are summarized. Full code available in the project files.]

## File Structure

### Frontend Files (CalSys-JS/src)
- pages/Login.jsx
- pages/AlumnoDashboard.jsx
- pages/MaestroDashboard.jsx
- pages/AdminDashboard.jsx
- pages/DirectorDashboard.jsx
- pages/ChangePassword.jsx
- components/AttendanceTable.jsx
- components/ColumnConfig.jsx
- components/GradesTable.jsx
- components/PartialAveragesTable.jsx
- components/PartialGradesTable.jsx
- components/PartialManager.jsx
- components/admin/GradesViewer.jsx
- components/admin/GroupsManager.jsx
- components/admin/MateriasManager.jsx
- components/admin/Stats.jsx
- components/admin/StudentsManager.jsx
- components/admin/UsersManager.jsx

### Backend Files (backend/src)
- routes/auth.routes.js
- routes/grades.routes.js
- routes/attendance.routes.js
- routes/columns.routes.js
- routes/partials.routes.js
- routes/admin.routes.js
- middleware/security.js
- middleware/rateLimit.js
- utils/cache.js
- utils/validation.js
- utils/enrolledStudents.js
- utils/deleteAssignment.js
