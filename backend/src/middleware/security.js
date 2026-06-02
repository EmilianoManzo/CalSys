import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ALLOWED_ROLES = new Set(['admin', 'director', 'maestro', 'alumno']);
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_LENGTH = 1000;
const JWT_ALGORITHM = 'HS256';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters');
  }
  return secret;
}

function cleanString(value) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, MAX_STRING_LENGTH);
}

export function sanitizeValue(value, depth = 0) {
  if (depth > 8) return undefined;
  if (typeof value === 'string') return cleanString(value);
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeValue(item, depth + 1));
  if (value && typeof value === 'object') {
    const sanitized = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      sanitized[cleanString(key)] = sanitizeValue(child, depth + 1);
    }
    return sanitized;
  }
  return value;
}

export function sanitizeRequest(req, res, next) {
  req.body = sanitizeValue(req.body) || {};
  req.query = sanitizeValue(req.query) || {};
  req.params = sanitizeValue(req.params) || {};
  next();
}

export function signAuthToken(user, csrfToken) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      matricula: user.matricula,
      csrfToken
    },
    getJwtSecret(),
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: process.env.JWT_EXPIRES_IN || '12h',
      issuer: process.env.JWT_ISSUER || 'calsys-api',
      audience: process.env.JWT_AUDIENCE || 'calsys-web'
    }
  );
}

export function createCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Autenticacion requerida' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: [JWT_ALGORITHM],
      issuer: process.env.JWT_ISSUER || 'calsys-api',
      audience: process.env.JWT_AUDIENCE || 'calsys-web'
    });
    if (!ALLOWED_ROLES.has(decoded.role)) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalido' });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }
    next();
  };
}

function configuredOrigins() {
  return (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function verifyOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const allowed = configuredOrigins();
  const source = origin || referer;
  if (!source) return res.status(403).json({ error: 'Origen requerido' });
  if (!allowed.some((allowedOrigin) => source.startsWith(allowedOrigin))) {
    return res.status(403).json({ error: 'Origen no permitido' });
  }
  next();
}

export function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const csrfHeader = req.headers['x-csrf-token'];
  if (!req.user?.csrfToken || csrfHeader !== req.user.csrfToken) {
    return res.status(403).json({ error: 'Token CSRF invalido' });
  }
  next();
}

function valueMatches(actual, expected) {
  return String(actual) === String(expected);
}

export function enforceScopedAccess(req, res, next) {
  const role = req.user?.role;
  const teacherId = req.query.teacherId ?? req.body.teacherId ?? req.query.teacher_id ?? req.body.teacher_id;
  const matricula = req.query.matricula ?? req.body.matricula;

  if (teacherId !== undefined && role === 'maestro' && !valueMatches(teacherId, req.user.id)) {
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }
  if (teacherId !== undefined && role === 'alumno') {
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }
  if (matricula !== undefined && role === 'alumno' && !valueMatches(matricula, req.user.matricula)) {
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }
  next();
}

export function genericError(message = 'Error en el servidor') {
  return { error: message };
}
