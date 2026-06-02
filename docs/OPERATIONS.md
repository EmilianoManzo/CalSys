# Operacion y mantenimiento

## Arranque local

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Verificar:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- API health: `http://localhost:3000/api/health`

## Configuracion de ambiente

El backend requiere un archivo `.env` en `backend/`.

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

Recomendaciones para produccion:

- Usar un `JWT_SECRET` robusto y privado.
- Restringir `CORS_ORIGIN` al dominio real del frontend.
- Usar usuario de base de datos con permisos minimos necesarios.
- Habilitar respaldos periodicos de MySQL.
- Ejecutar la aplicacion detras de HTTPS.

## Validacion operativa

Checklist minimo despues de instalar o desplegar:

- `/api/health` responde `status: OK`.
- Login de administrador funciona.
- Login de maestro funciona.
- Login de alumno funciona.
- Un maestro puede cargar sus materias.
- Se puede abrir una tabla de parcial.
- Se puede guardar una calificacion de prueba.
- El alumno puede consultar la calificacion.
- Se puede registrar y consultar asistencia.

## Mantenimiento de datos

Operaciones sensibles:

- Eliminacion permanente de estudiantes.
- Eliminacion permanente de usuarios.
- Eliminacion de materias con datos relacionados.
- Eliminacion de asignaciones.

Antes de ejecutar operaciones destructivas:

- Confirmar respaldo vigente.
- Validar que la accion corresponde al periodo, materia, grupo o usuario correcto.
- Preferir desactivacion logica cuando sea posible.

## Seguridad

Puntos obligatorios antes de produccion:

- No versionar `.env`.
- Cambiar credenciales de prueba.
- Rotar `JWT_SECRET`.
- Revisar autorizacion por rol en endpoints administrativos.
- Revisar politicas de retencion de datos personales.

## Calidad y verificacion

Frontend:

```bash
cd frontend
npm run build
npm run lint
```

Backend:

```bash
cd backend
npm start
```

Actualmente el repositorio no incluye pruebas automatizadas. Se recomienda agregar pruebas para:

- Login y validacion de credenciales.
- Creacion y edicion de estudiantes.
- Creacion de columnas por parcial.
- Guardado y recalculo de calificaciones.
- Registro de asistencia.

## Solucion de problemas

### El frontend no conecta con el backend

- Verificar que el backend este en `http://localhost:3000`.
- Revisar `frontend/src/api/axios.js`.
- Confirmar `CORS_ORIGIN` en el `.env` del backend.

### `/api/health` falla

- Confirmar que MySQL esta activo.
- Revisar `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` y `DB_PORT`.
- Verificar que la base de datos exista.

### Login devuelve credenciales invalidas

- Confirmar que el usuario esta activo.
- Para staff, revisar `users.is_active` y `users.role`.
- Para alumnos, revisar `students.status`.
- Verificar que el password este hasheado con bcrypt.

### Los promedios no aparecen

- Verificar que existan columnas configuradas con pesos.
- Confirmar que los valores capturados correspondan al mismo maestro, semestre, materia, grupo y parcial.
- Revisar registros en `partial_grades` con columna `__promedio`.
