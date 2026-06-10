import axios from 'axios';

// Prefer the runtime value injected by the server into /public/env.js so that
// the backend URL can be a Railway reference variable resolved at runtime.
// Fall back to the Vite build-time variable (useful in local dev with a .env
// file), and finally to localhost for plain `vite dev` without any config.
const runtimeApiUrl = window.env?.VITE_API_URL;
const isPlaceholder = !runtimeApiUrl || runtimeApiUrl === '${VITE_API_URL}';
const baseURL = isPlaceholder
  ? (import.meta.env.VITE_API_URL || 'http://localhost:3000/api')
  : runtimeApiUrl;

const api = axios.create({ baseURL });

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
