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
app.use('/api/columns', protectedRoute, requireRoles('admin', 'director', 'maestro'), columnsRoutes);
app.use('/api/admin', protectedRoute, requireRoles('admin'), adminRoutes);
app.use('/api/partials', protectedRoute, requireRoles('admin', 'director', 'maestro'), partialsRoutes);
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

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM received'));
process.on('SIGINT', () => shutdown('SIGINT received'));
process.on('unhandledRejection', (reason) => shutdown('Unhandled rejection', reason));
process.on('uncaughtException', (error) => shutdown('Uncaught exception', error));
