# Frontend de CalSys

Aplicacion React/Vite para los dashboards de CalSys.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

## Estructura principal

```text
src/
+-- api/axios.js
+-- components/
+-- context/AuthContext.jsx
+-- pages/
+-- App.jsx
+-- main.jsx
```

## Rutas

| Ruta | Pagina | Rol |
| --- | --- | --- |
| `/login` | Login | Todos |
| `/alumno` | AlumnoDashboard | `alumno` |
| `/maestro` | MaestroDashboard | `maestro`, `admin` |
| `/admin` | AdminDashboard | `admin` |

## API

El cliente HTTP esta configurado en `src/api/axios.js` y apunta a:

```text
http://localhost:3000/api
```

El interceptor agrega el token JWT desde `localStorage` en el header `Authorization`.
