import axios from 'axios';

const baseURL =
  (window.__env__ && window.__env__.REACT_APP_API_URL &&
    window.__env__.REACT_APP_API_URL !== 'REACT_APP_API_URL_PLACEHOLDER'
    ? window.__env__.REACT_APP_API_URL
    : null) ||
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
