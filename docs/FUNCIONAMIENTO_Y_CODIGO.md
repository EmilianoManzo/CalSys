# Funcionamiento y codigo del proyecto

## Vista general del flujo de ejecucion

CalSys funciona como una aplicacion cliente-servidor:

1. El usuario abre el frontend en Vite.
2. React Router muestra la pantalla que corresponde al rol.
3. El usuario inicia sesion contra `/api/auth/login`.
4. El backend valida credenciales en MySQL y firma un JWT.
5. El frontend guarda el token y lo envia en cada peticion mediante Axios.
6. Las pantallas consultan o modifican datos academicos mediante rutas REST.
7. Express valida parametros, ejecuta consultas MySQL y responde JSON.
8. React actualiza el estado local y vuelve a renderizar tablas, graficas o formularios.

## Arranque del backend

Archivo principal: `backend/src/server.js`

Responsabilidades:

- Cargar variables de entorno con `dotenv`.
- Crear la aplicacion Express.
- Configurar CORS con `CORS_ORIGIN`.
- Habilitar cuerpos JSON con `express.json()`.
- Exponer el health check `/api/health`.
- Registrar los modulos de rutas:
  - `/api/auth`
  - `/api/grades`
  - `/api/columns`
  - `/api/admin`
  - `/api/partials`
  - `/api/attendance`
- Responder `404` cuando la ruta no existe.
- Capturar errores no controlados con un handler global.

El backend usa un pool de conexiones MySQL definido en `backend/src/config/database.js`. El pool permite reutilizar conexiones y manejar concurrencia con `connectionLimit: 10`.

## Conexion a base de datos

Archivo: `backend/src/config/database.js`

La conexion se construye con `mysql2/promise`, lo que permite usar `await db.query(...)` en todas las rutas.

Variables utilizadas:

| Variable | Uso |
| --- | --- |
| `DB_HOST` | Host de MySQL. |
| `DB_USER` | Usuario de conexion. |
| `DB_PASSWORD` | Password del usuario. |
| `DB_NAME` | Base de datos principal. |
| `DB_PORT` | Puerto de MySQL. |

El patron recurrente del backend es:

```js
const [rows] = await db.query('SELECT ... WHERE campo = ?', [valor]);
```

Esto evita concatenar valores directamente dentro del SQL y reduce riesgo de inyeccion SQL.

## Autenticacion y sesion

### Backend

Archivo: `backend/src/routes/auth.routes.js`

El endpoint `POST /api/auth/login` recibe:

```json
{
  "username": "admin",
  "password": "password123",
  "role": "admin"
}
```

Funcionamiento:

1. Valida que existan `username`, `password` y `role`.
2. Si el rol es `alumno`, busca en la tabla `students` por `matricula`.
3. Si el rol es staff, busca en la tabla `users` por `username` y `role`.
4. Verifica que el usuario este activo.
5. Compara password contra `password_hash` con `bcrypt.compare`.
6. Firma un JWT con `jwt.sign`.
7. Devuelve `{ token, user }`.

El endpoint `GET /api/auth/me` valida el token con `jwt.verify` y devuelve la informacion contenida en el JWT.

### Frontend

Archivo: `frontend/src/context/AuthContext.jsx`

Responsabilidades:

- Mantener `user` y `loading` como estado global de autenticacion.
- Leer el token desde `localStorage` al iniciar.
- Configurar el header `Authorization` en Axios.
- Consultar `/auth/me` para restaurar sesion.
- Ejecutar `login(username, password, role)`.
- Ejecutar `logout()` limpiando token y usuario.

El flujo completo es:

```text
Login.jsx -> AuthContext.login -> api.post('/auth/login') -> JWT -> localStorage -> rutas protegidas
```

## Rutas protegidas en frontend

Archivo: `frontend/src/App.jsx`

React Router decide que pantalla mostrar segun `user.role`:

| Ruta | Condicion |
| --- | --- |
| `/alumno` | `user.role === 'alumno'` |
| `/maestro` | `user.role === 'maestro' || user.role === 'admin'` |
| `/admin` | `user.role === 'admin'` |

Si el usuario no cumple la condicion, se redirige a `/login`.

Importante: esta proteccion es de interfaz. Para produccion tambien se recomienda reforzar autorizacion por rol en backend.

## Flujo del maestro

### Entrada al dashboard

