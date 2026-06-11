import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ALLOWED_ROLES = new Set(['admin', 'director', 'maestro', 'alumno']);
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_LENGTH = 1000;
const JWT_ALGORITHM = 'HS256';
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "upgrade-insecure-requests"
].join('; ');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters');
  }
  return secret;
}

export function logSecurityEvent(req, event, details = {}) {
  console.warn(JSON.stringify({
    event,
    ip: req.ip || req.socket?.remoteAddress || 'unknown',
    userId: req.user?.id || null,
    role: req.user?.role || null,
    method: req.method,
    path: req.originalUrl?.split('?')[0] || req.path,
    timestamp: new Date().toISOString(),
    ...details
  }));
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

export function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': CSP_DIRECTIVES,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Origin-Agent-Cluster': '?1',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=15552000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-DNS-Prefetch-Control': 'off',
    'X-Download-Options': 'noopen',
    'X-Frame-Options': 'DENY',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'X-XSS-Protection': '0'
  });
  if (req.path.startsWith('/api')) {
    res.set('Cache-Control', 'private, no-store');
  }
  next();
}

export function requireJsonBody(req, res, next) {
  if (!SAFE_METHODS.has(req.method) && !req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type application/json requerido' });
  }
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
    logSecurityEvent(req, 'auth_missing_token');
    return res.status(401).json({ error: 'Autenticacion requerida' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: [JWT_ALGORITHM],
      issuer: process.env.JWT_ISSUER || 'calsys-api',
      audience: process.env.JWT_AUDIENCE || 'calsys-web'
    });
    if (!ALLOWED_ROLES.has(decoded.role)) {
      logSecurityEvent(req, 'auth_invalid_role', { tokenRole: decoded.role });
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }
    req.user = decoded;
    next();
  } catch {
    logSecurityEvent(req, 'auth_invalid_token');
    return res.status(401).json({ error: 'Token invalido' });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      logSecurityEvent(req, 'permission_denied', { requiredRoles: roles });
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }
    next();
  };
}

export function configuredOrigins() {
  const corsOrigin = process.env.CORS_ORIGIN;

  // Enforce CORS_ORIGIN in production
  if (!corsOrigin) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CORS_ORIGIN environment variable must be set in production');
    }
    // Development fallback only
    return ['http://localhost:5173'];
  }

  // Parse and validate origins
  const origins = corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      try {
        new URL(origin);
        return origin;
      } catch {
        console.warn(`⚠️ Invalid CORS origin URL: "${origin}" - skipping`);
        return null;
      }
    })
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error('No valid CORS origins configured in CORS_ORIGIN');
  }

  return origins;
}

export function verifyOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const allowed = configuredOrigins();
  const source = origin || referer;
  if (!source) return res.status(403).json({ error: 'Origen requerido' });
  let sourceOrigin;
  try {
    sourceOrigin = new URL(source).origin;
  } catch {
    return res.status(403).json({ error: 'Origen no permitido' });
  }
  if (!allowed.includes(sourceOrigin)) {
    logSecurityEvent(req, 'origin_denied', { origin: sourceOrigin });
    return res.status(403).json({ error: 'Origen no permitido' });
  }
  next();
}

export function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const csrfHeader = req.headers['x-csrf-token'];
  if (!req.user?.csrfToken || csrfHeader !== req.user.csrfToken) {
    logSecurityEvent(req, 'csrf_denied');
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
    logSecurityEvent(req, 'scope_denied', { scope: 'teacherId' });
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }
  if (teacherId !== undefined && role === 'alumno') {
    logSecurityEvent(req, 'scope_denied', { scope: 'teacherId' });
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }
  if (matricula !== undefined && role === 'alumno' && !valueMatches(matricula, req.user.matricula)) {
    logSecurityEvent(req, 'scope_denied', { scope: 'matricula' });
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }
  next();
}

export function genericError(message = 'Error en el servidor') {
  return { error: message };
}

export function sendServerError(res, message = 'Error en el servidor') {
  return res.status(500).json(genericError(message));
}
