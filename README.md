# CalSys

Sistema web para la gestion academica de calificaciones, parciales, asistencia, materias, grupos, usuarios y estudiantes. CalSys esta orientado a instituciones educativas que requieren captura flexible de evaluaciones, calculo ponderado de promedios y dashboards diferenciados por rol.

## Resumen ejecutivo

CalSys centraliza el flujo de evaluacion academica en una aplicacion full-stack con autenticacion por roles. Los maestros configuran columnas de evaluacion por materia, semestre, grupo y parcial; los alumnos consultan sus resultados; y los administradores gestionan catalogos, usuarios, estudiantes, grupos, asignaciones y estadisticas institucionales.

## Alcance funcional

- Autenticacion para administradores, directores, maestros y alumnos.
- Dashboard de maestro para captura de calificaciones por parciales.
- Columnas dinamicas con ponderacion, valor maximo y orden de visualizacion.
- Calculo de promedios parciales y calificacion final global.
- Registro y consulta de asistencia por fecha de clase.
- Dashboard de alumno con consulta de materias, calificaciones y asistencia.
- Dashboard administrativo para catalogos academicos, usuarios, grupos, estudiantes, asignaciones y estadisticas.
- API REST organizada por modulos funcionales.

## Arquitectura general

| Capa | Tecnologia |
| --- | --- |
| Frontend | React, Vite, React Router, Axios, Handsontable, Chart.js |
| Backend | Node.js, Express, JWT, bcryptjs |
| Base de datos | MySQL 8.x |
| Estilos | CSS, TailwindCSS configurado |

El frontend consume la API REST publicada por el backend bajo `/api`. El backend valida datos, administra transacciones cuando corresponde y persiste la informacion en MySQL.

## Estructura del repositorio

```text
CalSys/
+-- backend/
|   +-- src/
|   |   +-- config/database.js
|   |   +-- routes/
|   |   |   +-- admin.routes.js
|   |   |   +-- attendance.routes.js
|   |   |   +-- auth.routes.js
|   |   |   +-- columns.routes.js
|   |   |   +-- grades.routes.js
|   |   |   +-- partials.routes.js
|   |   +-- utils/
|   |   +-- server.js
|   +-- package.json
+-- frontend/
|   +-- src/
|   |   +-- api/
|   |   +-- components/
|   |   +-- context/
|   |   +-- pages/
|   |   +-- main.jsx
|   +-- package.json
+-- docs/
|   +-- API.md
|   +-- ARCHITECTURE.md
|   +-- OPERATIONS.md
+-- DESARROLLO.md
+-- ESTADO_ACTUAL.md
```

## Requisitos

- Node.js 18 o superior.
- npm 9 o superior.
- MySQL 8.x.
- Base de datos creada y con el esquema requerido por la aplicacion.

## Configuracion

Crear un archivo `.env` en `backend/`:

```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=calsys_db
DB_PORT=3306
JWT_SECRET=change-me
JWT_EXPIRES_IN=24h
```

El frontend usa por defecto `http://localhost:3000/api` como URL base de la API en `frontend/src/api/axios.js`.

## Instalacion y ejecucion local

Instalar dependencias del backend:

```bash
cd backend
npm install
npm run dev
```

Instalar dependencias del frontend:

```bash
cd frontend
npm install
npm run dev
```

URLs locales:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Health check: `http://localhost:3000/api/health`

## Roles del sistema

| Rol | Acceso principal |
| --- | --- |
| `admin` | Administracion general, catalogos, usuarios, alumnos, materias, grupos y estadisticas. |
| `director` | Perfil directivo previsto para consulta administrativa. |
| `maestro` | Captura de calificaciones, configuracion de parciales y asistencia. |
| `alumno` | Consulta de calificaciones, materias y asistencia propia. |

## Documentacion tecnica

- [Arquitectura](docs/ARCHITECTURE.md)
- [Funcionamiento y codigo](docs/FUNCIONAMIENTO_Y_CODIGO.md)
- [Referencia de API](docs/API.md)
- [Operacion y mantenimiento](docs/OPERATIONS.md)
- [Guia de desarrollo](DESARROLLO.md)
- [Estado actual](ESTADO_ACTUAL.md)

## Buenas practicas del proyecto

- Mantener `.env`, `node_modules/`, `dist/` y artefactos generados fuera del control de versiones.
- Validar entradas antes de escribir en la base de datos.
- Usar transacciones en operaciones que modifiquen varias tablas.
- No duplicar reglas criticas de calificacion en el frontend si ya existen en backend o base de datos.
- Verificar compilacion del frontend y arranque del backend antes de integrar cambios.

## Licencia

Consultar el archivo [LICENSE](LICENSE).
