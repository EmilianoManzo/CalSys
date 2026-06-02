# Referencia de API

Base URL local: `http://localhost:3000/api`

Las rutas devuelven JSON. Cuando el usuario esta autenticado, el cliente envia:

```http
Authorization: Bearer <token>
```

## Salud del servicio

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/health` | Verifica disponibilidad del backend y conexion a MySQL. |

## Autenticacion

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `POST` | `/auth/login` | Login para staff o alumno. |
| `GET` | `/auth/me` | Devuelve datos contenidos en el token. |

### POST `/auth/login`

Body:

```json
{
  "username": "admin",
  "password": "password123",
  "role": "admin"
}
```

Para alumnos, `username` corresponde a la matricula y `role` debe ser `alumno`.

Respuesta exitosa:

```json
{
  "token": "jwt",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "firstName": "Nombre",
    "lastName": "Apellido",
    "email": "correo@dominio.com"
  }
}
```

## Calificaciones y materias

Prefijo: `/grades`

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/grades/teacher/subjects` | Materias asignadas a un maestro. |
| `GET` | `/grades/subject/groups` | Grupos disponibles para una materia, semestre y maestro. |
| `GET` | `/grades/student-subjects` | Materias inscritas de un alumno. |
| `GET` | `/grades/student-grades` | Calificaciones de un alumno por parcial y materia. |
| `GET` | `/grades/student-final` | Calificacion final global de un alumno por materia. |

Parametros frecuentes:

- `teacherId`
- `semester`
- `subjectCode` o `subject`
- `group`
- `matricula`
- `parcialId`

## Parciales

Prefijo: `/partials`

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/partials/config` | Obtiene columnas configuradas de un parcial. |
| `POST` | `/partials/config` | Guarda columnas configuradas de un parcial. |
| `GET` | `/partials/grades` | Obtiene estudiantes, columnas y valores capturados. |
| `POST` | `/partials/save-grades` | Guarda calificaciones capturadas. |

### POST `/partials/config`

Body:

```json
{
  "teacherId": 1,
  "semester": "2026-1",
  "subject": "MAT101",
  "group": "A",
  "partialId": 1,
  "columns": [
    {
      "name": "Examen",
      "weight": 60,
      "maxValue": 10
    },
    {
      "name": "Tareas",
      "weight": 40,
      "maxValue": 10
    }
  ]
}
```

### POST `/partials/save-grades`

Body:

```json
{
  "teacherId": 1,
  "semester": "2026-1",
  "subject": "MAT101",
  "group": "A",
  "partialId": 1,
  "values": [
    {
      "matricula": "2025001",
      "columnName": "Examen",
      "value": 9.5
    }
  ]
}
```

## Asistencia

Prefijo: `/attendance`

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/attendance/dates` | Lista fechas de clase. |
| `POST` | `/attendance/dates` | Crea una fecha de clase. |
| `DELETE` | `/attendance/dates/:id` | Elimina una fecha de clase. |
| `GET` | `/attendance/records` | Obtiene matriz de asistencia por alumno y fecha. |
| `POST` | `/attendance/records` | Guarda asistencia. |
| `GET` | `/attendance/student` | Consulta asistencia de un alumno por materia. |

### POST `/attendance/records`

Body:

```json
{
  "updates": [
    {
      "matricula": "2025001",
      "dateId": 10,
      "isPresent": true
    }
  ]
}
```

## Administracion

Prefijo: `/admin`

### Estadisticas y catalogos

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/admin/stats` | Estadisticas generales. |
| `GET` | `/admin/materias` | Lista materias. |
| `POST` | `/admin/materias` | Crea materia. |
| `PUT` | `/admin/materias/:id` | Actualiza materia. |
| `DELETE` | `/admin/materias/:id` | Elimina materia y datos relacionados. |
| `GET` | `/admin/profesores` | Lista profesores activos. |
| `GET` | `/admin/grupos` | Lista codigos de grupos activos. |

### Grupos

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/admin/student-groups` | Lista grupos. |
| `POST` | `/admin/student-groups` | Crea grupo. |
| `PUT` | `/admin/student-groups/:id` | Actualiza grupo. |
| `DELETE` | `/admin/student-groups/:id` | Desactiva grupo. |
| `PUT` | `/admin/student-groups/:id/members` | Reemplaza miembros del grupo. |

### Asignaciones

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `POST` | `/admin/asignar-materia` | Asigna materia a profesor, semestre y grupo. |
| `GET` | `/admin/asignaciones` | Lista asignaciones. |
| `DELETE` | `/admin/asignaciones` | Elimina una asignacion. |
| `GET` | `/admin/subjects` | Lista materias usadas en calificaciones. |
| `GET` | `/admin/subject-groups` | Lista grupos de una materia. |
| `GET` | `/admin/teachers` | Lista maestros/directivos activos. |
| `GET` | `/admin/semesters` | Lista semestres existentes. |

### Estudiantes

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/admin/students` | Lista estudiantes. |
| `POST` | `/admin/students` | Crea estudiante. |
| `PUT` | `/admin/students/:matricula` | Actualiza estudiante. |
| `DELETE` | `/admin/students/:matricula` | Desactiva o elimina estudiante. |

Para eliminacion permanente usar query string:

```text
DELETE /admin/students/2025001?permanent=true
```

### Usuarios staff

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/admin/users` | Lista usuarios staff. |
| `POST` | `/admin/users` | Crea usuario staff. |
| `PUT` | `/admin/users/:id` | Actualiza usuario staff. |
| `DELETE` | `/admin/users/:id` | Desactiva o elimina usuario staff. |

Para eliminacion permanente usar query string:

```text
DELETE /admin/users/5?permanent=true
```

## Codigos de respuesta esperados

| Codigo | Significado |
| --- | --- |
| `200` | Operacion exitosa. |
| `400` | Datos faltantes o invalidos. |
| `401` | Token ausente, invalido o credenciales incorrectas. |
| `404` | Recurso o ruta no encontrada. |
| `500` | Error interno del servidor. |
