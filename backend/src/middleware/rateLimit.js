const WINDOW_CLEANUP_INTERVAL_MS = 60_000;
const authFailures = new Map();

function now() {
  return Date.now();
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function logRateLimitEvent(req, limiter) {
  console.warn(JSON.stringify({
    event: 'rate_limit_hit',
    limiter,
    ip: clientIp(req),
    userId: req.user?.id || null,
    path: req.originalUrl?.split('?')[0] || req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  }));
}

function pruneWindow(bucket, windowMs, currentTime) {
  while (bucket.length > 0 && bucket[0] <= currentTime - windowMs) {
    bucket.shift();
  }
}

function retryAfterSeconds(resetAt) {
  return Math.max(1, Math.ceil((resetAt - now()) / 1000));
}

export function createSlidingWindowLimiter({ windowMs, max, keyGenerator, backoff = false, name = 'default' }) {
  const hits = new Map();

  setInterval(() => {
    const currentTime = now();
    for (const [key, bucket] of hits.entries()) {
      pruneWindow(bucket.requests, windowMs, currentTime);
      if (bucket.requests.length === 0 && bucket.blockedUntil <= currentTime) {
        hits.delete(key);
      }
    }
  }, WINDOW_CLEANUP_INTERVAL_MS).unref();

  return (req, res, next) => {
    const key = keyGenerator(req);
    const currentTime = now();
    const bucket = hits.get(key) || { requests: [], violations: 0, blockedUntil: 0 };

    if (bucket.blockedUntil > currentTime) {
      const retryAfter = retryAfterSeconds(bucket.blockedUntil);
      res.set('Retry-After', String(retryAfter));
      logRateLimitEvent(req, name);
      return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta mas tarde.' });
    }

    pruneWindow(bucket.requests, windowMs, currentTime);
    if (bucket.requests.length >= max) {
      bucket.violations += 1;
      const penalty = backoff ? Math.min(2 ** bucket.violations, 900) * 1000 : windowMs;
      bucket.blockedUntil = currentTime + penalty;
      hits.set(key, bucket);
      const retryAfter = retryAfterSeconds(bucket.blockedUntil);
      res.set('Retry-After', String(retryAfter));
      logRateLimitEvent(req, name);
      return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta mas tarde.' });
    }

    bucket.requests.push(currentTime);
    hits.set(key, bucket);
    next();
  };
}

export const globalRateLimiter = createSlidingWindowLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  name: 'global',
  keyGenerator: (req) => `global:${clientIp(req)}`,
  backoff: true
});

export const authRateLimiter = createSlidingWindowLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  name: 'auth',
  keyGenerator: (req) => `auth:${clientIp(req)}:${req.body?.username || 'anonymous'}`,
  backoff: true
});

export const apiRateLimiter = createSlidingWindowLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  name: 'api',
  keyGenerator: (req) => `api:${req.user?.id || clientIp(req)}:${req.originalUrl.split('?')[0]}`,
  backoff: true
});

export const uploadRateLimiter = createSlidingWindowLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  name: 'upload',
  keyGenerator: (req) => `upload:${req.user?.id || clientIp(req)}`,
  backoff: true
});

function authKey(username, role) {
  return `${String(role || '').toLowerCase()}:${String(username || '').toLowerCase()}`;
}

export function enforceAuthLockout(req, res, next) {
  const key = authKey(req.body?.username, req.body?.role);
  const failure = authFailures.get(key);
  if (failure?.lockedUntil && failure.lockedUntil > now()) {
    const retryAfter = retryAfterSeconds(failure.lockedUntil);
    res.set('Retry-After', String(retryAfter));
    logRateLimitEvent(req, 'auth-lockout');
    return res.status(429).json({ error: 'Cuenta temporalmente bloqueada. Intenta mas tarde.' });
  }
  next();
}

export function recordAuthFailure(username, role) {
  const key = authKey(username, role);
  const failure = authFailures.get(key) || { count: 0, lockedUntil: 0 };
  failure.count += 1;
  if (failure.count >= 5) {
    const lockMs = Math.min(2 ** (failure.count - 4), 900) * 1000;
    failure.lockedUntil = now() + lockMs;
  }
  authFailures.set(key, failure);
}

export function clearAuthFailures(username, role) {
  authFailures.delete(authKey(username, role));
}
