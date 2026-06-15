import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../config/database.js';
import { authenticateToken, createCsrfToken, logSecurityEvent, signAuthToken } from '../middleware/security.js';
import { clearAuthFailures, recordAuthFailure } from '../middleware/rateLimit.js';
import { validateEnum, validateNonEmptyString } from '../utils/validation.js';

const router = express.Router();
const AUTH_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;

function authCookieOptions(httpOnly) {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE_MS
  };
}

function clearAuthCookies(res) {
  const isProduction = process.env.NODE_ENV === 'production';
  const options = {
    secure: isProduction,
    sameSite: 'strict',
    path: '/'
  };
  res.clearCookie('access_token', { ...options, httpOnly: true });
  res.clearCookie('csrf_token', { ...options, httpOnly: false });
}

router.post('/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Faltan datos (username, password, role)' });
    }

    const validatedUsername = validateNonEmptyString(username, 'Usuario');
    const validatedRole = validateEnum(role, ['admin', 'director', 'maestro', 'alumno'], 'Rol');

    let user = null;
    let userRole = validatedRole;

    if (validatedRole === 'alumno') {
      const [rows] = await db.query(
        'SELECT matricula as id, matricula as username, first_name, last_name, email, password_hash, status FROM students WHERE matricula = ?',
        [validatedUsername]
      );
      if (rows.length > 0 && rows[0].status === 'active') {
        user = rows[0];
      }
    } else {
      const [rows] = await db.query(
        'SELECT id, username, first_name, last_name, email, password_hash, role, is_active FROM users WHERE username = ? AND role = ?',
        [validatedUsername, validatedRole]
      );
      if (rows.length > 0 && rows[0].is_active === 1) {
        user = rows[0];
        userRole = rows[0].role;
      }
    }

    if (!user) {
      recordAuthFailure(validatedUsername, validatedRole);
      logSecurityEvent(req, 'login_failed', { username: validatedUsername, requestedRole: validatedRole });
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const isValid = await bcrypt.compare(String(password), user.password_hash);
    if (!isValid) {
      recordAuthFailure(validatedUsername, validatedRole);
      logSecurityEvent(req, 'login_failed', { username: validatedUsername, requestedRole: validatedRole });
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }
    clearAuthFailures(validatedUsername, validatedRole);
    logSecurityEvent(req, 'login_success', { userId: user.id, requestedRole: validatedRole });

    const csrfToken = createCsrfToken();
    const token = signAuthToken({
      ...user,
      role: userRole,
      matricula: validatedRole === 'alumno' ? user.id : undefined
    }, csrfToken);

    res.cookie('access_token', token, authCookieOptions(true));
    res.cookie('csrf_token', csrfToken, authCookieOptions(false));
    res.json({
      csrfToken,
      user: {
        id: user.id,
        username: user.username,
        role: userRole,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        matricula: validatedRole === 'alumno' ? user.id : undefined
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookies(res);
  res.json({ success: true });
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { csrfToken, iat, exp, iss, aud, ...user } = req.user;
    res.json({ user });
  } catch {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

export default router;
