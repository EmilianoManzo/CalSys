import axios from 'axios';

// API_URL is injected at container startup into /config.js, which sets
// window.__RUNTIME_CONFIG__.  Fall back to the Vite build-time variable
// (useful during local `npm run dev`) and then to localhost.
const baseURL =
  (window.__RUNTIME_CONFIG__ && window.__RUNTIME_CONFIG__.API_URL) ||
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
