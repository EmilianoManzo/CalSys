# Estado actual del proyecto

Fecha de actualizacion: 2026-06-01

## Estado general

CalSys cuenta con una base funcional full-stack para gestion de calificaciones, parciales, asistencia, usuarios, estudiantes, materias, grupos y asignaciones. La aplicacion esta organizada en frontend React y backend Express con persistencia en MySQL.

## Funcionalidades implementadas

### Autenticacion

- Login unificado para staff y alumnos.
- Generacion de JWT.
- Recuperacion de usuario autenticado mediante `/api/auth/me`.
- Proteccion de rutas en frontend segun rol.

### Maestro

- Consulta de materias asignadas.
- Seleccion por semestre, materia y grupo.
- Configuracion de columnas por parcial.
- Captura de calificaciones en tablas tipo hoja de calculo.
- Calculo de promedio parcial.
- Calificacion final global con columnas especiales.
- Registro de asistencia por fechas.

### Alumno

- Consulta de materias inscritas.
- Visualizacion de calificaciones por parcial.
- Consulta de calificacion final.
- Consulta de asistencia y resumen.

### Administracion

- Estadisticas generales.
- Catalogo de materias.
- Gestion de estudiantes.
- Gestion de usuarios de staff.
- Gestion de grupos.
- Asignacion de materias a profesores y grupos.
- Consulta de asignaciones existentes.

## Modulos principales del backend

| Archivo | Responsabilidad |
| --- | --- |
| `backend/src/routes/auth.routes.js` | Login y usuario autenticado. |
| `backend/src/routes/grades.routes.js` | Consultas de materias/calificaciones para maestros y alumnos. |
| `backend/src/routes/partials.routes.js` | Configuracion y captura por parciales. |
| `backend/src/routes/columns.routes.js` | Flujo legacy o alterno de columnas/calificaciones personalizadas. |
| `backend/src/routes/attendance.routes.js` | Fechas y registros de asistencia. |
| `backend/src/routes/admin.routes.js` | Administracion de catalogos, usuarios, alumnos, grupos y asignaciones. |

## Pendientes recomendados

- Parametrizar la URL base del frontend mediante variables de entorno.
- Agregar scripts de migracion o respaldo del esquema de MySQL.
- Incorporar pruebas automatizadas para rutas criticas.
- Homologar el modelo de calculo entre rutas legacy (`columns`) y rutas actuales (`partials`), si ambas seguiran activas.
- Fortalecer autorizacion backend por rol en endpoints sensibles.
- Documentar proceso de despliegue productivo cuando se defina infraestructura.

## Verificacion sugerida antes de entrega

```bash
cd backend
npm start
```

```bash
cd frontend
npm run build
npm run lint
```
