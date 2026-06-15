import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'https://calsys-backend-production.up.railway.app/api';

function cookieValue(name) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
}

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const csrfToken = cookieValue('csrf_token');
  if (csrfToken && !['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) {
    config.headers['X-CSRF-Token'] = decodeURIComponent(csrfToken);
  }
  return config;
});

export default api;
