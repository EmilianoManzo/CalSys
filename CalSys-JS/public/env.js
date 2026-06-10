// Runtime environment configuration.
// In production this file is served by the web server after variable
// substitution, so VITE_API_URL is replaced with the real backend URL
// before the browser receives it.  In development the placeholder is
// left as-is and axios.js falls back to import.meta.env.VITE_API_URL
// (set in .env) or http://localhost:3000/api.
window.env = {
  VITE_API_URL: '${VITE_API_URL}',
};