Archivo: `frontend/src/pages/MaestroDashboard.jsx`

El dashboard del maestro:

1. Obtiene el usuario desde `useAuth()`.
2. Mantiene filtros de `semester`, `subject` y `group`.
3. Al cargar o cambiar semestre, llama a `/grades/teacher/subjects`.
4. Selecciona por defecto la primera materia recibida.
5. Consulta grupos con `/grades/subject/groups`.
6. Renderiza `PartialManager` cuando ya hay materia seleccionada.

El contexto que se pasa a los componentes hijos es:

```jsx
<PartialManager
  semester={semester}
  subject={subject}
  group={group}
  teacherId={user?.id}
/>
```

Este contexto es critico porque identifica una clase unica: maestro + semestre + materia + grupo.

### Administrador de parciales

Archivo: `frontend/src/components/PartialManager.jsx`

Este componente solo controla la navegacion interna entre pestanas:

| Tab | Componente |
| --- | --- |
| Parcial 1 | `PartialGradesTable` con `partialId=1` |
| Parcial 2 | `PartialGradesTable` con `partialId=2` |
| Parcial 3 | `PartialGradesTable` con `partialId=3` |
| Examen Final | `PartialGradesTable` con `partialId=4` |
| Cal. Final | `PartialGradesTable` con `partialId=5` |
| Asistencia | `AttendanceTable` |

Los IDs de parcial tienen significado funcional:

- `1`, `2`, `3`: parciales ordinarios.
- `4`: examen final.
- `5`: calificacion final global.
- `6`: solo existe como tab visual para asistencia.

## Captura de calificaciones

### Tabla editable

Archivo: `frontend/src/components/PartialGradesTable.jsx`

Este componente concentra el flujo mas importante del sistema.

Estados principales:

| Estado | Funcion |
| --- | --- |
| `data` | Filas que se muestran en Handsontable. |
| `columns` | Columnas configuradas del parcial. |
| `loading` | Estado de carga. |
| `saving` | Estado de guardado. |
| `showConfig` | Decide si se muestra `ColumnConfig`. |
| `hotRef` | Referencia a la instancia Handsontable. |

Al montar o cambiar contexto, ejecuta:

```text
loadConfig() -> GET /partials/config -> loadGrades() -> GET /partials/grades
```

### Configuracion de columnas

Si no hay columnas configuradas, se abre `ColumnConfig`.

El maestro puede definir:

- Nombre de columna.
- Tipo (`numeric` o `text`).
- Valor maximo.
- Peso porcentual.
- Indicador de requerido.

Antes de guardar, `ColumnConfig` valida:

- Que todas las columnas normales tengan nombre.
- Que la suma de pesos numericos no supere 100%.
- Que los campos numericos se normalicen como numeros.

Luego envia:

```text
POST /api/partials/config
```

### Carga de calificaciones

`PartialGradesTable` llama a:

```text
GET /api/partials/grades
```

El backend devuelve:

- Lista de estudiantes inscritos.
- Columnas configuradas.
- Valores por estudiante y columna.
- Columnas virtuales de promedio o final cuando aplica.

El frontend transforma cada fila en un arreglo compatible con Handsontable:

```text
[matricula, nombre, valor_columna_1, valor_columna_2, ...]
```

### Calculo visual en tiempo real

En parciales normales, `afterChange` recalcula visualmente la ultima columna usando:

```text
(valor / max_value) * 10 * (peso / 100)
```

Este calculo inmediato mejora la experiencia del maestro, pero la persistencia y recalculo confiable ocurren en backend/base de datos.

### Guardado de calificaciones

Al guardar:

1. Se lee la tabla actual desde Handsontable.
2. Se ignoran columnas virtuales y columnas especiales no editables.
3. Se construye un arreglo `values`.
4. Se envia a `POST /api/partials/save-grades`.
5. Se recarga la configuracion y datos.

Payload simplificado:

```json
{
  "teacherId": 1,
  "semester": "2025-1",
  "subject": "MAT101",
  "group": "A",
  "partialId": 1,
  "values": [
    {
      "matricula": "2025001",
      "columnName": "Examen",
      "value": "9.5"
    }
  ]
}
```

## Funcionamiento de parciales en backend

Archivo: `backend/src/routes/partials.routes.js`

### `ensureColumnsConfig`

