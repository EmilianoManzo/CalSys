# Arquitectura

## Vision general

CalSys sigue una arquitectura cliente-servidor. El frontend React presenta dashboards por rol y consume una API REST en Express. El backend concentra validaciones, persistencia y calculos de apoyo, mientras que MySQL almacena usuarios, estudiantes, asignaciones, parciales, calificaciones y asistencia.

```text
Usuario
  |
  v
Frontend React/Vite
  |
  | HTTP JSON + JWT
  v
Backend Express
  |
  | mysql2/promise
  v
MySQL
```

## Frontend

El frontend se ubica en `frontend/`.

Responsabilidades:

- Autenticacion visual y manejo de sesion.
- Enrutamiento por rol.
- Captura y visualizacion de datos academicos.
- Tablas editables con Handsontable.
- Graficas y estadisticas con Chart.js.

Rutas principales:

| Ruta | Componente | Rol esperado |
| --- | --- | --- |
| `/login` | `Login` | Todos |
| `/alumno` | `AlumnoDashboard` | `alumno` |
| `/maestro` | `MaestroDashboard` | `maestro`, `admin` |
| `/admin` | `AdminDashboard` | `admin` |

## Backend

El backend se ubica en `backend/` y expone la API bajo `/api`.

Responsabilidades:

- Conexion a MySQL.
- Autenticacion con JWT.
- Validacion de parametros.
- Gestion de catalogos y asignaciones.
- Persistencia de calificaciones y asistencia.
- Calculos de promedios parciales y finales cuando aplica.

Middlewares principales:

- `cors`, limitado por `CORS_ORIGIN`.
- `express.json()` para cuerpos JSON.
- Handler 404.
- Handler global de errores.

## Base de datos

Tablas inferidas por el codigo actual:

| Tabla | Uso |
| --- | --- |
| `users` | Staff: administradores, directores y maestros. |
| `students` | Alumnos. |
| `student_groups` | Grupos academicos. |
| `materias` | Catalogo de materias. |
| `final_grades` | Inscripcion/asignacion de alumno a materia, maestro, semestre y grupo. |
| `partial_columns_config` | Columnas configurables por parcial. |
| `partial_grades` | Valores capturados por estudiante, parcial y columna. |
| `attendance_dates` | Fechas de clase. |
| `attendance_records` | Asistencia por alumno y fecha. |
| `grade_columns_config` | Configuracion legacy/alterna de columnas. |
| `grade_custom_values` | Valores legacy/alternos por columna personalizada. |

## Modelo de calificacion por parciales

- Parciales ordinarios: `partial_id` 1, 2 y 3.
- Examen final: `partial_id` 4.
- Calificacion final global: `partial_id` 5.
- Promedio parcial interno: columna `__promedio`.
- Columnas especiales de final global:
  - `Promedio de Parciales`
  - `Calificacion Examen Final`

El promedio parcial se calcula como suma ponderada:

```text
SUM((valor / valor_maximo) * 10 * (peso / 100))
```

La calificacion final global combina columnas ordinarias y columnas especiales segun sus ponderaciones configuradas.

## Seguridad

- Passwords con hash `bcryptjs`.
- Tokens firmados con `JWT_SECRET`.
- Autenticacion del usuario actual mediante header `Authorization: Bearer <token>`.
- Recomendacion: reforzar autorizacion backend por rol para endpoints administrativos y de captura antes de produccion.

## Decisiones tecnicas relevantes

- `mysql2/promise` permite codigo asincrono claro.
- Operaciones de escritura masiva usan transacciones en rutas criticas.
- Handsontable se usa para flujos donde el usuario espera comportamiento tipo Excel.
- La API usa JSON simple para facilitar integracion y depuracion.
