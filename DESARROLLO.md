# Guia de desarrollo

Este documento define las convenciones tecnicas para evolucionar CalSys de forma consistente y mantenible.

## Principios de trabajo

- Priorizar cambios pequenos, verificables y alineados con la arquitectura existente.
- Mantener separada la responsabilidad entre frontend, backend y base de datos.
- Evitar logica duplicada para calculos academicos.
- Registrar errores de servidor sin exponer informacion sensible al cliente.
- Proteger credenciales, tokens y datos personales.

## Stack

| Area | Herramientas |
| --- | --- |
| Frontend | React, Vite, React Router, Axios, Handsontable, Chart.js |
| Backend | Node.js, Express, mysql2, JWT, bcryptjs |
| Base de datos | MySQL |
| Calidad | ESLint en frontend |

## Convenciones de codigo

### Backend

- Usar modulos ES (`import` / `export`).
- Agrupar endpoints por dominio en `backend/src/routes/`.
- Usar `async` / `await`.
- Validar parametros con utilidades de `backend/src/utils/validation.js`.
- Usar transacciones cuando una operacion afecte multiples tablas.
- Devolver respuestas JSON con mensajes claros.

### Frontend

- Usar componentes funcionales y hooks.
- Centralizar llamadas HTTP mediante `frontend/src/api/axios.js`.
- Mantener la sesion en `AuthContext`.
- Separar paginas de componentes reutilizables.
- Usar Handsontable para tablas editables de calificaciones/asistencia.

### Nombres

| Elemento | Convencion |
| --- | --- |
| Componentes React | `PascalCase.jsx` |
| Utilidades JS | `camelCase.js` |
| Variables y funciones | `camelCase` |
| Constantes | `UPPER_SNAKE_CASE` |
| Rutas API | Sustantivos en plural cuando aplique |

## Flujo recomendado de desarrollo

1. Sincronizar la rama de trabajo.
2. Revisar el modulo afectado y sus consumidores.
3. Implementar el cambio con alcance reducido.
4. Ejecutar las verificaciones disponibles.
5. Actualizar documentacion si cambia un contrato, comando, endpoint o flujo funcional.

## Comandos utiles

Backend:

```bash
cd backend
npm install
npm run dev
npm start
```

Frontend:

```bash
cd frontend
npm install
npm run dev
npm run build
npm run lint
```

## Variables de entorno del backend

| Variable | Descripcion | Valor por defecto |
| --- | --- | --- |
| `PORT` | Puerto HTTP del backend. | `3000` |
| `NODE_ENV` | Entorno de ejecucion. | `development` |
| `CORS_ORIGIN` | Origen permitido para CORS. | `http://localhost:5173` |
| `DB_HOST` | Host de MySQL. | `localhost` |
| `DB_USER` | Usuario de MySQL. | `root` |
| `DB_PASSWORD` | Password de MySQL. | Vacio |
| `DB_NAME` | Base de datos. | `calsys_db` |
| `DB_PORT` | Puerto de MySQL. | `3306` |
| `JWT_SECRET` | Secreto para firmar tokens. | Requerido en ambientes reales |
| `JWT_EXPIRES_IN` | Vigencia del token. | `24h` |

## Criterios de aceptacion para cambios

- La aplicacion compila sin errores.
- El backend responde en `/api/health`.
- Las rutas afectadas devuelven codigos HTTP coherentes.
- No se agregan secretos al repositorio.
- La documentacion se mantiene actualizada cuando cambia el comportamiento.

## Riesgos conocidos

- La configuracion actual del cliente HTTP usa una URL base fija. Para despliegues, conviene parametrizarla con variables de entorno de Vite.
- No hay suite automatizada de pruebas backend/frontend en el repositorio.
- La integridad de los calculos depende de que la estructura de MySQL coincida con las rutas actuales.