Cuando existen calificaciones pero faltan columnas configuradas, esta funcion reconstruye configuraciones basicas con peso distribuido. Es una defensa para mantener consistencia si hay datos historicos o incompletos.

### `recalcPartialAverages`

Recalcula el promedio parcial eliminando primero el registro previo `__promedio` y luego insertando el nuevo resultado agregado.

Formula:

```sql
ROUND(SUM((g.value / pc.max_value) * 10 * (pc.weight / 100)), 2)
```

### `ensureFinalSpecialColumns`

Garantiza que la pestana de calificacion final tenga columnas especiales:

- `Promedio de Parciales`
- `Calificacion Examen Final`

Estas columnas son especiales porque su valor no se captura directamente como actividad normal, sino que se obtiene de otros parciales.

### `GET /partials/config`

Devuelve la configuracion de columnas de una clase y parcial. Para `partialId=5`, tambien asegura y devuelve columnas especiales.

### `POST /partials/config`

Actualiza la configuracion:

1. Inicia transaccion.
2. Borra columnas normales existentes del contexto.
3. Inserta nuevas columnas normales.
4. Si es calificacion final, actualiza pesos de columnas especiales.
5. Confirma la transaccion.

### `GET /partials/grades`

Arma la tabla completa:

1. Obtiene columnas reales.
2. Agrega columnas virtuales:
   - `Promedio Parcial` para parciales normales.
   - `CALIFICACION FINAL GLOBAL` para parcial 5.
3. Obtiene estudiantes inscritos con `getEnrolledStudents`.
4. Busca valores capturados en `partial_grades`.
5. Si es parcial normal, agrega `__promedio`.
6. Si es final global, calcula:
   - Promedio de parciales 1, 2 y 3.
   - Calificacion de examen final desde parcial 4.
   - Calificacion final ponderada.
7. Devuelve una matriz por estudiante.

### `POST /partials/save-grades`

Guarda valores capturados:

1. Inicia transaccion.
2. Ignora columnas especiales/virtuales.
3. Inserta o actualiza cada valor con `ON DUPLICATE KEY UPDATE`.
4. Confirma transaccion.
5. Si el parcial no es final global, agenda recalculo asincrono de `__promedio`.

## Flujo del alumno

Archivo: `frontend/src/pages/AlumnoDashboard.jsx`

El alumno no captura datos, solo consulta.

Flujo:

1. Al montar, consulta `/grades/student-subjects`.
2. Selecciona la primera materia disponible.
3. Segun la pestana activa:
   - Parciales 1-3: `/grades/student-grades`
   - Calificacion final: `/grades/student-final`
   - Asistencia: `/attendance/student`
4. Construye una tabla de una sola fila con la informacion del alumno.
5. Muestra promedio parcial o final.
6. Colorea calificaciones con ayuda de `gradeStyle`.

Este dashboard usa el contexto real de la inscripcion del alumno: el backend localiza `teacher_id`, `semester_code` y `group_code` a partir de `final_grades`.

## Flujo administrativo

Archivo: `frontend/src/pages/AdminDashboard.jsx`

El dashboard administrativo concentra:

- Estadisticas.
- Materias.
- Calificaciones.
- Alumnos.
- Grupos.
- Usuarios.

Al cargar, llama a:

```text
GET /api/admin/stats
```

Luego muestra indicadores y graficas con `react-chartjs-2`.

Componentes administrativos:

| Componente | Responsabilidad |
| --- | --- |
| `MateriasManager` | CRUD de materias. |
| `GradesViewer` | Consulta global de calificaciones. |
| `StudentsManager` | CRUD de alumnos. |
| `GroupsManager` | Gestion de grupos. |
| `UsersManager` | CRUD de usuarios staff. |

## Funcionamiento del modulo admin en backend

Archivo: `backend/src/routes/admin.routes.js`

### Estadisticas

`GET /admin/stats` calcula:

- Total de estudiantes activos.
- Total de maestros/staff activos.
- Total de materias detectadas.
- Total de calificaciones capturadas.
- Promedio general.
- Aprobados, reprobados y en progreso.
- Promedio por materia.

### Materias

Rutas:

- `GET /admin/materias`
- `POST /admin/materias`
- `PUT /admin/materias/:id`
- `DELETE /admin/materias/:id`

La eliminacion de materia usa transaccion y llama a `deleteAllSubjectData` para limpiar datos relacionados antes de borrar el catalogo.

