const store = new Map();

export async function cacheAside(key, ttlMs, loader) {
  const cached = store.get(key);
  const currentTime = Date.now();
  if (cached && cached.expiresAt > currentTime) {
    return cached.value;
  }

  const value = await loader();
  store.set(key, {
    value,
    expiresAt: currentTime + ttlMs
  });
  return value;
}

export function invalidateCache(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

export function setCacheControl(res, directive = 'private, no-store') {
  res.set('Cache-Control', directive);
}
