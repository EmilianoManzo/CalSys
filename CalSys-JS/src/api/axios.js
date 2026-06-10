import axios from 'axios';

// Resolve the API base URL at runtime.
// Priority:
//   1. window.__env__.REACT_APP_API_URL  — injected by the container entrypoint
//      (e.g. http://CalSys-Front.railway.internal:3000/api on Railway)
//   2. import.meta.env.VITE_API_URL      — Vite build-time variable (optional)
//   3. http://localhost:3000/api         — local development fallback
const baseURL =
  (typeof window !== 'undefined' && window.__env__?.REACT_APP_API_URL) ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000/api';

const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  const csrfToken = sessionStorage.getItem('csrfToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (csrfToken && !['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

export default api;