### Grupos

Rutas:

- `GET /admin/student-groups`
- `POST /admin/student-groups`
- `PUT /admin/student-groups/:id`
- `DELETE /admin/student-groups/:id`
- `PUT /admin/student-groups/:id/members`

Cuando se reemplazan miembros, el backend primero libera alumnos del grupo y luego asigna las matriculas recibidas.

### Asignaciones

`POST /admin/asignar-materia` crea registros en `final_grades` para todos los alumnos activos de un grupo. Esta tabla actua como inscripcion del alumno a una materia, semestre, grupo y maestro.

El contexto de clase se deriva de:

```text
student_matricula + semester_code + subject_code + group_code + teacher_id
```

### Usuarios y estudiantes

Los endpoints de creacion hashean passwords con `bcrypt.hash`. Las eliminaciones pueden ser:

- Logicas: cambian `status` o `is_active`.
- Permanentes: eliminan registros relacionados mediante utilidades transaccionales.

## Asistencia

### Frontend

Archivo: `frontend/src/components/AttendanceTable.jsx`

El maestro puede:

- Cargar asistencia por contexto.
- Agregar fechas de clase.
- Eliminar fechas.
- Marcar asistencia con checkboxes.
- Guardar todos los registros en lote.

El componente transforma la tabla visual en:

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

### Backend

Archivo: `backend/src/routes/attendance.routes.js`

Rutas principales:

- `GET /attendance/dates`
- `POST /attendance/dates`
- `DELETE /attendance/dates/:id`
- `GET /attendance/records`
- `POST /attendance/records`
- `GET /attendance/student`

El backend calcula por alumno:

- Clases totales.
- Asistencias.
- Porcentaje.

El porcentaje se calcula con `safeDivision` para evitar division por cero.

## Utilidades compartidas

### Validacion segura

Archivo: `backend/src/utils/validation.js`

Funciones clave:

| Funcion | Uso |
| --- | --- |
| `safeNumber` | Convierte a numero o devuelve default. |
| `safeInt` | Convierte a entero seguro. |
| `validateId` | Garantiza IDs positivos. |
| `validateEmail` | Valida formato basico de email. |
| `validateMatricula` | Normaliza matricula. |
| `validateNonEmptyString` | Evita strings vacios. |
| `safeDivision` | Evita division por cero. |
| `safeAverage` | Promedia solo valores validos. |

Estas utilidades reducen errores como `NaN`, strings vacios, IDs invalidos y divisiones por cero.

### Alumnos inscritos

Archivo: `backend/src/utils/enrolledStudents.js`

`getEnrolledStudents` busca estudiantes activos inscritos en un contexto de clase mediante `final_grades`.

El uso de `(fg.group_code <=> ?)` es importante porque en MySQL `<=>` compara valores incluyendo `NULL`. Esto permite diferenciar correctamente clases con grupo y clases sin grupo.

### Borrado de datos relacionados

Archivo: `backend/src/utils/deleteAssignment.js`

Contiene funciones para eliminar datos dependientes:

- `deleteAsignacion`
- `deleteAllSubjectData`
- `deleteStudentRecords`
- `deleteTeacherRecords`

Estas funciones evitan dejar registros huerfanos en:

- `final_grades`
- `partial_grades`
- `partial_columns_config`
- `grade_columns_config`
- `grade_custom_values`
- `attendance_dates`
- `attendance_records`

## Modelo de datos inferido desde el codigo

| Entidad | Tabla principal | Descripcion |
| --- | --- | --- |
| Usuario staff | `users` | Admin, director y maestro. |
| Alumno | `students` | Identificado por matricula. |
| Grupo | `student_groups` | Agrupacion academica de alumnos. |
| Materia | `materias` | Catalogo academico. |
| Inscripcion/asignacion | `final_grades` | Relacion alumno-materia-maestro-semestre-grupo. |
| Configuracion de parcial | `partial_columns_config` | Columnas evaluables por parcial. |
| Valor capturado | `partial_grades` | Calificacion por alumno, parcial y columna. |
| Fecha de clase | `attendance_dates` | Fecha asociada a maestro/materia/grupo. |
| Asistencia | `attendance_records` | Presencia/ausencia por alumno y fecha. |

## Contratos importantes entre frontend y backend

### Contexto de clase

Debe mantenerse consistente en todas las llamadas:

```text
teacherId, semester, subject, group, partialId
```

Si uno de estos valores cambia, se esta hablando de otro conjunto de datos.

### Nombre de columna

`partial_grades.column_name` debe coincidir con `partial_columns_config.column_name`. Por eso el guardado de configuracion elimina y recrea columnas normales.

### Columnas virtuales

Columnas como `Promedio Parcial` o `CALIFICACION FINAL GLOBAL` se muestran en frontend, pero no deben guardarse como captura manual. El frontend las marca como `readOnly` y el backend tambien las ignora.

### Columnas especiales

En final global, `Promedio de Parciales` y `Calificacion Examen Final` se calculan a partir de otros parciales. Su peso es configurable, pero el valor no debe capturarse manualmente desde la tabla final.

## Puntos criticos del codigo

### Seguridad

- El frontend protege rutas visualmente.
- El backend valida token solo en `/auth/me`.
- Recomendacion: agregar middleware de autenticacion/autorizacion a rutas sensibles como `/admin`, `/partials` y `/attendance`.

### Consistencia de calculos

- Hay calculo visual en frontend para experiencia inmediata.
- Hay calculo en backend para consultas y persistencia.
- Tambien existen rutas legacy en `/columns`.
- Recomendacion: definir una sola fuente de verdad para reglas de calificacion y retirar o documentar el flujo legacy.

### Transacciones

Las rutas de configuracion y borrado usan transacciones. Esto es correcto porque actualizan varias tablas relacionadas.

### Datos nulos de grupo

El proyecto trata grupo vacio como `NULL`. Las consultas usan `<=>` para comparar correctamente contra `NULL`. Esto es importante y debe conservarse.

### Codificacion de caracteres

Algunos archivos del proyecto muestran caracteres mal codificados en consola. La documentacion generada se mantiene en ASCII para evitar problemas de portabilidad, pero se recomienda normalizar el repositorio a UTF-8.

## Guia para desarrollar una nueva funcionalidad

Ejemplo: agregar un reporte exportable.

1. Definir el caso de uso y rol autorizado.
2. Crear endpoint backend en el modulo adecuado.
3. Validar parametros con `validation.js`.
4. Consultar datos usando el contexto correcto.
5. Si se escriben varias tablas, usar transaccion.
6. Crear componente React o extender pagina existente.
7. Consumir el endpoint mediante `api`.
8. Manejar estados de carga, error y exito.
9. Actualizar documentacion API y operacion.
10. Probar manualmente con usuario de cada rol afectado.

## Mapa de archivos clave

| Archivo | Por que importa |
| --- | --- |
| `backend/src/server.js` | Punto de entrada del backend y registro de rutas. |
| `backend/src/config/database.js` | Pool MySQL usado por toda la API. |
| `backend/src/routes/auth.routes.js` | Login, JWT y recuperacion de sesion. |
| `backend/src/routes/partials.routes.js` | Nucleo de calificaciones por parciales. |
| `backend/src/routes/attendance.routes.js` | Fechas y asistencia. |
| `backend/src/routes/admin.routes.js` | Operaciones administrativas y catalogos. |
| `backend/src/utils/validation.js` | Validacion y conversion segura de datos. |
| `backend/src/utils/enrolledStudents.js` | Seleccion confiable de alumnos por clase. |
| `backend/src/utils/deleteAssignment.js` | Limpieza de datos relacionados. |
| `frontend/src/App.jsx` | Rutas protegidas por rol. |
| `frontend/src/context/AuthContext.jsx` | Estado global de sesion. |
| `frontend/src/api/axios.js` | Cliente HTTP de la API. |
| `frontend/src/pages/MaestroDashboard.jsx` | Entrada al flujo de captura. |
| `frontend/src/components/PartialManager.jsx` | Navegacion entre parciales y asistencia. |
| `frontend/src/components/PartialGradesTable.jsx` | Tabla editable y guardado de calificaciones. |
| `frontend/src/components/ColumnConfig.jsx` | Configuracion de columnas evaluables. |
| `frontend/src/components/AttendanceTable.jsx` | Captura de asistencia. |
| `frontend/src/pages/AlumnoDashboard.jsx` | Consulta de datos por alumno. |
| `frontend/src/pages/AdminDashboard.jsx` | Panel administrativo y analitico. |
