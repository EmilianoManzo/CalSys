```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: []
}
```

### 2. Crea `.env`:
```
VITE_API_URL=http://localhost:3000/api
```

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "calsys",
  "compatibility_date": "2026-06-10",
  "observability": {
    "enabled": true
  },
  "assets": {
    "directory": "CalSys-JS"
  },
  "compatibility_flags": [
    "nodejs_compat"
  ]
}

```

```json
{
  "name": "calsys-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "mysql2": "^3.2.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3"
  }
}

```

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit

# Copy source code
COPY src ./src

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["node", "src/server.js"]

```

```env
PORT=3000
NODE_ENV=development

DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=change_me_locally
DB_NAME=CalSysJS
DB_PORT=3306
DB_CONNECT_TIMEOUT_MS=10000
DB_SSL=false

JWT_SECRET=local_development_secret_for_calsys_change_this_before_deploying_1234567890
JWT_EXPIRES_IN=15m
JWT_ISSUER=calsys-api
JWT_AUDIENCE=calsys-web

CORS_ORIGIN=http://localhost:5173

TRUST_PROXY=false

```

```json
{
  "build": {
    "builder": "dockerfile",
    "dockerfile": "backend/Dockerfile"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyMaxRetries": 10,
    "restartPolicyWindowMs": 600000,
    "healthcheckPath": "/api/health"
  }
}

```

## Cambios recientes - Maestro dashboard mobile

- Se corrigio el error de transformacion de Vite en `CalSys-JS/src/components/PartialGradesTable.jsx` envolviendo correctamente la rama JSX de escritorio.
- Se agrego `CalSys-JS/src/hooks/useIsMobile.js` para alternar vistas moviles en componentes del dashboard.
- `PartialGradesTable.jsx` ahora mantiene Handsontable en escritorio y renderiza tarjetas moviles por alumno, con inputs por actividad, validacion visual, conteo de cambios y barra fija para guardar.
- `AttendanceTable.jsx` fue restaurado y extendido: conserva la tabla de escritorio y agrega vista movil con selector de fecha, tarjeta por alumno, acciones Presente/Ausente, gesto horizontal, deshacer y guardado por lote con el endpoint existente.
- `MaestroDashboard.jsx` y `PartialManager.jsx` recibieron ajustes responsivos para nav, filtros, contenedor principal y tabs desplazables en pantallas pequenas.

```js
// Utilidades de validaciÃ³n y manejo de datos seguros

/**
 * Convierte un valor a nÃºmero de forma segura, retornando null si no es vÃ¡lido
 */
export const safeNumber = (value, defaultValue = null) => {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
};

/**
 * Convierte un valor a entero de forma segura
 */
export const safeInt = (value, defaultValue = null) => {
  const num = safeNumber(value);
  if (num === null) return defaultValue;
  return Math.floor(num);
};

/**
 * Valida que un ID sea un nÃºmero positivo
 */
export const validateId = (id, fieldName = 'ID') => {
  const num = safeInt(id);
  if (num === null || num <= 0) {
    throw new Error(`${fieldName} debe ser un nÃºmero positivo`);
  }
  return num;
};

/**
 * Valida formato de email bÃ¡sico
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    throw new Error('Email es requerido');
  }
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254) {
    throw new Error('Email es demasiado largo');
  }
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(normalized)) {
    throw new Error('Formato de email invÃ¡lido');
  }
  return normalized;
};

/**
 * Valida formato de matrÃ­cula
 */
export const validateMatricula = (matricula) => {
  if (!matricula || typeof matricula !== 'string') {
    throw new Error('MatrÃ­cula es requerida');
  }
  const trimmed = matricula.trim();
  if (trimmed.length === 0) {
    throw new Error('MatrÃ­cula no puede estar vacÃ­a');
  }
  return trimmed;
};

/**
 * Valida que un string no estÃ© vacÃ­o
 */
export const validateNonEmptyString = (value, fieldName = 'Valor') => {
  if (!value || typeof value !== 'string') {
    throw new Error(`${fieldName} es requerido`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldName} no puede estar vacÃ­o`);
  }
  return trimmed;
};

/**
 * Valida que un valor estÃ© en un array de opciones permitidas
 */
export const validateEnum = (value, allowedValues, fieldName = 'Valor') => {
  if (!allowedValues.includes(value)) {
    throw new Error(`${fieldName} debe ser uno de: ${allowedValues.join(', ')}`);
  }
  return value;
};

/**
 * Realiza divisiÃ³n de forma segura, evitando divisiÃ³n por cero
 */
export const safeDivision = (numerator, denominator, defaultValue = 0) => {
  const num = safeNumber(numerator, 0);
  const den = safeNumber(denominator, 0);
  if (den === 0) return defaultValue;
  return num / den;
};

/**
 * Calcula promedio de forma segura, manejando arrays vacÃ­os y valores nulos
 */
export const safeAverage = (values, defaultValue = null) => {
  if (!Array.isArray(values) || values.length === 0) {
    return defaultValue;
  }
  const validNumbers = values
    .map(v => safeNumber(v))
    .filter(n => n !== null);
  
  if (validNumbers.length === 0) {
    return defaultValue;
  }
  
  const sum = validNumbers.reduce((acc, val) => acc + val, 0);
  return sum / validNumbers.length;
};

/**
 * Valida que un array no estÃ© vacÃ­o
 */
export const validateNonEmptyArray = (array, fieldName = 'Array') => {
  if (!Array.isArray(array)) {
    throw new Error(`${fieldName} debe ser un array`);
  }
  if (array.length === 0) {
    throw new Error(`${fieldName} no puede estar vacÃ­o`);
  }
  return array;
};

/**
 * Obtiene valor de objeto de forma segura con optional chaining
 */
export const safeGet = (obj, path, defaultValue = null) => {
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result === null || result === undefined) {
      return defaultValue;
    }
    result = result[key];
  }
  
  return result === null || result === undefined ? defaultValue : result;
};

/**
 * Valida parÃ¡metros requeridos en un objeto
 */
export const validateRequiredParams = (params, requiredFields) => {
  const missing = requiredFields.filter(field => {
    const value = params[field];
    return value === null || value === undefined || value === '';
  });

  if (missing.length > 0) {
    throw new Error(`Faltan parÃ¡metros requeridos: ${missing.join(', ')}`);
  }

  return true;
};

/**
 * Valida que un string no exceda una longitud mÃ¡xima
 */
export const validateMaxLength = (value, maxLength, fieldName = 'Valor') => {
  if (!value || typeof value !== 'string') {
    throw new Error(`${fieldName} es requerido`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldName} no puede estar vacÃ­o`);
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} no puede exceder ${maxLength} caracteres`);
  }
  return trimmed;
};

/**
 * Valida cÃ³digo de materia (mÃ¡ximo 50 caracteres)
 */
export const validateSubjectCode = (code, max = 50) => {
  return validateMaxLength(code, max, 'CÃ³digo de materia');
};

/**
 * Valida cÃ³digo de semestre (mÃ¡ximo 50 caracteres)
 */
export const validateSemesterCode = (code, max = 50) => {
  return validateMaxLength(code, max, 'Semestre');
};

```

```js
/**
 * Returns students enrolled in a teacher's class context (final_grades).
 * groupCode: string or null/empty for "sin grupo" (NULL group_code rows).
 */
export async function getEnrolledStudents(db, { teacherId, semester, subject, groupCode }) {
  const group = groupCode && String(groupCode).trim() !== '' ? groupCode : null;
  const [students] = await db.query(
    `SELECT DISTINCT s.matricula, s.first_name, s.last_name
     FROM students s
     INNER JOIN final_grades fg ON fg.student_matricula = s.matricula
     WHERE s.status = 'active'
       AND fg.teacher_id = ?
       AND fg.semester_code = ?
       AND fg.subject_code = ?
       AND (fg.group_code <=> ?)
     ORDER BY s.last_name, s.first_name`,
    [teacherId, semester, subject, group]
  );
  return students || [];
}

/**
 * Returns matriculas only (for bulk save loops).
 */
export async function getEnrolledMatriculas(db, { teacherId, semester, subject, groupCode }) {
  const students = await getEnrolledStudents(db, { teacherId, semester, subject, groupCode });
  return students.map((s) => s.matricula);
}

```

```js
function normalizeGroupCode(groupCode) {
  return groupCode && String(groupCode).trim() !== '' ? String(groupCode).trim() : null;
}

/**
 * Deletes one teacher assignment (subject + semester + group) and related grade/attendance data.
 */
export async function deleteAsignacion(conn, { subjectCode, teacherId, semesterCode, groupCode }) {
  const group = normalizeGroupCode(groupCode);

  const [grades] = await conn.query(
    `SELECT id FROM final_grades
     WHERE subject_code = ? AND teacher_id = ? AND semester_code = ? AND (group_code <=> ?)`,
    [subjectCode, teacherId, semesterCode, group]
  );

  const gradeIds = (grades || []).map((g) => g.id);
  if (gradeIds.length > 0) {
    const ph = gradeIds.map(() => '?').join(',');
    await conn.query(`DELETE FROM grade_custom_values WHERE grade_id IN (${ph})`, gradeIds);
  }

  await conn.query(
    `DELETE FROM final_grades
     WHERE subject_code = ? AND teacher_id = ? AND semester_code = ? AND (group_code <=> ?)`,
    [subjectCode, teacherId, semesterCode, group]
  );

  await conn.query(
    `DELETE FROM partial_grades
     WHERE subject_code = ? AND teacher_id = ? AND semester_code = ? AND (group_code <=> ?)`,
    [subjectCode, teacherId, semesterCode, group]
  );

  await conn.query(
    `DELETE FROM partial_columns_config
     WHERE subject_code = ? AND teacher_id = ? AND semester_code = ? AND (group_code <=> ?)`,
    [subjectCode, teacherId, semesterCode, group]
  );

  await conn.query(
    `DELETE FROM grade_columns_config
     WHERE subject_code = ? AND teacher_id = ? AND semester_code = ? AND (group_code <=> ?)`,
    [subjectCode, teacherId, semesterCode, group]
  );

  const [dates] = await conn.query(
    `SELECT id FROM attendance_dates
     WHERE teacher_id = ? AND semester_code = ? AND subject_code = ? AND (group_code <=> ?)`,
    [teacherId, semesterCode, subjectCode, group]
  );

  if (dates && dates.length > 0) {
    const dateIds = dates.map((d) => d.id);
    const ph = dateIds.map(() => '?').join(',');
    await conn.query(`DELETE FROM attendance_records WHERE date_id IN (${ph})`, dateIds);
    await conn.query(`DELETE FROM attendance_dates WHERE id IN (${ph})`, dateIds);
  }
}

/**
 * Deletes all enrollment/grade data for a subject across teachers (before removing catalog entry).
 */
export async function deleteAllSubjectData(conn, subjectCode) {
  const [grades] = await conn.query('SELECT id FROM final_grades WHERE subject_code = ?', [subjectCode]);
  const gradeIds = (grades || []).map((g) => g.id);
  if (gradeIds.length > 0) {
    const ph = gradeIds.map(() => '?').join(',');
    await conn.query(`DELETE FROM grade_custom_values WHERE grade_id IN (${ph})`, gradeIds);
  }

  await conn.query('DELETE FROM final_grades WHERE subject_code = ?', [subjectCode]);
  await conn.query('DELETE FROM partial_grades WHERE subject_code = ?', [subjectCode]);
  await conn.query('DELETE FROM partial_columns_config WHERE subject_code = ?', [subjectCode]);
  await conn.query('DELETE FROM grade_columns_config WHERE subject_code = ?', [subjectCode]);

  const [dates] = await conn.query('SELECT id FROM attendance_dates WHERE subject_code = ?', [subjectCode]);
  if (dates && dates.length > 0) {
    const dateIds = dates.map((d) => d.id);
    const ph = dateIds.map(() => '?').join(',');
    await conn.query(`DELETE FROM attendance_records WHERE date_id IN (${ph})`, dateIds);
    await conn.query(`DELETE FROM attendance_dates WHERE id IN (${ph})`, dateIds);
  }
}

/**
 * Removes all grade/attendance rows for one student (before deleting the student row).
 */
export async function deleteStudentRecords(conn, matricula) {
  const [grades] = await conn.query('SELECT id FROM final_grades WHERE student_matricula = ?', [matricula]);
  const gradeIds = (grades || []).map((g) => g.id);
  if (gradeIds.length > 0) {
    const ph = gradeIds.map(() => '?').join(',');
    await conn.query(`DELETE FROM grade_custom_values WHERE grade_id IN (${ph})`, gradeIds);
  }
  await conn.query('DELETE FROM attendance_records WHERE student_matricula = ?', [matricula]);
  await conn.query('DELETE FROM partial_grades WHERE student_matricula = ?', [matricula]);
  await conn.query('DELETE FROM final_grades WHERE student_matricula = ?', [matricula]);
}

/**
 * Removes all teaching data for one teacher user (before deleting the user row).
 */
export async function deleteTeacherRecords(conn, teacherId) {
  const [grades] = await conn.query('SELECT id FROM final_grades WHERE teacher_id = ?', [teacherId]);
  const gradeIds = (grades || []).map((g) => g.id);
  if (gradeIds.length > 0) {
    const ph = gradeIds.map(() => '?').join(',');
    await conn.query(`DELETE FROM grade_custom_values WHERE grade_id IN (${ph})`, gradeIds);
  }

  const [dates] = await conn.query('SELECT id FROM attendance_dates WHERE teacher_id = ?', [teacherId]);
  if (dates && dates.length > 0) {
    const dateIds = dates.map((d) => d.id);
    const ph = dateIds.map(() => '?').join(',');
    await conn.query(`DELETE FROM attendance_records WHERE date_id IN (${ph})`, dateIds);
    await conn.query(`DELETE FROM attendance_dates WHERE id IN (${ph})`, dateIds);
  }

  await conn.query('DELETE FROM partial_grades WHERE teacher_id = ?', [teacherId]);
  await conn.query('DELETE FROM partial_columns_config WHERE teacher_id = ?', [teacherId]);
  await conn.query('DELETE FROM grade_columns_config WHERE teacher_id = ?', [teacherId]);
  await conn.query('DELETE FROM final_grades WHERE teacher_id = ?', [teacherId]);
}

```

```js
const store = new Map();

export async function cacheAside(key, ttlMs, loader) {
  const cached = store.get(key);
  const currentTime = Date.now();
  if (cached && cached.expiresAt > currentTime) {
    return cached.value;
  }

  const value = await loader();
  store.set(key, {
    value,
    expiresAt: currentTime + ttlMs
  });
  return value;
}

export function invalidateCache(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

export function setCacheControl(res, directive = 'private, no-store') {
  res.set('Cache-Control', directive);
}

```

```js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './config/database.js';
import authRoutes from './routes/auth.routes.js';
import gradesRoutes from './routes/grades.routes.js';
import columnsRoutes from './routes/columns.routes.js';
import adminRoutes from './routes/admin.routes.js';
import partialsRoutes from './routes/partials.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import {
  authenticateToken,
  configuredOrigins,
  enforceScopedAccess,
  genericError,
  requireRoles,
  requireJsonBody,
  sanitizeRequest,
  securityHeaders,
  verifyCsrf,
  verifyOrigin
} from './middleware/security.js';
import { apiRateLimiter, authRateLimiter, enforceAuthLockout, globalRateLimiter } from './middleware/rateLimit.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
const corsOrigins = configuredOrigins();

app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido'));
  },
  credentials: true
}));
app.use(securityHeaders);
app.use(requireJsonBody);
app.use(express.json({ limit: '100kb' }));
app.use(sanitizeRequest);
app.use(globalRateLimiter);
app.use((req, res, next) => {
  res.charset = 'utf-8';
  next();
});

app.get('/', (req, res) => {
  res.json({ message: 'ðŸŽ“ Calsys API', version: '1.0.0', status: 'running' });
});

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'OK', database: 'connected' });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ status: 'ERROR', database: 'disconnected' });
  }
});

app.use('/api/auth/login', authRateLimiter, enforceAuthLockout);
app.use('/api/auth', authRoutes);

const protectedRoute = [authenticateToken, verifyOrigin, verifyCsrf, enforceScopedAccess, apiRateLimiter];
app.use('/api/grades', protectedRoute, gradesRoutes);
app.use('/api/columns', protectedRoute, requireRoles('director', 'maestro'), columnsRoutes);
app.use('/api/admin', protectedRoute, requireRoles('director'), adminRoutes);
app.use('/api/partials', protectedRoute, requireRoles('director', 'maestro'), partialsRoutes);
app.use('/api/attendance', protectedRoute, attendanceRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled request error:', err);
  res.status(500).json(genericError('Error interno del servidor'));
});

const server = app.listen(PORT, () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Calsys Backend: http://localhost:${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  }
});

async function shutdown(reason, error) {
  if (error) {
    console.error(reason, error);
  } else {
    console.warn(reason);
  }

  server.close(async () => {
    try {
      await db.end();
      process.exit(error ? 1 : 0);
    } catch (closeError) {
      console.error('Error closing database pool:', closeError);
      process.exit(1);
    }
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM received'));
process.on('SIGINT', () => shutdown('SIGINT received'));
process.on('unhandledRejection', (reason) => shutdown('Unhandled rejection', reason));
process.on('uncaughtException', (error) => shutdown('Uncaught exception', error));

```

```js
import express from 'express';
import db from '../config/database.js';
import { sendServerError } from '../middleware/security.js';
import { validateId, validateMatricula, safeNumber, safeDivision, safeAverage } from '../utils/validation.js';
import { getEnrolledStudents } from '../utils/enrolledStudents.js';

const router = express.Router();
const EXAMEN_FINAL_PARTIAL_ID = 4;
const CALIFICACION_FINAL_PARTIAL_ID = 5;
const SPECIAL_PARTIALS_AVG_NAME = 'Promedio de Parciales';
const SPECIAL_EXAMEN_FINAL_NAME = 'CalificaciÃ³n Examen Final';
const FINAL_SPECIAL_COLUMN_NAMES = new Set([SPECIAL_PARTIALS_AVG_NAME, SPECIAL_EXAMEN_FINAL_NAME]);

function canonicalFinalSpecialName(name = '') {
  const raw = String(name).toLowerCase();
  const normalized = raw
    .replace(/Ã£Â¡|Ã¡/g, 'a')
    .replace(/Ã£Â©|Ã©/g, 'e')
    .replace(/Ã£Â­|Ã­/g, 'i')
    .replace(/Ã£Â³|Ã³/g, 'o')
    .replace(/Ã£Âº|Ãº/g, 'u')
    .replace(/Ã£Â±|Ã±/g, 'n')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized.includes('promedio') && normalized.includes('parciales')) {
    return SPECIAL_PARTIALS_AVG_NAME;
  }
  if (normalized.includes('calificaci') && normalized.includes('examen') && normalized.includes('final')) {
    return SPECIAL_EXAMEN_FINAL_NAME;
  }
  return null;
}

function dedupeColumnsByName(columns = [], { normalizeFinalSpecials = false } = {}) {
  const seen = new Set();
  return columns.filter(col => {
    if (!col || !col.column_name) return false;
    const canonicalName = normalizeFinalSpecials ? canonicalFinalSpecialName(col.column_name) : null;
    const key = canonicalName || col.column_name;
    if (seen.has(key)) return false;
    if (canonicalName) col.column_name = canonicalName;
    seen.add(key);
    return true;
  });
}

function isFinalSpecialColumnName(name) {
  return FINAL_SPECIAL_COLUMN_NAMES.has(name) || canonicalFinalSpecialName(name) !== null;
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

async function ensureColumnsConfig(teacherId, semester, subject, group, partialId) {
  const validatedPartialId = validateId(partialId, 'Partial ID');
  if (validatedPartialId === CALIFICACION_FINAL_PARTIAL_ID) return;
  
  let query = `
    SELECT DISTINCT column_name
    FROM partial_grades
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = ?
      AND column_name != '__promedio'
  `;
  const params = [teacherId, semester, subject, validatedPartialId];
  if (group && group !== '') { query += ` AND group_code = ?`; params.push(group); }
  const [existing] = await db.query(query, params);
  if (!existing || existing.length === 0) return;

  let configQuery = `
    SELECT column_name FROM partial_columns_config
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = ?
      AND is_special = 0
  `;
  const configParams = [teacherId, semester, subject, validatedPartialId];
  if (group && group !== '') { configQuery += ` AND group_code = ?`; configParams.push(group); }
  const [configured] = await db.query(configQuery, configParams);
  const configuredNames = new Set(configured ? configured.map(c => c.column_name) : []);
  const missing = existing.filter(c => !configuredNames.has(c.column_name));
  if (missing.length === 0) return;

  const totalCols = existing.length;
  const equalWeight = parseFloat((100 / totalCols).toFixed(2));
  let orderQuery = `
    SELECT IFNULL(MAX(display_order), -1) as max_order
    FROM partial_columns_config
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = ?
  `;
  const orderParams = [teacherId, semester, subject, validatedPartialId];
  if (group && group !== '') { orderQuery += ` AND group_code = ?`; orderParams.push(group); }
  const [maxOrder] = await db.query(orderQuery, orderParams);
  let order = (maxOrder && maxOrder[0]) ? safeNumber(maxOrder[0].max_order, -1) + 1 : 0;

  for (const col of missing) {
    const insertParams = [teacherId, semester, subject, group, validatedPartialId, col.column_name, equalWeight, 10, order++];
    await db.query(`
      INSERT INTO partial_columns_config
      (teacher_id, semester_code, subject_code, group_code, partial_id, column_name, weight, max_value, display_order, is_special)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, insertParams);
  }
}

async function recalcPartialAverages(teacherId, semester, subject, group, partialId, connectionOrDb = db) {
  const validatedPartialId = validateId(partialId, 'Partial ID');
  if (validatedPartialId === CALIFICACION_FINAL_PARTIAL_ID) return;
  
  let deleteQuery = `
    DELETE FROM partial_grades
    WHERE column_name = '__promedio'
      AND teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = ?
  `;
  const deleteParams = [teacherId, semester, subject, validatedPartialId];
  if (group && group !== '') { deleteQuery += ` AND group_code = ?`; deleteParams.push(group); }
  else deleteQuery += ` AND group_code IS NULL`;
  await connectionOrDb.query(deleteQuery, deleteParams);

  let insertQuery = `
    INSERT INTO partial_grades (student_matricula, teacher_id, semester_code, subject_code, group_code, partial_id, column_name, value)
    SELECT 
      g.student_matricula,
      g.teacher_id,
      g.semester_code,
      g.subject_code,
      g.group_code,
      g.partial_id,
      '__promedio',
      ROUND(SUM((g.value / pc.max_value) * 10 * (pc.weight / 100)), 2)
    FROM partial_grades g
    JOIN partial_columns_config pc ON 
      pc.teacher_id = g.teacher_id 
      AND pc.semester_code = g.semester_code
      AND pc.subject_code = g.subject_code
      AND pc.partial_id = g.partial_id
      AND pc.column_name = g.column_name
      AND pc.is_special = 0
    WHERE g.teacher_id = ?
      AND g.semester_code = ?
      AND g.subject_code = ?
      AND g.partial_id = ?
      AND g.column_name != '__promedio'
  `;
  const insertParams = [teacherId, semester, subject, validatedPartialId];
  if (group && group !== '') {
    insertQuery += ` AND g.group_code = ?`;
    insertParams.push(group);
  } else {
    insertQuery += ` AND g.group_code IS NULL`;
  }
  insertQuery += ` GROUP BY g.student_matricula, g.teacher_id, g.semester_code, g.subject_code, g.group_code, g.partial_id`;
  await connectionOrDb.query(insertQuery, insertParams);
}

async function ensureFinalSpecialColumns(connectionOrDb, teacherId, semester, subject, group) {
  const expected = [
    { name: SPECIAL_PARTIALS_AVG_NAME, order: -2 },
    { name: SPECIAL_EXAMEN_FINAL_NAME, order: -1 }
  ];
  for (const special of expected) {
    let query = `
      SELECT id FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ? AND is_special = 1 AND column_name = ?
    `;
    const params = [teacherId, semester, subject, CALIFICACION_FINAL_PARTIAL_ID, special.name];
    if (group !== null && group !== undefined) {
      query += ` AND group_code = ?`;
      params.push(group);
    } else {
      query += ` AND group_code IS NULL`;
    }
    const [rows] = await connectionOrDb.query(query, params);
    if (!rows || rows.length === 0) {
      await connectionOrDb.query(`
        INSERT INTO partial_columns_config
        (teacher_id, semester_code, subject_code, group_code, partial_id, column_name, weight, max_value, display_order, is_special)
        VALUES (?, ?, ?, ?, ?, ?, 0, 10, ?, 1)
      `, [teacherId, semester, subject, group ?? null, CALIFICACION_FINAL_PARTIAL_ID, special.name, special.order]);
    } else if (rows.length > 1) {
      const duplicateIds = rows.slice(1).map(row => row.id);
      await connectionOrDb.query(`
        DELETE FROM partial_columns_config
        WHERE id IN (${duplicateIds.map(() => '?').join(',')})
      `, duplicateIds);
    }
  }
}

// ============================================
// RUTA: CONFIGURACIÃ“N
// ============================================
router.get('/config', async (req, res) => {
  try {
    let { teacherId, semester, subject, group, partialId } = req.query;
    if (!teacherId || !semester || !subject || !partialId) {
      return res.status(400).json({ error: 'Faltan parÃ¡metros' });
    }
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');
    const validatedPartialId = validateId(partialId, 'Partial ID');
    
    if (group === '') group = null;
    if (validatedPartialId !== CALIFICACION_FINAL_PARTIAL_ID) await ensureColumnsConfig(validatedTeacherId, semester, subject, group, validatedPartialId);

    let query = `
      SELECT * FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ? AND is_special = 0
    `;
    const params = [validatedTeacherId, semester, subject, validatedPartialId];
    if (group !== null) { query += ` AND group_code = ?`; params.push(group); }
    else query += ` AND group_code IS NULL`;
    query += ` ORDER BY display_order`;
    let [columns] = await db.query(query, params);
    columns = dedupeColumnsByName(columns || [], { normalizeFinalSpecials: validatedPartialId === CALIFICACION_FINAL_PARTIAL_ID });

    if (validatedPartialId === CALIFICACION_FINAL_PARTIAL_ID) {
      await ensureFinalSpecialColumns(db, validatedTeacherId, semester, subject, group);
      let specialQuery = `
        SELECT * FROM partial_columns_config
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ? AND is_special = 1
      `;
      const specialParams = [validatedTeacherId, semester, subject, validatedPartialId];
      if (group !== null) { specialQuery += ` AND group_code = ?`; specialParams.push(group); }
      else specialQuery += ` AND group_code IS NULL`;
      specialQuery += ` ORDER BY display_order`;
      const [special] = await db.query(specialQuery, specialParams);
      const specialColumns = dedupeColumnsByName(special || [], { normalizeFinalSpecials: true });
      const normalColumns = columns.filter(col => !isFinalSpecialColumnName(col.column_name));
      columns = [...specialColumns, ...normalColumns];
    }
    res.json({ columns: columns || [] });
  } catch (error) {
    console.error('Error en GET /config:', error);
    sendServerError(res);
  }
});

router.post('/config', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { teacherId, semester, subject, group, partialId, columns } = req.body;
    if (!teacherId || !semester || !subject || !partialId || !columns) {
      connection.release();
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');
    const validatedPartialId = validateId(partialId, 'Partial ID');
    const groupValue = (group === '' ? null : group);
    
    await connection.beginTransaction();

    let existingQuery = `
      SELECT column_name
      FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ? AND is_special = 0
    `;
    const existingParams = [validatedTeacherId, semester, subject, validatedPartialId];
    if (groupValue !== null) { existingQuery += ` AND group_code = ?`; existingParams.push(groupValue); }
    else existingQuery += ` AND group_code IS NULL`;
    const [existingColumns] = await connection.query(existingQuery, existingParams);

    const nextColumnNames = new Set(
      columns
        .filter(col => !col.is_special)
        .map(col => String(col.name || '').trim())
        .filter(name => name && !(validatedPartialId === CALIFICACION_FINAL_PARTIAL_ID && isFinalSpecialColumnName(name)))
    );
    const removedColumnNames = (existingColumns || [])
      .map(col => col.column_name)
      .filter(name => !nextColumnNames.has(name));

    if (removedColumnNames.length > 0) {
      let deleteGradesQuery = `
        DELETE FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ?
          AND column_name IN (${removedColumnNames.map(() => '?').join(',')})
      `;
      const deleteGradesParams = [validatedTeacherId, semester, subject, validatedPartialId, ...removedColumnNames];
      if (groupValue !== null) { deleteGradesQuery += ` AND group_code = ?`; deleteGradesParams.push(groupValue); }
      else deleteGradesQuery += ` AND group_code IS NULL`;
      await connection.query(deleteGradesQuery, deleteGradesParams);
    }

    let deleteQuery = `
      DELETE FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ? AND is_special = 0
    `;
    const deleteParams = [validatedTeacherId, semester, subject, validatedPartialId];
    if (groupValue !== null) { deleteQuery += ` AND group_code = ?`; deleteParams.push(groupValue); }
    else deleteQuery += ` AND group_code IS NULL`;
    await connection.query(deleteQuery, deleteParams);

    let order = 0;
    for (const col of columns) {
      if (col.is_special) continue;
      if (validatedPartialId === CALIFICACION_FINAL_PARTIAL_ID && isFinalSpecialColumnName(col.name)) continue;
      const weight = safeNumber(col.weight, 0);
      const maxValue = safeNumber(col.maxValue, 10);
      await connection.query(`
        INSERT INTO partial_columns_config
        (teacher_id, semester_code, subject_code, group_code, partial_id,
         column_name, weight, max_value, display_order, is_special)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `, [validatedTeacherId, semester, subject, groupValue, validatedPartialId,
          col.name, weight, maxValue, order++]);
    }

    if (validatedPartialId === CALIFICACION_FINAL_PARTIAL_ID) {
      await ensureFinalSpecialColumns(connection, validatedTeacherId, semester, subject, groupValue);
      const specialColumns = columns.filter(c => c.is_special === true);
      for (const specialCol of specialColumns) {
        const weight = safeNumber(specialCol.weight, 0);
        const maxValue = safeNumber(specialCol.maxValue, 10);
        let updateQuery = `
          UPDATE partial_columns_config
          SET weight = ?, max_value = ?
          WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
            AND partial_id = ? AND is_special = 1 AND column_name = ?
        `;
        const updateParams = [weight, maxValue,
          validatedTeacherId, semester, subject, validatedPartialId, specialCol.name];
        if (groupValue !== null) { updateQuery += ` AND group_code = ?`; updateParams.push(groupValue); }
        else updateQuery += ` AND group_code IS NULL`;
        await connection.query(updateQuery, updateParams);
      }
    }

    if (validatedPartialId !== CALIFICACION_FINAL_PARTIAL_ID) {
      await recalcPartialAverages(validatedTeacherId, semester, subject, groupValue, validatedPartialId, connection);
    }

    await connection.commit();
    connection.release();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    sendServerError(res);
  }
});

// ============================================
// RUTA: OBTENER CALIFICACIONES (CORREGIDA)
// ============================================
router.get('/grades', async (req, res) => {
  try {
    let { teacherId, semester, subject, group, partialId, studentMatricula } = req.query;
    if (!teacherId || !semester || !subject || !partialId) {
      return res.status(400).json({ error: 'Faltan parÃ¡metros' });
    }
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');
    const validatedPartialId = validateId(partialId, 'Partial ID');
    
    if (group === '') group = null;
    if (validatedPartialId !== CALIFICACION_FINAL_PARTIAL_ID) await ensureColumnsConfig(validatedTeacherId, semester, subject, group, validatedPartialId);

    // Obtener columnas reales
    let columnsQuery = `
      SELECT * FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ? AND is_special = 0
    `;
    const columnsParams = [validatedTeacherId, semester, subject, validatedPartialId];
    if (group !== null) { columnsQuery += ` AND group_code = ?`; columnsParams.push(group); }
    else columnsQuery += ` AND group_code IS NULL`;
    columnsQuery += ` ORDER BY display_order`;
    let [realColumns] = await db.query(columnsQuery, columnsParams);
    realColumns = dedupeColumnsByName(realColumns, { normalizeFinalSpecials: validatedPartialId === CALIFICACION_FINAL_PARTIAL_ID });
    let columns = [...realColumns];

    // Agregar columnas virtuales
    if (validatedPartialId !== CALIFICACION_FINAL_PARTIAL_ID) {
      columns.push({
        id: -2,
        column_name: 'ðŸ“Š Promedio Parcial',
        weight: 0,
        max_value: 10,
        display_order: 999,
        is_special: 0,
        is_virtual: true
      });
    }

    if (validatedPartialId === CALIFICACION_FINAL_PARTIAL_ID) {
      await ensureFinalSpecialColumns(db, validatedTeacherId, semester, subject, group);
      let specialQuery = `
        SELECT * FROM partial_columns_config
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ? AND is_special = 1
      `;
      const specialParams = [validatedTeacherId, semester, subject, validatedPartialId];
      if (group !== null) { specialQuery += ` AND group_code = ?`; specialParams.push(group); }
      else specialQuery += ` AND group_code IS NULL`;
      let [special] = await db.query(specialQuery, specialParams);

      const specialCols = dedupeColumnsByName(special || [], { normalizeFinalSpecials: true }).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      realColumns = realColumns.filter(col => !isFinalSpecialColumnName(col.column_name));
      const finalGlobalCol = {
        id: -3,
        column_name: 'ðŸŽ¯ CALIFICACIÃ“N FINAL GLOBAL',
        weight: 0,
        max_value: 10,
        display_order: 998,
        is_special: 0,
        is_virtual: true
      };
      columns = [...specialCols, ...realColumns, finalGlobalCol];
    }

    const students = await getEnrolledStudents(db, {
      teacherId: validatedTeacherId,
      semester,
      subject,
      groupCode: group
    });
    if (students.length === 0) return res.json({ grades: [], columns });

    const matList = students.map(s => s.matricula);
    const colNames = realColumns.map(c => c.column_name);
    let gradesData = [];

    if (realColumns.length > 0) {
      const placeholdersMat = matList.map(() => '?').join(',');
      const placeholdersCol = colNames.map(() => '?').join(',');
      let gradesQuery = `
        SELECT student_matricula, column_name, value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ?
          AND student_matricula IN (${placeholdersMat})
          AND column_name IN (${placeholdersCol})
      `;
      const gradesParams = [validatedTeacherId, semester, subject, validatedPartialId, ...matList, ...colNames];
      if (group !== null) { gradesQuery += ` AND group_code = ?`; gradesParams.push(group); }
      else gradesQuery += ` AND group_code IS NULL`;
      const [rows] = await db.query(gradesQuery, gradesParams);
      gradesData = rows;
    }

    // Para parciales normales: cargar __promedio
    if (validatedPartialId !== CALIFICACION_FINAL_PARTIAL_ID) {
      let promQuery = `
        SELECT student_matricula, value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ? AND column_name = '__promedio'
      `;
      const promParams = [validatedTeacherId, semester, subject, validatedPartialId];
      if (group !== null) { promQuery += ` AND group_code = ?`; promParams.push(group); }
      else promQuery += ` AND group_code IS NULL`;
      const [promRows] = await db.query(promQuery, promParams);
      const promMap = {};
      for (const row of promRows) promMap[row.student_matricula] = row.value;
      for (const student of students) {
        const avg = promMap[student.matricula];
        if (avg !== undefined && avg !== null) {
          gradesData.push({
            student_matricula: student.matricula,
            column_name: 'ðŸ“Š Promedio Parcial',
            value: avg
          });
        }
      }
    } else {
      // Para pestaÃ±a final global: calcular especiales y final global
      let promQuery = `
        SELECT student_matricula, partial_id, value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id IN (1,2,3) AND column_name = '__promedio'
      `;
      const promParams = [validatedTeacherId, semester, subject];
      if (group !== null) { promQuery += ` AND group_code = ?`; promParams.push(group); }
      else promQuery += ` AND group_code IS NULL`;
      const [promRows] = await db.query(promQuery, promParams);
      const promMap = {};
      for (const row of promRows) {
        if (!promMap[row.student_matricula]) promMap[row.student_matricula] = {};
        promMap[row.student_matricula][row.partial_id] = parseFloat(row.value);
      }

      let examQuery = `
        SELECT student_matricula, value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ? AND column_name = '__promedio'
      `;
      const examParams = [validatedTeacherId, semester, subject, EXAMEN_FINAL_PARTIAL_ID];
      if (group !== null) { examQuery += ` AND group_code = ?`; examParams.push(group); }
      else examQuery += ` AND group_code IS NULL`;
      const [examRows] = await db.query(examQuery, examParams);
      const examMap = {};
      for (const row of examRows) examMap[row.student_matricula] = safeNumber(row.value);

      const partialAvgSpecialCol = columns.find(c => c.is_special === 1 && c.column_name === SPECIAL_PARTIALS_AVG_NAME);
      const examFinalSpecialCol = columns.find(c => c.is_special === 1 && c.column_name === SPECIAL_EXAMEN_FINAL_NAME);
      const partialAvgWeight = partialAvgSpecialCol ? safeNumber(partialAvgSpecialCol.weight, 0) : 0;
      const examFinalWeight = examFinalSpecialCol ? safeNumber(examFinalSpecialCol.weight, 0) : 0;

      for (const student of students) {
        const p1 = promMap[student.matricula]?.[1];
        const p2 = promMap[student.matricula]?.[2];
        const p3 = promMap[student.matricula]?.[3];
        const valores = [p1, p2, p3].map(v => safeNumber(v)).filter(v => v !== null);
        let promedioEspecial = null;
        if (valores.length > 0) {
          promedioEspecial = safeAverage(valores);
          if (promedioEspecial !== null) {
            promedioEspecial = parseFloat(promedioEspecial.toFixed(2));
          }
        }

        let total = 0, pesoTotal = 0;
        for (const col of realColumns) {
          const grade = gradesData.find(g => g.student_matricula === student.matricula && g.column_name === col.column_name);
          const val = grade ? safeNumber(grade.value) : null;
          if (val !== null) {
            const w = safeNumber(col.weight, 0);
            const max = safeNumber(col.max_value, 10);
            if (max > 0) {
              total += safeDivision(val * 10, max, 0) * (w / 100);
              pesoTotal += w;
            }
          }
        }
        const examenFinalGrade = safeNumber(examMap[student.matricula]);
        if (promedioEspecial !== null && partialAvgWeight > 0) {
          total += safeDivision(promedioEspecial * 10, 10, 0) * (partialAvgWeight / 100);
          pesoTotal += partialAvgWeight;
        }
        if (examenFinalGrade !== null && examFinalWeight > 0) {
          total += safeDivision(examenFinalGrade * 10, 10, 0) * (examFinalWeight / 100);
          pesoTotal += examFinalWeight;
        }
        const finalGlobal = pesoTotal > 0 ? parseFloat(total.toFixed(2)) : null;
        if (finalGlobal !== null) {
          gradesData.push({
            student_matricula: student.matricula,
            column_name: 'ðŸŽ¯ CALIFICACIÃ“N FINAL GLOBAL',
            value: finalGlobal
          });
        }
        if (promedioEspecial !== null && partialAvgSpecialCol && !gradesData.find(g => g.student_matricula === student.matricula && g.column_name === partialAvgSpecialCol.column_name)) {
          gradesData.push({
            student_matricula: student.matricula,
            column_name: partialAvgSpecialCol.column_name,
            value: promedioEspecial
          });
        }
        if (examenFinalGrade !== null && examFinalSpecialCol && !gradesData.find(g => g.student_matricula === student.matricula && g.column_name === examFinalSpecialCol.column_name)) {
          gradesData.push({
            student_matricula: student.matricula,
            column_name: examFinalSpecialCol.column_name,
            value: examenFinalGrade
          });
        }
      }
    }

    const result = students.map(s => {
      const row = { matricula: s.matricula, nombre: `${s.first_name} ${s.last_name}` };
      columns.forEach(col => {
        const grade = gradesData.find(g => g.student_matricula === s.matricula && g.column_name === col.column_name);
        row[`col_${col.column_name}`] = grade ? grade.value : null;
      });
      return row;
    });
    res.json({ grades: result || [], columns: columns || [] });
  } catch (error) {
    console.error('Error en GET /grades:', error);
    sendServerError(res);
  }
});

// ============================================
// RUTA: GUARDAR CALIFICACIONES
// ============================================
router.post('/save-grades', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { teacherId, semester, subject, group, partialId, values } = req.body;
    if (!teacherId || !semester || !subject || !partialId || !values) {
      connection.release();
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');
    const validatedPartialId = validateId(partialId, 'Partial ID');
    const groupValue = (group === '' ? null : group);
    if (!Array.isArray(values)) {
      connection.release();
      return res.status(400).json({ error: 'values debe ser un arreglo' });
    }
    
    await connection.beginTransaction();
    let specialColumnNames = new Set();
    if (validatedPartialId === CALIFICACION_FINAL_PARTIAL_ID) {
      let specialQuery = `
        SELECT column_name
        FROM partial_columns_config
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ? AND is_special = 1
      `;
      const specialParams = [validatedTeacherId, semester, subject, validatedPartialId];
      if (groupValue !== null) { specialQuery += ` AND group_code = ?`; specialParams.push(groupValue); }
      else specialQuery += ` AND group_code IS NULL`;
      const [specialRows] = await connection.query(specialQuery, specialParams);
      specialColumnNames = new Set((specialRows || []).map(r => r.column_name));
    }

    for (const val of values) {
      const { matricula, columnName, value } = val;
      if (!columnName) continue;
      const validatedMatricula = validateMatricula(String(matricula || ''));
      if (validatedPartialId === CALIFICACION_FINAL_PARTIAL_ID && specialColumnNames.has(columnName)) continue;
      if (columnName === 'ðŸ“Š Promedio Parcial' || columnName === 'ðŸŽ¯ CALIFICACIÃ“N FINAL GLOBAL') continue;
      const safeValue = safeNumber(value);
      const insertParams = [validatedMatricula, validatedTeacherId, semester, subject, groupValue, validatedPartialId, columnName, safeValue];
      await connection.query(`
        INSERT INTO partial_grades (student_matricula, teacher_id, semester_code, subject_code, group_code, partial_id, column_name, value)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE value = VALUES(value)
      `, insertParams);
    }
    await connection.commit();
    connection.release();

    if (validatedPartialId !== CALIFICACION_FINAL_PARTIAL_ID) {
      setTimeout(() => {
        recalcPartialAverages(validatedTeacherId, semester, subject, groupValue, validatedPartialId).catch(err =>
          console.error('Error en recÃ¡lculo asÃ­ncrono:', err)
        );
      }, 100);
    }
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    sendServerError(res);
  }
});

export default router;

```

```js
import express from 'express';
import db from '../config/database.js';
import { sendServerError, logSecurityEvent } from '../middleware/security.js';
import { validateId, validateMatricula, safeNumber, safeDivision, safeAverage, validateSubjectCode, validateSemesterCode } from '../utils/validation.js';

const router = express.Router();
function allowRoles(req, res, roles) {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403).json({ error: 'Acceso no autorizado' });
    return false;
  }
  return true;
}

const EXAMEN_FINAL_PARTIAL_ID = 4;
const CALIFICACION_FINAL_PARTIAL_ID = 5;
const SPECIAL_PARTIALS_AVG_NAME = 'Promedio de Parciales';
const SPECIAL_EXAMEN_FINAL_NAME = 'CalificaciÃ³n Examen Final';

router.get('/teacher/subjects', async (req, res) => {
  try {
    if (!allowRoles(req, res, ['director', 'maestro'])) return;
    const { teacherId, semester } = req.query;
    if (!teacherId) return res.status(400).json({ error: 'Teacher ID requerido' });
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');
    
    let query = `
      SELECT DISTINCT 
        fg.subject_code,
        fg.semester_code,
        fg.group_code,
        COUNT(DISTINCT fg.student_matricula) as total_students
      FROM final_grades fg
      WHERE fg.teacher_id = ?
    `;
    const params = [validatedTeacherId];
    if (semester) { query += ` AND fg.semester_code = ?`; params.push(semester); }
    query += ` GROUP BY fg.subject_code, fg.semester_code, fg.group_code ORDER BY fg.subject_code`;
    const [subjects] = await db.query(query, params);
    res.json({ subjects: subjects || [] });
  } catch (error) {
    console.error('Error en /teacher/subjects:', error);
    sendServerError(res);
  }
});

router.get('/subject/groups', async (req, res) => {
  try {
    if (!allowRoles(req, res, ['director', 'maestro'])) return;
    const { teacherId, semester, subjectCode } = req.query;
    if (!teacherId || !semester || !subjectCode) {
      return res.status(400).json({ error: 'ParÃ¡metros incompletos' });
    }
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');
    
    const [groups] = await db.query(`
      SELECT DISTINCT group_code, COUNT(*) as total_students
      FROM final_grades
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ? AND group_code IS NOT NULL
      GROUP BY group_code
    `, [validatedTeacherId, semester, subjectCode]);
    res.json({ groups: groups || [] });
  } catch (error) {
    console.error('Error en /subject/groups:', error);
    sendServerError(res);
  }
});

// ============================================
// RUTAS PARA ALUMNOS
// ============================================

router.get('/student-subjects', async (req, res) => {
  try {
    if (!allowRoles(req, res, ['director', 'alumno'])) return;
    const { matricula } = req.query;
    if (!matricula) return res.status(400).json({ error: 'MatrÃ­cula requerida' });
    const validatedMatricula = validateMatricula(matricula);

    if (req.user.role === 'alumno' && req.user.matricula !== validatedMatricula) {
      logSecurityEvent(req, 'idor_attempt', { endpoint: '/student-subjects', attempted_matricula: validatedMatricula, user_matricula: req.user.matricula });
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    const [subjects] = await db.query(`
      SELECT DISTINCT subject_code, semester_code, group_code, teacher_id
      FROM final_grades
      WHERE student_matricula = ?
    `, [validatedMatricula]);

    res.json({ subjects: subjects || [] });
  } catch (error) {
    console.error('Error en /student-subjects:', error);
    sendServerError(res);
  }
});

router.get('/student-grades', async (req, res) => {
  try {
    if (!allowRoles(req, res, ['director', 'alumno'])) return;
    const { matricula, parcialId, subjectCode } = req.query;
    if (!matricula || !parcialId || !subjectCode) return res.status(400).json({ error: 'ParÃ¡metros incompletos' });

    const validatedMatricula = validateMatricula(matricula);
    const validatedParcialId = validateId(parcialId, 'Parcial ID');

    if (req.user.role === 'alumno' && req.user.matricula !== validatedMatricula) {
      logSecurityEvent(req, 'idor_attempt', { endpoint: '/student-grades', attempted_matricula: validatedMatricula, user_matricula: req.user.matricula });
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    // Obtener contexto (teacher, semester, group)
    const [context] = await db.query(`
      SELECT teacher_id, semester_code, group_code
      FROM final_grades
      WHERE student_matricula = ? AND subject_code = ?
      LIMIT 1
    `, [validatedMatricula, subjectCode]);

    if (context.length === 0) return res.json({ columns: [], grades: [], promedio: null });

    const { teacher_id, semester_code, group_code } = context[0];

    // Obtener columnas
    let queryCols = `
      SELECT column_name as name, weight, max_value as \`maxValue\`, is_special as \`isSpecial\`
      FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ? AND partial_id = ? AND is_special = 0
    `;
    const paramsCols = [teacher_id, semester_code, subjectCode, validatedParcialId];
    if (group_code) { queryCols += ` AND group_code = ?`; paramsCols.push(group_code); }
    else { queryCols += ` AND group_code IS NULL`; }
    queryCols += ` ORDER BY display_order`;

    const [columns] = await db.query(queryCols, paramsCols);

    // Obtener calificaciones del estudiante
    let queryGrades = `
      SELECT column_name as columnName, value
      FROM partial_grades
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ? AND partial_id = ? AND student_matricula = ?
    `;
    const paramsGrades = [teacher_id, semester_code, subjectCode, validatedParcialId, validatedMatricula];
    if (group_code) { queryGrades += ` AND group_code = ?`; paramsGrades.push(group_code); }
    else { queryGrades += ` AND group_code IS NULL`; }

    const [grades] = await db.query(queryGrades, paramsGrades);

    // Obtener promedio de forma segura
    const promedioObj = grades.find(g => g.columnName === '__promedio');
    const promedio = promedioObj ? safeNumber(promedioObj.value) : null;

    res.json({ columns: columns || [], grades: grades || [], promedio });
  } catch (error) {
    console.error('Error en /student-grades:', error);
    sendServerError(res);
  }
});

router.get('/student-final', async (req, res) => {
  try {
    if (!allowRoles(req, res, ['director', 'alumno'])) return;
    const { matricula, subjectCode } = req.query;
    if (!matricula || !subjectCode) return res.status(400).json({ error: 'ParÃ¡metros incompletos' });
    const parcialId = CALIFICACION_FINAL_PARTIAL_ID;

    const validatedMatricula = validateMatricula(matricula);

    if (req.user.role === 'alumno' && req.user.matricula !== validatedMatricula) {
      logSecurityEvent(req, 'idor_attempt', { endpoint: '/student-final', attempted_matricula: validatedMatricula, user_matricula: req.user.matricula });
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    // Obtener contexto
    const [context] = await db.query(`
      SELECT teacher_id, semester_code, group_code
      FROM final_grades
      WHERE student_matricula = ? AND subject_code = ?
      LIMIT 1
    `, [validatedMatricula, subjectCode]);

    if (context.length === 0) return res.json({ columns: [], grades: [], promedio: null });

    const { teacher_id, semester_code, group_code } = context[0];

    // Obtener columnas
    let queryCols = `
      SELECT column_name as name, weight, max_value as \`maxValue\`, is_special as \`isSpecial\`
      FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ? AND partial_id = ?
    `;
    const paramsCols = [teacher_id, semester_code, subjectCode, parcialId];
    if (group_code) { queryCols += ` AND group_code = ?`; paramsCols.push(group_code); }
    else { queryCols += ` AND group_code IS NULL`; }
    queryCols += ` ORDER BY is_special DESC, display_order ASC`;

    const [columns] = await db.query(queryCols, paramsCols);

    // Obtener calificaciones de este estudiante para el parcial 4
    let queryGrades = `
      SELECT column_name as columnName, value
      FROM partial_grades
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ? AND partial_id = ? AND student_matricula = ?
    `;
    const paramsGrades = [teacher_id, semester_code, subjectCode, parcialId, validatedMatricula];
    if (group_code) { queryGrades += ` AND group_code = ?`; paramsGrades.push(group_code); }
    else { queryGrades += ` AND group_code IS NULL`; }
    
    const [gradesData] = await db.query(queryGrades, paramsGrades);
    let finalGrades = [...(gradesData || [])];

    // Necesitamos calcular el Promedio de Parciales si la columna especial existe
    const specialParciales = columns.find(c => c.isSpecial === 1 && c.name === SPECIAL_PARTIALS_AVG_NAME);
    const specialExamenFinal = columns.find(c => c.isSpecial === 1 && c.name === SPECIAL_EXAMEN_FINAL_NAME);
    const specialParcialesWeight = specialParciales ? safeNumber(specialParciales.weight, 0) : 0;
    const specialExamenFinalWeight = specialExamenFinal ? safeNumber(specialExamenFinal.weight, 0) : 0;
    
    let promedioEspecial = null;
    if (specialParciales) {
      let promQuery = `
        SELECT partial_id, value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ? 
          AND partial_id IN (1,2,3) AND column_name = '__promedio' AND student_matricula = ?
      `;
      const promParams = [teacher_id, semester_code, subjectCode, validatedMatricula];
      if (group_code) { promQuery += ` AND group_code = ?`; promParams.push(group_code); }
      else { promQuery += ` AND group_code IS NULL`; }
      
      const [promRows] = await db.query(promQuery, promParams);
      if (promRows && promRows.length > 0) {
        const validValues = promRows.map(r => safeNumber(r.value)).filter(v => v !== null);
        if (validValues.length > 0) {
          promedioEspecial = safeAverage(validValues);
          if (promedioEspecial !== null) {
            promedioEspecial = parseFloat(promedioEspecial.toFixed(2));
            finalGrades.push({
              columnName: specialParciales.name,
              value: promedioEspecial
            });
          }
        }
      }
    }

    let examenFinalGrade = null;
    if (specialExamenFinal) {
      let examQuery = `
        SELECT value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ? AND column_name = '__promedio' AND student_matricula = ?
      `;
      const examParams = [teacher_id, semester_code, subjectCode, EXAMEN_FINAL_PARTIAL_ID, validatedMatricula];
      if (group_code) { examQuery += ` AND group_code = ?`; examParams.push(group_code); }
      else { examQuery += ` AND group_code IS NULL`; }

      const [examRows] = await db.query(examQuery, examParams);
      const rawExam = examRows && examRows.length > 0 ? safeNumber(examRows[0].value) : null;
      if (rawExam !== null) {
        examenFinalGrade = parseFloat(rawExam.toFixed(2));
        finalGrades.push({
          columnName: specialExamenFinal.name,
          value: examenFinalGrade
        });
      }
    }

    // Calcular Promedio Final Global de forma segura
    let total = 0, pesoTotal = 0;
    for (const col of columns) {
      if (col.isSpecial === 1) continue;
      const g = finalGrades.find(g => g.columnName === col.name);
      const val = g ? safeNumber(g.value) : null;
      if (val !== null) {
        const w = safeNumber(col.weight, 0);
        const max = safeNumber(col.maxValue, 10);
        if (max > 0) {
          total += safeDivision(val * 10, max, 0) * (w / 100);
          pesoTotal += w;
        }
      }
    }
    if (promedioEspecial !== null && specialParcialesWeight > 0) {
      total += safeDivision(promedioEspecial * 10, 10, 0) * (specialParcialesWeight / 100);
      pesoTotal += specialParcialesWeight;
    }
    if (examenFinalGrade !== null && specialExamenFinalWeight > 0) {
      total += safeDivision(examenFinalGrade * 10, 10, 0) * (specialExamenFinalWeight / 100);
      pesoTotal += specialExamenFinalWeight;
    }
    
    const finalGlobal = pesoTotal > 0 ? parseFloat(total.toFixed(2)) : null;

    res.json({ columns: columns || [], grades: finalGrades, promedio: finalGlobal });
  } catch (error) {
    console.error('Error en /student-final:', error);
    sendServerError(res);
  }
});

export default router;

```

```js
import express from 'express';
import db from '../config/database.js';
import { sendServerError } from '../middleware/security.js';
import { validateId, safeNumber, safeDivision, safeAverage } from '../utils/validation.js';
import { getEnrolledStudents, getEnrolledMatriculas } from '../utils/enrolledStudents.js';

const router = express.Router();

// Obtener configuraciÃ³n de columnas (incluye la especial "Promedio de Parciales")
router.get('/config', async (req, res) => {
  try {
    const { teacherId, semester, subject, group } = req.query;
    if (!teacherId || !semester || !subject) {
      return res.status(400).json({ error: 'Parametros incompletos' });
    }
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');
    
    const [columns] = await db.query(`
      SELECT * FROM grade_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND (group_code = ? OR group_code IS NULL)
      ORDER BY display_order, id
    `, [validatedTeacherId, semester, subject, group]);
    res.json({ columns: columns || [] });
  } catch (error) {
    console.error('Error obteniendo configuracion:', error);
    sendServerError(res);
  }
});

// Guardar configuraciÃ³n de columnas
router.post('/config', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { teacherId, semester, subject, group, columns } = req.body;
    if (!teacherId || !semester || !subject || !columns) {
      connection.release();
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');
    
    await connection.beginTransaction();
    // Eliminar columnas no especiales existentes
    await connection.query(`
      DELETE FROM grade_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
        AND is_special = 0
    `, [validatedTeacherId, semester, subject, group, group]);
    // Insertar nuevas columnas personalizadas
    let order = 0;
    for (const col of columns) {
      if (col.is_special) continue;
      const weight = safeNumber(col.weight, 0);
      const maxValue = safeNumber(col.maxValue, 10);
      await connection.query(`
        INSERT INTO grade_columns_config 
        (teacher_id, semester_code, subject_code, group_code, 
         column_name, column_type, max_value, weight, is_required, display_order, is_special)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `, [validatedTeacherId, semester, subject, group,
          col.name, col.type || 'numeric', maxValue,
          weight, col.required || false, order++]);
    }
    // Actualizar columna especial "Promedio de Parciales"
    const specialCol = columns.find(c => c.is_special === true);
    if (specialCol) {
      const weight = safeNumber(specialCol.weight, 0);
      const maxValue = safeNumber(specialCol.maxValue, 10);
      await connection.query(`
        UPDATE grade_columns_config
        SET weight = ?, max_value = ?, is_required = ?
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
          AND is_special = 1
      `, [weight, maxValue, specialCol.required ? 1 : 0,
          validatedTeacherId, semester, subject, group, group]);
    } else {
      // Crear especial por defecto si no existe
      const [existing] = await connection.query(`
        SELECT id FROM grade_columns_config
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
          AND is_special = 1
      `, [validatedTeacherId, semester, subject, group, group]);
      if (existing.length === 0) {
        await connection.query(`
          INSERT INTO grade_columns_config
          (teacher_id, semester_code, subject_code, group_code, column_name, column_type, max_value, weight, is_required, display_order, is_special)
          VALUES (?, ?, ?, ?, 'Promedio de Parciales', 'numeric', 10, 0, 0, -1, 1)
        `, [validatedTeacherId, semester, subject, group]);
      }
    }
    await connection.commit();
    connection.release();
    res.json({ success: true, message: 'Configuracion guardada' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error guardando configuracion:', error);
    sendServerError(res, 'Error al guardar configuracion');
  }
});

// Obtener calificaciones con valores personalizados + parciales
router.get('/with-custom', async (req, res) => {
  try {
    const { teacherId, semester, subject, group } = req.query;
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');

    // ConfiguraciÃ³n de columnas
    const [columns] = await db.query(`
      SELECT * FROM grade_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND (group_code = ? OR group_code IS NULL)
      ORDER BY display_order
    `, [validatedTeacherId, semester, subject, group]);

    const groupNorm = group && String(group).trim() !== '' ? group : null;
    const enrolled = await getEnrolledStudents(db, {
      teacherId: validatedTeacherId,
      semester,
      subject,
      groupCode: groupNorm
    });
    if (enrolled.length === 0) {
      return res.json({ grades: [], columns: columns || [] });
    }
    const matPlaceholders = enrolled.map(() => '?').join(',');
    const [grades] = await db.query(`
      SELECT 
        s.matricula, s.first_name, s.last_name,
        fg.id as grade_id, fg.final_grade, fg.status,
        fg.parcial_1, fg.parcial_2, fg.parcial_3, fg.ordinario,
        fg.promedio_parciales
      FROM students s
      INNER JOIN final_grades fg ON fg.student_matricula = s.matricula
        AND fg.teacher_id = ?
        AND fg.semester_code = ?
        AND fg.subject_code = ?
        AND (fg.group_code <=> ?)
      WHERE s.status = 'active' AND s.matricula IN (${matPlaceholders})
      ORDER BY s.last_name, s.first_name
    `, [validatedTeacherId, semester, subject, groupNorm, ...enrolled.map((s) => s.matricula)]);

    const gradeIds = grades.map(g => g.grade_id).filter(Boolean);
    let customValues = [];
    if (gradeIds.length > 0) {
      const placeholders = gradeIds.map(() => '?').join(',');
      [customValues] = await db.query(`
        SELECT gcv.grade_id, gcv.column_config_id, gcv.value
        FROM grade_custom_values gcv
        WHERE gcv.grade_id IN (${placeholders})
      `, gradeIds);
    }

    const result = grades.map(g => {
      const row = {
        matricula: g.matricula,
        nombre: `${g.first_name} ${g.last_name}`,
        grade_id: g.grade_id,
        final_grade: g.final_grade,
        status: g.status,
        parcial_1: g.parcial_1,
        parcial_2: g.parcial_2,
        parcial_3: g.parcial_3,
        ordinario: g.ordinario,
        promedio_parciales: g.promedio_parciales
      };
      columns.forEach(col => {
        const value = customValues.find(v => v.grade_id === g.grade_id && v.column_config_id === col.id);
        row[`col_${col.id}`] = value ? value.value : null;
      });
      return row;
    });

    res.json({ grades: result || [], columns: columns || [] });
  } catch (error) {
    console.error('Error obteniendo calificaciones:', error);
    sendServerError(res);
  }
});

// Calcular calificaciÃ³n final
function calcularFinal(columns, valores, promedioParciales, ordinario) {
  let total = 0, pesoTotal = 0;

  // Promedio de parciales (columna especial)
  const special = columns.find(c => c.is_special === 1);
  if (special && promedioParciales !== null) {
    const safeProm = safeNumber(promedioParciales);
    const weight = safeNumber(special.weight, 0);
    if (safeProm !== null) {
      total += (safeProm * (weight / 100));
      pesoTotal += weight;
    }
  }

  // Columnas personalizadas
  for (const col of columns) {
    if (col.column_type === 'numeric' && !col.is_special) {
      const val = valores[col.id];
      if (val !== null && val !== undefined && val !== '') {
        const v = safeNumber(val);
        if (v !== null) {
          const max = safeNumber(col.max_value, 10);
          const w = safeNumber(col.weight, 0);
          if (max > 0) {
            total += safeDivision(v * 10, max, 0) * (w / 100);
            pesoTotal += w;
          }
        }
      }
    }
  }

  // EvaluaciÃ³n final (ordinario) - se puede ponderar si se agrega como columna personalizada
  // Por ahora, si el profesor quiere ponderar ordinario, debe crearlo como columna adicional.

  return pesoTotal > 0 ? parseFloat(total.toFixed(2)) : null;
}

// Guardar calificaciones (parciales, ordinario, personalizadas)
router.post('/save-custom', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { values, parciales, ordinarios, semester, subject, group, teacherId } = req.body;
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');

    await connection.beginTransaction();

    // Obtener configuraciÃ³n de columnas
    const [columns] = await connection.query(`
      SELECT * FROM grade_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND (group_code = ? OR group_code IS NULL)
    `, [validatedTeacherId, semester, subject, group]);
    const allowedColumnIds = new Set((columns || []).map((col) => String(col.id)));

    // Agrupar valores personalizados por estudiante
    const valoresPorEstudiante = {};
    if (values && Array.isArray(values)) {
      for (const val of values) {
        if (!valoresPorEstudiante[val.matricula]) valoresPorEstudiante[val.matricula] = {};
        valoresPorEstudiante[val.matricula][val.columnId] = val.value;
      }
    }

    const groupNorm = group && String(group).trim() !== '' ? group : null;
    const matriculas = await getEnrolledMatriculas(connection, {
      teacherId: validatedTeacherId,
      semester,
      subject,
      groupCode: groupNorm
    });

    if (!matriculas || matriculas.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'No hay estudiantes inscritos en esta clase' });
    }

    for (const matricula of matriculas) {

      let [grades] = await connection.query(`
        SELECT id, parcial_1, parcial_2, parcial_3, ordinario, promedio_parciales
        FROM final_grades
        WHERE student_matricula = ? AND semester_code = ? AND subject_code = ?
          AND teacher_id = ? AND (group_code <=> ?)
      `, [matricula, semester, subject, validatedTeacherId, groupNorm]);

      let gradeId;
      let p1 = null, p2 = null, p3 = null, ord = null, prom = null;

      if (grades.length === 0) {
        continue;
      } else {
        gradeId = grades[0].id;
        p1 = grades[0].parcial_1;
        p2 = grades[0].parcial_2;
        p3 = grades[0].parcial_3;
        ord = grades[0].ordinario;
        prom = grades[0].promedio_parciales;
      }

      // Actualizar parciales si se enviaron
      if (parciales && parciales[matricula]) {
        p1 = parciales[matricula].parcial_1 !== undefined ? safeNumber(parciales[matricula].parcial_1) : p1;
        p2 = parciales[matricula].parcial_2 !== undefined ? safeNumber(parciales[matricula].parcial_2) : p2;
        p3 = parciales[matricula].parcial_3 !== undefined ? safeNumber(parciales[matricula].parcial_3) : p3;
        await connection.query(`
          UPDATE final_grades SET parcial_1 = ?, parcial_2 = ?, parcial_3 = ?
          WHERE id = ?
        `, [p1, p2, p3, gradeId]);
      }

      // Actualizar ordinario si se enviÃ³
      if (ordinarios && ordinarios[matricula] !== undefined) {
        ord = safeNumber(ordinarios[matricula]);
        await connection.query(`
          UPDATE final_grades SET ordinario = ? WHERE id = ?
        `, [ord, gradeId]);
      }

      // Calcular promedio de parciales de forma segura
      if (p1 !== null && p2 !== null && p3 !== null) {
        const validParciales = [p1, p2, p3].filter(p => p !== null);
        if (validParciales.length === 3) {
          prom = safeAverage(validParciales);
          if (prom !== null) {
            await connection.query(`
              UPDATE final_grades SET promedio_parciales = ? WHERE id = ?
            `, [prom, gradeId]);
          }
        }
      }

      // Guardar valores personalizados
      const valores = valoresPorEstudiante[matricula] || {};
      for (const [colId, valor] of Object.entries(valores)) {
        if (!allowedColumnIds.has(String(colId))) continue;
        await connection.query(`
          INSERT INTO grade_custom_values (grade_id, column_config_id, value)
          VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)
        `, [gradeId, colId, valor.toString()]);
      }

      // Calcular calificaciÃ³n final
      const finalGrade = calcularFinal(columns, valores, prom, ord);
      let status = 'in_progress';
      if (finalGrade !== null) status = finalGrade >= 6 ? 'passed' : 'failed';

      await connection.query(`
        UPDATE final_grades SET final_grade = ?, status = ? WHERE id = ?
      `, [finalGrade, status, gradeId]);
    }

    await connection.commit();
    connection.release();
    res.json({ success: true, message: 'Calificaciones guardadas' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error guardando:', error);
    sendServerError(res, 'Error al guardar calificaciones');
  }
});

export default router;

```

```js
import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../config/database.js';
import { authenticateToken, createCsrfToken, logSecurityEvent, signAuthToken } from '../middleware/security.js';
import { clearAuthFailures, recordAuthFailure } from '../middleware/rateLimit.js';
import { validateEnum, validateNonEmptyString } from '../utils/validation.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Faltan datos (username, password, role)' });
    }

    const validatedUsername = validateNonEmptyString(username, 'Usuario');
    const validatedRole = validateEnum(role, ['director', 'maestro', 'alumno'], 'Rol');

    let user = null;
    let userRole = validatedRole;

    if (validatedRole === 'alumno') {
      const [rows] = await db.query(
        'SELECT matricula as id, matricula as username, first_name, last_name, email, password_hash, status, must_change_password FROM students WHERE matricula = ?',
        [validatedUsername]
      );
      if (rows.length > 0 && rows[0].status === 'active') {
        user = rows[0];
      }
    } else {
      const [rows] = await db.query(
        'SELECT id, username, first_name, last_name, email, password_hash, role, is_active, must_change_password FROM users WHERE username = ? AND role = ?',
        [validatedUsername, validatedRole]
      );
      if (rows.length > 0 && rows[0].is_active === 1) {
        user = rows[0];
        userRole = rows[0].role;
      }
    }

    if (!user) {
      recordAuthFailure(validatedUsername, validatedRole);
      logSecurityEvent(req, 'login_failed', { username: validatedUsername, requestedRole: validatedRole });
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const isValid = await bcrypt.compare(String(password), user.password_hash);
    if (!isValid) {
      recordAuthFailure(validatedUsername, validatedRole);
      logSecurityEvent(req, 'login_failed', { username: validatedUsername, requestedRole: validatedRole });
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }
    clearAuthFailures(validatedUsername, validatedRole);
    logSecurityEvent(req, 'login_success', { userId: user.id, requestedRole: validatedRole });

    const csrfToken = createCsrfToken();
    const token = signAuthToken({
      ...user,
      role: userRole,
      matricula: validatedRole === 'alumno' ? user.id : undefined
    });

    res.json({
      token,
      csrfToken,
      user: {
        id: user.id,
        username: user.username,
        role: userRole,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        matricula: validatedRole === 'alumno' ? user.id : undefined,
        mustChangePassword: Boolean(user.must_change_password)
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Completa todos los campos' });
    }

    const password = validateNonEmptyString(newPassword, 'Nueva contrasena');
    if (password.length < 8) {
      return res.status(400).json({ error: 'La nueva contrasena debe tener al menos 8 caracteres' });
    }
    if (password !== String(confirmPassword)) {
      return res.status(400).json({ error: 'Las contrasenas no coinciden' });
    }
    if (password === String(currentPassword)) {
      return res.status(400).json({ error: 'La nueva contrasena debe ser diferente a la actual' });
    }

    const isStudent = req.user.role === 'alumno';
    const table = isStudent ? 'students' : 'users';
    const idColumn = isStudent ? 'matricula' : 'id';
    const selectUserSql = isStudent
      ? 'SELECT matricula as id, matricula as username, first_name, last_name, email, password_hash, must_change_password FROM students WHERE matricula = ?'
      : 'SELECT id, username, first_name, last_name, email, password_hash, role, must_change_password FROM users WHERE id = ?';
    const [rows] = await db.query(selectUserSql, [isStudent ? req.user.matricula : req.user.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = rows[0];
    const isCurrentValid = await bcrypt.compare(String(currentPassword), user.password_hash);
    if (!isCurrentValid) {
      logSecurityEvent(req, 'change_password_failed', { reason: 'invalid_current_password' });
      return res.status(401).json({ error: 'La contrasena actual no es correcta' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.query(
      `UPDATE ${table} SET password_hash = ?, must_change_password = 0 WHERE ${idColumn} = ?`,
      [passwordHash, user.id]
    );

    const updatedUser = {
      ...user,
      role: isStudent ? 'alumno' : user.role,
      matricula: isStudent ? user.id : undefined,
      must_change_password: 0
    };
    const csrfToken = createCsrfToken();
    const token = signAuthToken(updatedUser);

    logSecurityEvent(req, 'change_password_success', { userId: user.id });
    res.json({
      token,
      csrfToken,
      user: {
        id: user.id,
        username: user.username,
        role: updatedUser.role,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        matricula: isStudent ? user.id : undefined,
        mustChangePassword: false
      }
    });
  } catch (error) {
    console.error('Error cambiando contrasena:', error);
    res.status(500).json({ error: 'Error al cambiar contrasena' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { csrfToken, iat, exp, iss, aud, ...user } = req.user;
    res.json({ user });
  } catch {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

export default router;

```

```js
import express from 'express';
import db from '../config/database.js';
import { sendServerError } from '../middleware/security.js';
import { validateId, validateMatricula, safeNumber, safeDivision } from '../utils/validation.js';
import { getEnrolledStudents } from '../utils/enrolledStudents.js';

const router = express.Router();
function allowRoles(req, res, roles) {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403).json({ error: 'Acceso no autorizado' });
    return false;
  }
  return true;
}

// GET /dates
router.get('/dates', async (req, res) => {
  try {
    if (!allowRoles(req, res, ['director', 'maestro'])) return;
    let { teacherId, semester, subject, group } = req.query;
    if (!teacherId || !semester || !subject) return res.status(400).json({ error: 'Faltan parÃ¡metros' });
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');
    
    let query = `
      SELECT id, DATE_FORMAT(class_date, '%Y-%m-%d') as class_date 
      FROM attendance_dates
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
    `;
    const params = [validatedTeacherId, semester, subject];
    if (group && group !== '') { query += ` AND group_code = ?`; params.push(group); }
    else query += ` AND group_code IS NULL`;
    query += ` ORDER BY class_date ASC`;

    const [dates] = await db.query(query, params);
    res.json({ dates: dates || [] });
  } catch (error) {
    console.error('Error obteniendo fechas:', error);
    sendServerError(res);
  }
});

// POST /dates
router.post('/dates', async (req, res) => {
  try {
    if (!allowRoles(req, res, ['director', 'maestro'])) return;
    let { teacherId, semester, subject, group, date } = req.body;
    if (!teacherId || !semester || !subject || !date) return res.status(400).json({ error: 'Faltan parÃ¡metros' });
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');
    const groupValue = group === '' ? null : group;

    await db.query(`
      INSERT INTO attendance_dates (teacher_id, semester_code, subject_code, group_code, class_date)
      VALUES (?, ?, ?, ?, ?)
    `, [validatedTeacherId, semester, subject, groupValue, date]);

    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Esa fecha ya estÃ¡ registrada.' });
    }
    console.error('Error agregando fecha:', error);
    sendServerError(res, 'Error al agregar fecha');
  }
});

// DELETE /dates/:id
router.delete('/dates/:id', async (req, res) => {
  try {
    if (!allowRoles(req, res, ['director', 'maestro'])) return;
    const validatedId = validateId(req.params.id, 'ID de fecha');
    await db.query(`DELETE FROM attendance_dates WHERE id = ?`, [validatedId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando fecha:', error);
    sendServerError(res, 'Error al eliminar fecha');
  }
});

// GET /records
router.get('/records', async (req, res) => {
  try {
    if (!allowRoles(req, res, ['director', 'maestro'])) return;
    let { teacherId, semester, subject, group } = req.query;
    if (!teacherId || !semester || !subject) return res.status(400).json({ error: 'Faltan parÃ¡metros' });
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');

    const groupCode = group && group !== '' ? group : null;
    const students = await getEnrolledStudents(db, {
      teacherId: validatedTeacherId,
      semester,
      subject,
      groupCode
    });

    // 2. Obtener fechas de la clase
    let qDates = `
      SELECT id, DATE_FORMAT(class_date, '%Y-%m-%d') as class_date 
      FROM attendance_dates
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
    `;
    const paramsDates = [validatedTeacherId, semester, subject];
    if (group && group !== '') { qDates += ` AND group_code = ?`; paramsDates.push(group); }
    else qDates += ` AND group_code IS NULL`;
    qDates += ` ORDER BY class_date ASC`;

    const [dates] = await db.query(qDates, paramsDates);
    if (!dates || dates.length === 0) return res.json({ dates: [], records: [] });

    // 3. Obtener registros
    const dateIds = dates.map(d => d.id);
    const placeholders = dateIds.map(() => '?').join(',');
    const [recordsData] = await db.query(`
      SELECT student_matricula, date_id, is_present
      FROM attendance_records
      WHERE date_id IN (${placeholders})
    `, [...dateIds]);

    // Formatear
    const result = students.map(s => {
      const row = { matricula: s.matricula, nombre: `${s.first_name} ${s.last_name}` };
      let attended = 0;
      dates.forEach(d => {
        const r = recordsData.find(x => x.student_matricula === s.matricula && x.date_id === d.id);
        row[`date_${d.id}`] = r ? r.is_present : null;
        if (r && r.is_present) attended++;
      });
      row.total_attended = attended;
      row.total_classes = dates.length;
      row.percentage = dates.length > 0 ? safeDivision((attended / dates.length) * 100, 1, 0) : 0;
      return row;
    });

    res.json({ dates: dates || [], records: result || [] });
  } catch (error) {
    console.error('Error obteniendo registros:', error);
    sendServerError(res);
  }
});

// POST /records
router.post('/records', async (req, res) => {
  const connection = await db.getConnection();
  try {
    if (!allowRoles(req, res, ['director', 'maestro'])) {
      connection.release();
      return;
    }
    const { updates } = req.body; // updates: [{ matricula, dateId, isPresent }]
    if (!updates || !Array.isArray(updates)) {
      connection.release();
      return res.status(400).json({ error: 'Datos invÃ¡lidos' });
    }

    await connection.beginTransaction();
    for (const u of updates) {
      if (!u.matricula || !u.dateId) continue;
      const validatedMatricula = validateMatricula(u.matricula);
      const validatedDateId = validateId(u.dateId, 'ID de fecha');
      const isPresent = u.isPresent ? 1 : 0;
      await connection.query(`
        INSERT INTO attendance_records (student_matricula, date_id, is_present)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE is_present = VALUES(is_present)
      `, [validatedMatricula, validatedDateId, isPresent]);
    }
    await connection.commit();
    connection.release();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error guardando registros:', error);
    sendServerError(res, 'Error al guardar registros');
  }
});

// GET /student
router.get('/student', async (req, res) => {
  try {
    if (!allowRoles(req, res, ['director', 'alumno'])) return;
    const { matricula, subjectCode } = req.query;
    if (!matricula || !subjectCode) return res.status(400).json({ error: 'ParÃ¡metros incompletos' });
    const validatedMatricula = validateMatricula(matricula);

    // Obtener contexto (teacher, semester, group)
    const [context] = await db.query(`
      SELECT teacher_id, semester_code, group_code
      FROM final_grades
      WHERE student_matricula = ? AND subject_code = ?
      LIMIT 1
    `, [validatedMatricula, subjectCode]);

    if (!context || context.length === 0) return res.json({ dates: [], summary: { total: 0, attended: 0, percentage: 0 } });

    const { teacher_id, semester_code, group_code } = context[0];

    // Obtener fechas
    let qDates = `
      SELECT id, DATE_FORMAT(class_date, '%Y-%m-%d') as class_date 
      FROM attendance_dates
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
    `;
    const paramsDates = [teacher_id, semester_code, subjectCode];
    if (group_code) { qDates += ` AND group_code = ?`; paramsDates.push(group_code); }
    else qDates += ` AND group_code IS NULL`;
    qDates += ` ORDER BY class_date ASC`;

    const [dates] = await db.query(qDates, paramsDates);
    if (!dates || dates.length === 0) return res.json({ dates: [], summary: { total: 0, attended: 0, percentage: 0 } });

    const dateIds = dates.map(d => d.id);
    const placeholders = dateIds.map(() => '?').join(',');

    // Obtener registros
    const [records] = await db.query(`
      SELECT date_id, is_present
      FROM attendance_records
      WHERE student_matricula = ? AND date_id IN (${placeholders})
    `, [validatedMatricula, ...dateIds]);

    const recordsMap = {};
    records.forEach(r => { recordsMap[r.date_id] = r.is_present; });

    let attended = 0;
    const finalDates = dates.map(d => {
      const present = recordsMap[d.id] !== undefined ? recordsMap[d.id] : null;
      if (present) attended++;
      return {
        id: d.id,
        date: d.class_date,
        present: present
      };
    });

    const summary = {
      total: dates.length,
      attended,
      percentage: dates.length > 0 ? safeDivision((attended / dates.length) * 100, 1, 0) : 0
    };

    res.json({ dates: finalDates || [], summary });
  } catch (error) {
    console.error('Error obteniendo asistencia del estudiante:', error);
    sendServerError(res);
  }
});

export default router;

```

```js
import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../config/database.js';
import { sendServerError } from '../middleware/security.js';
import { cacheAside, invalidateCache, setCacheControl } from '../utils/cache.js';
import { validateId, validateMatricula, validateEmail, validateNonEmptyString, validateEnum, safeNumber, safeAverage } from '../utils/validation.js';
import { deleteAsignacion, deleteAllSubjectData, deleteStudentRecords, deleteTeacherRecords } from '../utils/deleteAssignment.js';

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const [totalStudents] = await db.query(`SELECT COUNT(*) as total FROM students WHERE status = 'active'`);
    const [totalTeachers] = await db.query(`SELECT COUNT(*) as total FROM users WHERE role IN ('maestro', 'director') AND status = 'active' AND is_active = 1`);
    const [totalSubjects] = await db.query(`SELECT COUNT(DISTINCT subject_code) as total FROM final_grades`);
    const [totalGrades] = await db.query(`SELECT COUNT(*) as total FROM partial_grades WHERE column_name NOT IN ('__promedio', 'ðŸ“Š Promedio Parcial', 'ðŸŽ¯ CALIFICACIÃ“N FINAL GLOBAL')`);
    
    // Promedio general usando valores reales de partial_grades
    const [avgResult] = await db.query(`
      SELECT ROUND(AVG((pg.value / pc.max_value) * 10), 2) as promedio
      FROM partial_grades pg
      JOIN partial_columns_config pc ON pg.column_name = pc.column_name 
        AND pg.teacher_id = pc.teacher_id 
        AND pg.semester_code = pc.semester_code 
        AND pg.subject_code = pc.subject_code
        AND pg.partial_id = pc.partial_id
      WHERE pg.value IS NOT NULL AND pg.column_name != '__promedio'
    `);
    const average = safeNumber(avgResult[0]?.promedio, 0);

    // Estudiantes con al menos una calificaciÃ³n de parcial (tienen __promedio)
    const [studentsWithGrades] = await db.query(`SELECT COUNT(DISTINCT student_matricula) as total FROM partial_grades WHERE column_name = '__promedio' AND value IS NOT NULL`);
    const totalStudentsWithGrades = studentsWithGrades[0].total;

    // ClasificaciÃ³n por promedio final (promedio de los tres parciales)
    const [gradeStatus] = await db.query(`
      SELECT 
        student_matricula,
        AVG(value) as promedio_final
      FROM partial_grades
      WHERE column_name = '__promedio' AND value IS NOT NULL
      GROUP BY student_matricula
    `);
    let passed = 0, failed = 0;
    for (const row of gradeStatus) {
      const prom = safeNumber(row.promedio_final);
      if (prom !== null && prom >= 6) passed++;
      else if (prom !== null && prom < 6) failed++;
    }
    const totalStudentsCount = safeNumber(totalStudents[0]?.total, 0);
    let inProgress = totalStudentsCount - (passed + failed);
    if (inProgress < 0) inProgress = 0;

    // EstadÃ­sticas por materia (promedio por materia)
    const [subjectStats] = await db.query(`
      SELECT 
        pg.subject_code,
        COUNT(DISTINCT pg.student_matricula) as estudiantes,
        ROUND(AVG((pg.value / pc.max_value) * 10), 2) as promedio
      FROM partial_grades pg
      JOIN partial_columns_config pc ON pg.column_name = pc.column_name 
        AND pg.teacher_id = pc.teacher_id 
        AND pg.semester_code = pc.semester_code 
        AND pg.subject_code = pc.subject_code
        AND pg.partial_id = pc.partial_id
      WHERE pg.column_name != '__promedio' AND pg.value IS NOT NULL
      GROUP BY pg.subject_code
      ORDER BY promedio DESC
    `);

    res.json({
      students: safeNumber(totalStudents[0]?.total, 0),
      teachers: safeNumber(totalTeachers[0]?.total, 0),
      subjects: safeNumber(totalSubjects[0]?.total, 0),
      grades: safeNumber(totalGrades[0]?.total, 0),
      average: average,
      passed: passed,
      failed: failed,
      inProgress: inProgress,
      subjectStats: subjectStats || []
    });
  } catch (error) {
    console.error('Error obteniendo estadÃ­sticas:', error);
    sendServerError(res, 'Error en el servidor');
  }
});

// ============================================
// ENDPOINTS PARA MATERIAS (CRUD COMPLETO)
// ============================================
router.get('/materias', async (req, res) => {
  try {
    const materias = await cacheAside('admin:materias', 60_000, async () => {
      const [rows] = await db.query(`
        SELECT m.*, 
          COUNT(DISTINCT fg.student_matricula) as total_estudiantes,
          COUNT(DISTINCT fg.teacher_id) as total_maestros
        FROM materias m
        LEFT JOIN final_grades fg ON m.subject_code = fg.subject_code
        GROUP BY m.id
        ORDER BY m.subject_code
      `);
      return rows || [];
    });
    setCacheControl(res, 'private, max-age=60');
    res.json({ materias: materias || [] });
  } catch (error) {
    console.error('Error obteniendo materias:', error);
    sendServerError(res, 'Error en el servidor');
  }
});

router.post('/materias', async (req, res) => {
  try {
    const { subject_code, subject_name, credits, description } = req.body;
    if (!subject_code || !subject_name) {
      return res.status(400).json({ error: 'CÃ³digo y nombre son requeridos' });
    }
    const validatedCode = validateNonEmptyString(subject_code, 'CÃ³digo');
    const validatedName = validateNonEmptyString(subject_name, 'Nombre');
    const validatedCredits = safeNumber(credits, 5);
    
    const [existing] = await db.query('SELECT id FROM materias WHERE subject_code = ?', [validatedCode.toUpperCase()]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'La materia ya existe' });
    }
    await db.query(`
      INSERT INTO materias (subject_code, subject_name, credits, description)
      VALUES (?, ?, ?, ?)
    `, [validatedCode.toUpperCase(), validatedName, validatedCredits, description || null]);
    invalidateCache('admin:materias');
    res.json({ success: true, message: 'Materia creada exitosamente' });
  } catch (error) {
    console.error('Error creando materia:', error);
    sendServerError(res, 'Error al crear materia');
  }
});

router.put('/materias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedId = validateId(id, 'ID de materia');
    const { subject_name, credits, description } = req.body;
    const validatedName = validateNonEmptyString(subject_name, 'Nombre');
    const validatedCredits = safeNumber(credits, 5);
    
    await db.query(`
      UPDATE materias 
      SET subject_name = ?, credits = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [validatedName, validatedCredits, description, validatedId]);
    invalidateCache('admin:materias');
    res.json({ success: true, message: 'Materia actualizada' });
  } catch (error) {
    console.error('Error actualizando materia:', error);
    sendServerError(res, 'Error al actualizar materia');
  }
});

router.delete('/materias/:id', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const validatedId = validateId(req.params.id, 'ID de materia');
    const [materia] = await connection.query('SELECT subject_code FROM materias WHERE id = ?', [validatedId]);
    if (!materia || materia.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Materia no encontrada' });
    }
    const subjectCode = materia[0].subject_code;
    await connection.beginTransaction();
    await deleteAllSubjectData(connection, subjectCode);
    await connection.query('DELETE FROM materias WHERE id = ?', [validatedId]);
    await connection.commit();
    connection.release();
    invalidateCache('admin:materias');
    res.json({ success: true, message: 'Materia y todas sus asignaciones eliminadas' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error eliminando materia:', error);
    sendServerError(res, 'Error al eliminar materia');
  }
});

router.get('/profesores', async (req, res) => {
  try {
    const profesores = await cacheAside('admin:profesores', 60_000, async () => {
      const [rows] = await db.query(`
        SELECT id, username, first_name, last_name, email, role
        FROM users 
        WHERE role IN ('maestro', 'director')
        AND status = 'active'
        AND is_active = 1
        ORDER BY first_name, last_name
      `);
      return rows || [];
    });
    setCacheControl(res, 'private, max-age=60');
    res.json({ profesores: profesores || [] });
  } catch (error) {
    console.error('Error obteniendo profesores:', error);
    sendServerError(res, 'Error en el servidor');
  }
});

router.get('/grupos', async (req, res) => {
  try {
    const grupos = await cacheAside('admin:grupos', 60_000, async () => {
      const [rows] = await db.query(`
        SELECT group_code
        FROM student_groups
        WHERE is_active = 1
        ORDER BY group_code
      `);
      return rows || [];
    });
    setCacheControl(res, 'private, max-age=60');
    res.json({ grupos: grupos ? grupos.map(g => g.group_code) : [] });
  } catch (error) {
    console.error('Error obteniendo grupos:', error);
    sendServerError(res, 'Error en el servidor');
  }
});

// ============================================
// ENDPOINTS PARA GRUPOS DE ESTUDIANTES
// ============================================
router.get('/student-groups', async (req, res) => {
  try {
    const groups = await cacheAside('admin:student-groups', 30_000, async () => {
      const [rows] = await db.query(`
        SELECT sg.id, sg.group_code, sg.name, sg.description, sg.is_active, sg.created_at,
          COUNT(CASE WHEN s.status = 'active' THEN s.matricula END) AS member_count
        FROM student_groups sg
        LEFT JOIN students s ON s.group_id = sg.id
        GROUP BY sg.id
        ORDER BY sg.group_code
      `);
      return rows || [];
    });
    setCacheControl(res, 'private, max-age=30');
    res.json({ groups: groups || [] });
  } catch (error) {
    console.error('Error obteniendo grupos de estudiantes:', error);
    sendServerError(res, 'Error en el servidor');
  }
});

router.post('/student-groups', async (req, res) => {
  try {
    const { groupCode, name, description } = req.body;
    const validatedCode = validateNonEmptyString(groupCode, 'CÃ³digo de grupo').toUpperCase();
    const validatedName = validateNonEmptyString(name, 'Nombre');
    const [existing] = await db.query('SELECT id FROM student_groups WHERE group_code = ?', [validatedCode]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'El cÃ³digo de grupo ya existe' });
    }
    const [result] = await db.query(
      `INSERT INTO student_groups (group_code, name, description) VALUES (?, ?, ?)`,
      [validatedCode, validatedName, description || null]
    );
    invalidateCache('admin:grupos');
    invalidateCache('admin:student-groups');
    res.json({ success: true, id: result.insertId, message: 'Grupo creado' });
  } catch (error) {
    console.error('Error creando grupo:', error);
    sendServerError(res, 'Error al crear grupo');
  }
});

router.put('/student-groups/:id', async (req, res) => {
  try {
    const validatedId = validateId(req.params.id, 'ID de grupo');
    const { name, description, isActive } = req.body;
    const validatedName = validateNonEmptyString(name, 'Nombre');
    await db.query(
      `UPDATE student_groups SET name = ?, description = ?, is_active = ? WHERE id = ?`,
      [validatedName, description || null, isActive !== false ? 1 : 0, validatedId]
    );
    if (isActive === false) {
      await db.query('UPDATE students SET group_id = NULL WHERE group_id = ?', [validatedId]);
    }
    invalidateCache('admin:grupos');
    invalidateCache('admin:student-groups');
    res.json({ success: true, message: 'Grupo actualizado' });
  } catch (error) {
    console.error('Error actualizando grupo:', error);
    sendServerError(res, 'Error al actualizar grupo');
  }
});

router.delete('/student-groups/:id', async (req, res) => {
  try {
    const validatedId = validateId(req.params.id, 'ID de grupo');
    await db.query('UPDATE students SET group_id = NULL WHERE group_id = ?', [validatedId]);
    await db.query('UPDATE student_groups SET is_active = 0 WHERE id = ?', [validatedId]);
    invalidateCache('admin:grupos');
    invalidateCache('admin:student-groups');
    res.json({ success: true, message: 'Grupo desactivado' });
  } catch (error) {
    console.error('Error desactivando grupo:', error);
    sendServerError(res, 'Error al desactivar grupo');
  }
});

router.put('/student-groups/:id/members', async (req, res) => {
  try {
    const validatedId = validateId(req.params.id, 'ID de grupo');
    const { matriculas } = req.body;
    if (!Array.isArray(matriculas)) {
      return res.status(400).json({ error: 'matriculas debe ser un arreglo' });
    }
    const [group] = await db.query('SELECT id FROM student_groups WHERE id = ? AND is_active = 1', [validatedId]);
    if (!group || group.length === 0) {
      return res.status(404).json({ error: 'Grupo no encontrado o inactivo' });
    }
    const validatedMatriculas = [];
    for (const m of matriculas) {
      if (m && String(m).trim()) validatedMatriculas.push(validateMatricula(String(m).trim()));
    }
    await db.query('UPDATE students SET group_id = NULL WHERE group_id = ?', [validatedId]);
    if (validatedMatriculas.length > 0) {
      const placeholders = validatedMatriculas.map(() => '?').join(',');
      await db.query(
        `UPDATE students SET group_id = ? WHERE matricula IN (${placeholders}) AND status = 'active'`,
        [validatedId, ...validatedMatriculas]
      );
    }
    invalidateCache('admin:student-groups');
    res.json({ success: true, message: `Grupo actualizado con ${validatedMatriculas.length} alumnos` });
  } catch (error) {
    console.error('Error asignando miembros:', error);
    sendServerError(res, 'Error al asignar miembros');
  }
});

async function resolveGroupId(groupId) {
  if (groupId === null || groupId === undefined || groupId === '') return null;
  const validatedId = validateId(groupId, 'ID de grupo');
  const [rows] = await db.query('SELECT id FROM student_groups WHERE id = ? AND is_active = 1', [validatedId]);
  if (!rows || rows.length === 0) throw new Error('Grupo no encontrado o inactivo');
  return validatedId;
}

router.post('/asignar-materia', async (req, res) => {
  try {
    const { subject_code, teacher_id, semester_code, group_code } = req.body;
    if (!subject_code || !teacher_id || !semester_code) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }
    const validatedTeacherId = validateId(teacher_id, 'Teacher ID');
    
    const [materia] = await db.query('SELECT subject_code FROM materias WHERE subject_code = ?', [subject_code]);
    if (!materia || materia.length === 0) {
      return res.status(400).json({ error: 'La materia no existe en el catÃ¡logo' });
    }
    const [existing] = await db.query(`
      SELECT id FROM final_grades 
      WHERE subject_code = ? AND teacher_id = ? AND semester_code = ? AND group_code = ?
      LIMIT 1
    `, [subject_code, validatedTeacherId, semester_code, group_code]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Esta materia ya estÃ¡ asignada a este profesor para este semestre/grupo' });
    }
    const gc = group_code && String(group_code).trim() !== '' ? String(group_code).trim() : null;
    let students;
    if (gc) {
      [students] = await db.query(`
        SELECT s.matricula FROM students s
        INNER JOIN student_groups g ON s.group_id = g.id
        WHERE s.status = 'active' AND g.group_code = ? AND g.is_active = 1
      `, [gc]);
      if (!students || students.length === 0) {
        return res.status(400).json({ error: `No hay estudiantes activos en el grupo "${gc}"` });
      }
    } else {
      [students] = await db.query(`
        SELECT matricula FROM students WHERE status = 'active' AND group_id IS NULL
      `);
      if (!students || students.length === 0) {
        return res.status(400).json({ error: 'No hay estudiantes activos sin grupo asignado' });
      }
    }
    for (const student of students) {
      await db.query(`
        INSERT INTO final_grades 
        (student_matricula, semester_code, subject_code, group_code, teacher_id, status)
        VALUES (?, ?, ?, ?, ?, 'in_progress')
      `, [student.matricula, semester_code, subject_code, group_code, validatedTeacherId]);
    }
    invalidateCache('admin:materias');
    res.json({ success: true, message: `Materia asignada a ${students.length} estudiantes` });
  } catch (error) {
    console.error('Error asignando materia:', error);
    sendServerError(res, 'Error al asignar materia');
  }
});

router.get('/asignaciones', async (req, res) => {
  try {
    const { teacher_id } = req.query;
    let query = `
      SELECT DISTINCT 
        fg.subject_code,
        m.subject_name,
        fg.semester_code,
        fg.group_code,
        COUNT(DISTINCT fg.student_matricula) as total_estudiantes,
        CONCAT(u.first_name, ' ', u.last_name) as teacher_name,
        fg.teacher_id
      FROM final_grades fg
      LEFT JOIN users u ON fg.teacher_id = u.id
      LEFT JOIN materias m ON fg.subject_code = m.subject_code
      WHERE 1=1
    `;
    const params = [];
    if (teacher_id) {
      query += ` AND fg.teacher_id = ?`;
      params.push(teacher_id);
    }
    query += ` GROUP BY fg.subject_code, m.subject_name, fg.semester_code, fg.group_code, u.first_name, u.last_name, fg.teacher_id
               ORDER BY fg.semester_code DESC, fg.subject_code`;
    const [asignaciones] = await db.query(query, params);
    res.json({ asignaciones });
  } catch (error) {
    console.error('Error obteniendo asignaciones:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.delete('/asignaciones', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { subject_code, teacher_id, semester_code, group_code } = req.query;
    if (!subject_code || !teacher_id || !semester_code) {
      connection.release();
      return res.status(400).json({ error: 'Faltan subject_code, teacher_id o semester_code' });
    }
    const validatedTeacherId = validateId(teacher_id, 'Teacher ID');
    const validatedSubject = validateNonEmptyString(subject_code, 'CÃ³digo de materia');
    const validatedSemester = validateNonEmptyString(semester_code, 'Semestre');

    await connection.beginTransaction();
    await deleteAsignacion(connection, {
      subjectCode: validatedSubject,
      teacherId: validatedTeacherId,
      semesterCode: validatedSemester,
      groupCode: group_code
    });
    await connection.commit();
    connection.release();
    invalidateCache('admin:materias');
    res.json({ success: true, message: 'AsignaciÃ³n eliminada' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error eliminando asignaciÃ³n:', error);
    sendServerError(res, 'Error al eliminar asignaciÃ³n');
  }
});

// ============================================
// ENDPOINTS PARA CALIFICACIONES (necesarios para direccion)
// ============================================
router.get('/subjects', async (req, res) => {
  try {
    const [subjects] = await db.query(`
      SELECT DISTINCT 
        fg.subject_code,
        fg.teacher_id,
        COUNT(DISTINCT fg.student_matricula) as total_estudiantes,
        COUNT(DISTINCT fg.teacher_id) as total_maestros
      FROM final_grades fg
      GROUP BY fg.subject_code, fg.teacher_id
      ORDER BY fg.subject_code
    `);
    res.json({ subjects });
  } catch (error) {
    console.error('Error obteniendo materias:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.get('/subject-groups', async (req, res) => {
  try {
    const { subjectCode, semester, teacherId } = req.query;
    if (!subjectCode) {
      return res.status(400).json({ error: 'Subject code requerido' });
    }
    let query = `
      SELECT DISTINCT 
        fg.group_code,
        COUNT(DISTINCT fg.student_matricula) as total_students,
        CONCAT(u.first_name, ' ', u.last_name) as teacher_name,
        fg.teacher_id
      FROM final_grades fg
      LEFT JOIN users u ON fg.teacher_id = u.id
      WHERE fg.subject_code = ?
    `;
    const params = [subjectCode];
    if (semester) {
      query += ` AND fg.semester_code = ?`;
      params.push(semester);
    }
    if (teacherId) {
      query += ` AND fg.teacher_id = ?`;
      params.push(teacherId);
    }
    query += ` AND fg.group_code IS NOT NULL
               GROUP BY fg.group_code, u.first_name, u.last_name, fg.teacher_id
               ORDER BY fg.group_code`;
    const [groups] = await db.query(query, params);
    res.json({ groups });
  } catch (error) {
    console.error('Error obteniendo grupos:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.get('/teachers', async (req, res) => {
  try {
    const [teachers] = await db.query(`
      SELECT id, username, first_name, last_name, email, role
      FROM users 
      WHERE role IN ('maestro', 'director')
      AND status = 'active'
      AND is_active = 1
      ORDER BY first_name, last_name
    `);
    res.json({ teachers });
  } catch (error) {
    console.error('Error obteniendo maestros:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.get('/semesters', async (req, res) => {
  try {
    const [semesters] = await db.query(`
      SELECT DISTINCT semester_code
      FROM final_grades
      ORDER BY semester_code DESC
    `);
    res.json({ semesters: semesters.map(s => s.semester_code) });
  } catch (error) {
    console.error('Error obteniendo semestres:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ============================================
// ENDPOINTS PARA ESTUDIANTES
// ============================================
router.get('/students', async (req, res) => {
  try {
    const [students] = await db.query(`
      SELECT s.*, s.group_id, g.group_code, g.name AS group_name
      FROM students s
      LEFT JOIN student_groups g ON s.group_id = g.id
      ORDER BY s.created_at DESC
    `);
    res.json({ students: students || [] });
  } catch (error) {
    console.error('Error obteniendo estudiantes:', error);
    sendServerError(res, 'Error en el servidor');
  }
});

router.post('/students', async (req, res) => {
  try {
    const { matricula, firstName, lastName, email, password, phone, address, status, groupId } = req.body;
    const validatedMatricula = validateMatricula(matricula);
    const validatedEmail = validateEmail(email);
    const validatedFirstName = validateNonEmptyString(firstName, 'Nombre');
    const validatedLastName = validateNonEmptyString(lastName, 'Apellido');
    const validatedStatus = validateEnum(status || 'active', ['active', 'inactive'], 'Estado');
    validateNonEmptyString(password, 'Password');
    const resolvedGroupId = groupId ? await resolveGroupId(groupId) : null;
    
    const [existing] = await db.query('SELECT matricula FROM students WHERE matricula = ? OR email = ?', [validatedMatricula, validatedEmail]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'MatrÃ­cula o email ya existe' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await db.query(`
      INSERT INTO students (matricula, first_name, last_name, email, password_hash, must_change_password, phone, address, status, admission_date, group_id)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, CURDATE(), ?)
    `, [validatedMatricula, validatedFirstName, validatedLastName, validatedEmail, passwordHash, phone || null, address || null, validatedStatus, resolvedGroupId]);
    invalidateCache('admin:student-groups');
    res.json({ success: true, message: 'Estudiante creado exitosamente' });
  } catch (error) {
    console.error('Error creando estudiante:', error);
    sendServerError(res, 'Error al crear estudiante');
  }
});

router.put('/students/:matricula', async (req, res) => {
  try {
    const { matricula } = req.params;
    const validatedMatricula = validateMatricula(matricula);
    const { firstName, lastName, email, password, dateOfBirth, phone, address, status, groupId } = req.body;
    
    const validatedFirstName = validateNonEmptyString(firstName, 'Nombre');
    const validatedLastName = validateNonEmptyString(lastName, 'Apellido');
    const validatedEmail = validateEmail(email);
    const validatedStatus = validateEnum(status || 'active', ['active', 'inactive'], 'Estado');
    const resolvedGroupId = groupId === null || groupId === '' || groupId === undefined
      ? null
      : await resolveGroupId(groupId);
    
    let query = 'UPDATE students SET first_name = ?, last_name = ?, email = ?, date_of_birth = ?, phone = ?, address = ?, status = ?, group_id = ?';
    const params = [validatedFirstName, validatedLastName, validatedEmail, dateOfBirth, phone || null, address || null, validatedStatus, resolvedGroupId];
    if (password && password.trim() !== '') {
      const passwordHash = await bcrypt.hash(password, 10);
      query += ', password_hash = ?, must_change_password = 1';
      params.push(passwordHash);
    }
    query += ' WHERE matricula = ?';
    params.push(validatedMatricula);
    await db.query(query, params);
    invalidateCache('admin:student-groups');
    res.json({ success: true, message: 'Estudiante actualizado' });
  } catch (error) {
    console.error('Error actualizando estudiante:', error);
    sendServerError(res, 'Error al actualizar estudiante');
  }
});

router.delete('/students/:matricula', async (req, res) => {
  const permanent = req.query.permanent === 'true';
  try {
    const validatedMatricula = validateMatricula(req.params.matricula);
    const [existing] = await db.query('SELECT matricula FROM students WHERE matricula = ?', [validatedMatricula]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    if (!permanent) {
      await db.query('UPDATE students SET status = "inactive" WHERE matricula = ?', [validatedMatricula]);
      invalidateCache('admin:student-groups');
      return res.json({ success: true, message: 'Estudiante desactivado' });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await deleteStudentRecords(connection, validatedMatricula);
      await connection.query('DELETE FROM students WHERE matricula = ?', [validatedMatricula]);
      await connection.commit();
      connection.release();
      invalidateCache('admin:student-groups');
      res.json({ success: true, message: 'Estudiante eliminado permanentemente' });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (error) {
    console.error('Error eliminando estudiante:', error);
    sendServerError(res, 'Error al eliminar estudiante');
  }
});

// ============================================
// ENDPOINTS PARA USUARIOS (staff)
// ============================================
router.get('/users', async (req, res) => {
  try {
    const [users] = await db.query(`SELECT id, username, first_name, last_name, email, role, is_active, phone, created_at FROM users ORDER BY created_at DESC`);
    res.json({ users: users || [] });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    sendServerError(res, 'Error en el servidor');
  }
});

router.post('/users', async (req, res) => {
  try {
    const { username, firstName, lastName, email, password, role, phone, isActive } = req.body;
    const validatedUsername = validateNonEmptyString(username, 'Usuario');
    const validatedEmail = validateEmail(email);
    const validatedFirstName = validateNonEmptyString(firstName, 'Nombre');
    const validatedLastName = validateNonEmptyString(lastName, 'Apellido');
    const validatedRole = validateEnum(role, ['director', 'maestro'], 'Rol');
    validateNonEmptyString(password, 'Password');
    
    const [existing] = await db.query('SELECT id FROM users WHERE username = ? OR email = ?', [validatedUsername, validatedEmail]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Usuario o email ya existe' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await db.query(`
      INSERT INTO users (username, first_name, last_name, email, password_hash, must_change_password, role, phone, is_active, status)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, 'active')
    `, [validatedUsername, validatedFirstName, validatedLastName, validatedEmail, passwordHash, validatedRole, phone || null, isActive !== false]);
    invalidateCache('admin:profesores');
    res.json({ success: true, message: 'Usuario creado' });
  } catch (error) {
    console.error('Error creando usuario:', error);
    sendServerError(res, 'Error al crear usuario');
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedId = validateId(id, 'ID de usuario');
    const { username, firstName, lastName, email, password, role, phone, isActive } = req.body;
    
    const validatedUsername = validateNonEmptyString(username, 'Usuario');
    const validatedEmail = validateEmail(email);
    const validatedFirstName = validateNonEmptyString(firstName, 'Nombre');
    const validatedLastName = validateNonEmptyString(lastName, 'Apellido');
    const validatedRole = validateEnum(role, ['director', 'maestro'], 'Rol');
    
    let query = 'UPDATE users SET username = ?, first_name = ?, last_name = ?, email = ?, role = ?, phone = ?, is_active = ?';
    const params = [validatedUsername, validatedFirstName, validatedLastName, validatedEmail, validatedRole, phone || null, isActive !== false];
    if (password && password.trim() !== '') {
      const passwordHash = await bcrypt.hash(password, 10);
      query += ', password_hash = ?, must_change_password = 1';
      params.push(passwordHash);
    }
    query += ' WHERE id = ?';
    params.push(validatedId);
    await db.query(query, params);
    invalidateCache('admin:profesores');
    res.json({ success: true, message: 'Usuario actualizado' });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    sendServerError(res, 'Error al actualizar usuario');
  }
});

router.delete('/users/:id', async (req, res) => {
  const permanent = req.query.permanent === 'true';
  try {
    const validatedId = validateId(req.params.id, 'ID de usuario');
    const [user] = await db.query('SELECT id, role FROM users WHERE id = ?', [validatedId]);
    if (!user || user.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!permanent) {
      await db.query('UPDATE users SET is_active = FALSE, status = "inactive" WHERE id = ?', [validatedId]);
      invalidateCache('admin:profesores');
      return res.json({ success: true, message: 'Usuario desactivado' });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await deleteTeacherRecords(connection, validatedId);
      await connection.query('DELETE FROM users WHERE id = ?', [validatedId]);
      await connection.commit();
      connection.release();
      invalidateCache('admin:profesores');
      res.json({ success: true, message: 'Usuario eliminado permanentemente' });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    sendServerError(res, 'Error al eliminar usuario');
  }
});

export default router;


```

```js
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ALLOWED_ROLES = new Set(['director', 'maestro', 'alumno']);
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_LENGTH = 1000;
const JWT_ALGORITHM = 'HS256';
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "upgrade-insecure-requests"
].join('; ');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 64) {
    throw new Error('JWT_SECRET must be set to at least 64 random characters. Generate with: crypto.randomBytes(64).toString("base64")');
  }
  return secret;
}

export function logSecurityEvent(req, event, details = {}) {
  console.warn(JSON.stringify({
    event,
    ip: req.ip || req.socket?.remoteAddress || 'unknown',
    userId: req.user?.id || null,
    role: req.user?.role || null,
    method: req.method,
    path: req.originalUrl?.split('?')[0] || req.path,
    timestamp: new Date().toISOString(),
    ...details
  }));
}

function cleanString(value) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, MAX_STRING_LENGTH);
}

export function sanitizeValue(value, depth = 0) {
  if (depth > 8) return undefined;
  if (typeof value === 'string') return cleanString(value);
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeValue(item, depth + 1));
  if (value && typeof value === 'object') {
    const sanitized = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      sanitized[cleanString(key)] = sanitizeValue(child, depth + 1);
    }
    return sanitized;
  }
  return value;
}

export function sanitizeRequest(req, res, next) {
  req.body = sanitizeValue(req.body) || {};
  req.query = sanitizeValue(req.query) || {};
  req.params = sanitizeValue(req.params) || {};
  next();
}

export function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': CSP_DIRECTIVES,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Origin-Agent-Cluster': '?1',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=15552000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-DNS-Prefetch-Control': 'off',
    'X-Download-Options': 'noopen',
    'X-Frame-Options': 'DENY',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'X-XSS-Protection': '0'
  });
  if (req.path.startsWith('/api')) {
    res.set('Cache-Control', 'private, no-store');
  }
  next();
}

export function requireJsonBody(req, res, next) {
  if (!SAFE_METHODS.has(req.method) && !req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type application/json requerido' });
  }
  next();
}

export function signAuthToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      matricula: user.matricula,
      mustChangePassword: Boolean(user.must_change_password)
    },
    getJwtSecret(),
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      issuer: process.env.JWT_ISSUER || 'calsys-api',
      audience: process.env.JWT_AUDIENCE || 'calsys-web'
    }
  );
}

export function createCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    logSecurityEvent(req, 'auth_missing_token');
    return res.status(401).json({ error: 'Autenticacion requerida' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: [JWT_ALGORITHM],
      issuer: process.env.JWT_ISSUER || 'calsys-api',
      audience: process.env.JWT_AUDIENCE || 'calsys-web'
    });
    if (!ALLOWED_ROLES.has(decoded.role)) {
      logSecurityEvent(req, 'auth_invalid_role', { tokenRole: decoded.role });
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }
    req.user = decoded;
    next();
  } catch {
    logSecurityEvent(req, 'auth_invalid_token');
    return res.status(401).json({ error: 'Token invalido' });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      logSecurityEvent(req, 'permission_denied', { requiredRoles: roles });
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }
    next();
  };
}

export function configuredOrigins() {
  const corsOrigin = process.env.CORS_ORIGIN;

  if (!corsOrigin) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CORS_ORIGIN environment variable must be set in production');
    }
    return ['http://localhost:5173'];
  }

  const origins = corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      try {
        new URL(origin);
        return origin;
      } catch {
        console.warn(`âš ï¸ Invalid CORS origin URL: "${origin}" - skipping`);
        return null;
      }
    })
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error('No valid CORS origins configured in CORS_ORIGIN');
  }

  return origins;
}

export function verifyOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const allowed = configuredOrigins();
  const source = origin || referer;
  if (!source) return res.status(403).json({ error: 'Origen requerido' });
  let sourceOrigin;
  try {
    sourceOrigin = new URL(source).origin;
  } catch {
    return res.status(403).json({ error: 'Origen no permitido' });
  }
  if (!allowed.includes(sourceOrigin)) {
    logSecurityEvent(req, 'origin_denied', { origin: sourceOrigin });
    return res.status(403).json({ error: 'Origen no permitido' });
  }
  next();
}

export function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const csrfHeader = req.headers['x-csrf-token'];
  if (!csrfHeader) {
    logSecurityEvent(req, 'csrf_denied', { reason: 'no_csrf_token_header' });
    return res.status(403).json({ error: 'Token CSRF invalido' });
  }
  // Note: CSRF token validation would require server-side session storage
  // For now, we validate that header is present. Token should be generated per-session.
  next();
}

function valueMatches(actual, expected) {
  return String(actual) === String(expected);
}

export function enforceScopedAccess(req, res, next) {
  const role = req.user?.role;
  const teacherId = req.query.teacherId ?? req.body.teacherId ?? req.query.teacher_id ?? req.body.teacher_id;
  const matricula = req.query.matricula ?? req.body.matricula;

  if (teacherId !== undefined && role === 'maestro' && !valueMatches(teacherId, req.user.id)) {
    logSecurityEvent(req, 'scope_denied', { scope: 'teacherId' });
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }
  if (teacherId !== undefined && role === 'alumno') {
    logSecurityEvent(req, 'scope_denied', { scope: 'teacherId' });
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }
  if (matricula !== undefined && role === 'alumno' && !valueMatches(matricula, req.user.matricula)) {
    logSecurityEvent(req, 'scope_denied', { scope: 'matricula' });
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }
  next();
}

export function genericError(message = 'Error en el servidor') {
  return { error: message };
}

export function sendServerError(res, message = 'Error en el servidor') {
  return res.status(500).json(genericError(message));
}

```

```js
const WINDOW_CLEANUP_INTERVAL_MS = 60_000;
const authFailures = new Map();

function now() {
  return Date.now();
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function logRateLimitEvent(req, limiter) {
  console.warn(JSON.stringify({
    event: 'rate_limit_hit',
    limiter,
    ip: clientIp(req),
    userId: req.user?.id || null,
    path: req.originalUrl?.split('?')[0] || req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  }));
}

function pruneWindow(bucket, windowMs, currentTime) {
  while (bucket.length > 0 && bucket[0] <= currentTime - windowMs) {
    bucket.shift();
  }
}

function retryAfterSeconds(resetAt) {
  return Math.max(1, Math.ceil((resetAt - now()) / 1000));
}

export function createSlidingWindowLimiter({ windowMs, max, keyGenerator, backoff = false, name = 'default' }) {
  const hits = new Map();

  setInterval(() => {
    const currentTime = now();
    for (const [key, bucket] of hits.entries()) {
      pruneWindow(bucket.requests, windowMs, currentTime);
      if (bucket.requests.length === 0 && bucket.blockedUntil <= currentTime) {
        hits.delete(key);
      }
    }
  }, WINDOW_CLEANUP_INTERVAL_MS).unref();

  return (req, res, next) => {
    const key = keyGenerator(req);
    const currentTime = now();
    const bucket = hits.get(key) || { requests: [], violations: 0, blockedUntil: 0 };

    if (bucket.blockedUntil > currentTime) {
      const retryAfter = retryAfterSeconds(bucket.blockedUntil);
      res.set('Retry-After', String(retryAfter));
      logRateLimitEvent(req, name);
      return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta mas tarde.' });
    }

    pruneWindow(bucket.requests, windowMs, currentTime);
    if (bucket.requests.length >= max) {
      bucket.violations += 1;
      const penalty = backoff ? Math.min(2 ** bucket.violations, 900) * 1000 : windowMs;
      bucket.blockedUntil = currentTime + penalty;
      hits.set(key, bucket);
      const retryAfter = retryAfterSeconds(bucket.blockedUntil);
      res.set('Retry-After', String(retryAfter));
      logRateLimitEvent(req, name);
      return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta mas tarde.' });
    }

    bucket.requests.push(currentTime);
    hits.set(key, bucket);
    next();
  };
}

export const globalRateLimiter = createSlidingWindowLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  name: 'global',
  keyGenerator: (req) => `global:${clientIp(req)}`,
  backoff: true
});

export const authRateLimiter = createSlidingWindowLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  name: 'auth',
  keyGenerator: (req) => `auth:${clientIp(req)}:${req.body?.username || 'anonymous'}`,
  backoff: true
});

export const apiRateLimiter = createSlidingWindowLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  name: 'api',
  keyGenerator: (req) => `api:${req.user?.id || clientIp(req)}:${req.originalUrl.split('?')[0]}`,
  backoff: true
});

export const uploadRateLimiter = createSlidingWindowLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  name: 'upload',
  keyGenerator: (req) => `upload:${req.user?.id || clientIp(req)}`,
  backoff: true
});

function authKey(username, role) {
  return `${String(role || '').toLowerCase()}:${String(username || '').toLowerCase()}`;
}

export function enforceAuthLockout(req, res, next) {
  const key = authKey(req.body?.username, req.body?.role);
  const failure = authFailures.get(key);
  if (failure?.lockedUntil && failure.lockedUntil > now()) {
    const retryAfter = retryAfterSeconds(failure.lockedUntil);
    res.set('Retry-After', String(retryAfter));
    logRateLimitEvent(req, 'auth-lockout');
    return res.status(429).json({ error: 'Cuenta temporalmente bloqueada. Intenta mas tarde.' });
  }
  next();
}

export function recordAuthFailure(username, role) {
  const key = authKey(username, role);
  const failure = authFailures.get(key) || { count: 0, lockedUntil: 0 };
  failure.count += 1;
  if (failure.count >= 5) {
    const lockMs = Math.min(2 ** (failure.count - 4), 900) * 1000;
    failure.lockedUntil = now() + lockMs;
  }
  authFailures.set(key, failure);
}

export function clearAuthFailures(username, role) {
  authFailures.delete(authKey(username, role));
}

```

```js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const useSsl = process.env.DB_SSL === 'true';

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME     || 'CalSysJS',
  port:             Number(process.env.DB_PORT || 3306),
  charset:          'utf8mb4',
  connectTimeout:   Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
  ssl:              useSsl ? {
    rejectUnauthorized: process.env.NODE_ENV === 'production',
    minVersion: 'TLSv1.2'
  } : undefined,
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0
});

export default pool;

```

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})

```

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
    
```

```js
export const colors = {
  brand: '#880000',
  brandHover: '#6b0000',
  bgPage: '#f5f5f5',
  bgCard: '#ffffff',
  border: '#e5e7eb',
  textPrimary: '#111111',
  textSecondary: '#6b7280',
  success: '#10b981',
  successBg: '#d1fae5',
  successText: '#065f46',
  warning: '#f59e0b',
  warningBg: '#fef3c7',
  warningText: '#92400e',
  error: '#dc2626',
  errorStrong: '#ef4444',
  errorBg: '#fef2f2',
  errorText: '#991b1b',
  errorBorder: '#fca5a5',
  info: '#3b82f6',
  infoBg: '#eff6ff',
  infoText: '#1e40af',
  neutral: '#9ca3af',
  btnSecondary: '#4b5563',
};

export function gradeStyle(value) {
  const n = parseFloat(value);
  if (isNaN(n)) return { bg: colors.warningBg, text: colors.warningText };
  if (n >= 9) return { solid: colors.success, soft: { bg: colors.successBg, text: colors.successText } };
  if (n >= 6) return { solid: colors.warning, soft: { bg: colors.warningBg, text: colors.warningText } };
  return { solid: colors.errorStrong, soft: { bg: colors.errorBg, text: colors.errorText } };
}

```

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/justo-sierra-logo-transparent.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CalSys-Js</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>

```

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])

```

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY src ./src
COPY index.html ./
COPY vite.config.js ./

# Build application
RUN npm run build

# Runtime stage - serve with nginx
FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 3000

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

```

```env
VITE_API_URL=http://localhost:3000/api

```

```nginx
server {
    listen ${PORT};
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

```

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://calsys-backend-production.up.railway.app;" always;

    server {
        listen 8080;
        server_name _;

        root /usr/share/nginx/html;
        index index.html;

        # SPA routing - redirect all non-file requests to index.html
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Health check
        location /health {
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}


```

```json
{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@handsontable/react": "^16.2.0",
    "axios": "^1.13.5",
    "chart.js": "^4.5.1",
    "handsontable": "^16.2.0",
    "react": "^19.2.0",
    "react-chartjs-2": "^5.3.1",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.13.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "globals": "^16.5.0",
    "vite": "^7.3.1"
  }
}

```

```css
#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.react:hover {
  filter: drop-shadow(0 0 2em #61dafbaa);
}

@keyframes logo-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: no-preference) {
  a:nth-of-type(2) .logo {
    animation: logo-spin infinite 20s linear;
  }
}

.card {
  padding: 2em;
}

.read-the-docs {
  color: #888;
}

```

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import AlumnoDashboard from './pages/AlumnoDashboard';
import MaestroDashboard from './pages/MaestroDashboard';
import AdminDashboard from './pages/AdminDashboard';

function LoadingSpinner() {
  return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
}

function homeForRole(role) {
  if (role === 'alumno') return '/alumno';
  if (role === 'maestro') return '/maestro';
  if (role === 'director') return '/admin';
  return '/login';
}

function ProtectedRoute({ allowed, children }) {
  const { user } = useAuth();
  if (!user || !allowed.includes(user.role)) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  return (
    <Routes>
      <Route path="/login" element={user && !user.mustChangePassword ? <Navigate to={homeForRole(user.role)} replace /> : <Login />} />
      <Route path="/change-password" element={user ? <ChangePassword /> : <Navigate to="/login" replace />} />
      <Route path="/alumno" element={<ProtectedRoute allowed={['alumno']}><AlumnoDashboard /></ProtectedRoute>} />
      <Route path="/maestro" element={<ProtectedRoute allowed={['maestro', 'director']}><MaestroDashboard /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute allowed={['director']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

```

```css
:root {
  --brand: #880000;
  --brand-hover: #6b0000;
  --bg-page: #f5f5f5;
  --bg-card: #ffffff;
  --border: #e5e7eb;
  --text-primary: #111111;
  --text-secondary: #6b7280;
  --success: #10b981;
  --success-bg: #d1fae5;
  --success-text: #065f46;
  --warning: #f59e0b;
  --warning-bg: #fef3c7;
  --warning-text: #92400e;
  --error: #dc2626;
  --error-strong: #ef4444;
  --error-bg: #fef2f2;
  --error-text: #991b1b;
  --error-border: #fca5a5;
  --info: #3b82f6;
  --info-bg: #eff6ff;
  --info-text: #1e40af;
  --neutral: #9ca3af;
  --btn-secondary: #4b5563;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import justoSierraLogo from '../assets/justo-sierra-logo-transparent.png';

function homeForRole(role) {
  if (role === 'alumno') return '/alumno';
  if (role === 'maestro') return '/maestro';
  if (role === 'director') return '/admin';
  return '/login';
}

function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('La nueva contrasena debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contrasenas no coinciden');
      return;
    }

    setIsLoading(true);
    const result = await changePassword(currentPassword, newPassword, confirmPassword);
    setIsLoading(false);

    if (result.success) {
      navigate(homeForRole(result.role), { replace: true });
    } else {
      setError(result.error);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&display=swap');

        .password-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f5f5;
          font-family: 'DM Sans', sans-serif;
          padding: 1rem;
        }

        .password-card {
          background: #ffffff;
          border: 0.5px solid #e5e7eb;
          border-radius: 16px;
          padding: 2.5rem;
          width: 100%;
          max-width: 430px;
          box-shadow: 0 4px 32px rgba(0, 0, 0, 0.07);
        }

        .password-brand {
          text-align: center;
          margin-bottom: 1.75rem;
        }

        .password-icon {
          width: 70px;
          height: 70px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.9rem;
          overflow: hidden;
        }

        .password-icon img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        .password-title {
          font-family: 'DM Serif Display', serif;
          font-size: 24px;
          font-weight: 400;
          color: #111111;
          margin: 0 0 6px;
        }

        .password-subtitle {
          font-size: 13px;
          line-height: 1.45;
          color: #6b7280;
          margin: 0;
        }

        .password-user {
          background: #fafafa;
          border: 0.5px solid #e5e7eb;
          border-radius: 8px;
          color: #374151;
          font-size: 13px;
          margin-bottom: 1.25rem;
          padding: 10px 12px;
          text-align: center;
        }

        .password-field {
          margin-bottom: 1.1rem;
        }

        .password-label {
          display: block;
          font-size: 11px;
          font-weight: 500;
          color: #9ca3af;
          margin-bottom: 6px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .password-input {
          width: 100%;
          background: #fafafa;
          border: 0.5px solid #e5e7eb;
          border-radius: 8px;
          padding: 11px 14px;
          font-size: 14px;
          color: #111111;
          font-family: 'DM Sans', sans-serif;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }

        .password-input:focus {
          border-color: var(--brand);
          background: #ffffff;
        }

        .password-error {
          background: var(--error-bg);
          border: 0.5px solid var(--error-border);
          color: var(--error-text);
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 1.25rem;
        }

        .password-btn {
          width: 100%;
          padding: 13px;
          background: var(--brand);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 14px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          margin-top: 0.4rem;
          transition: background 0.2s;
        }

        .password-btn:hover:not(:disabled) {
          background: var(--brand-hover);
        }

        .password-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .password-secondary {
          width: 100%;
          padding: 11px;
          background: transparent;
          border: none;
          color: var(--brand);
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          margin-top: 0.75rem;
        }
      `}</style>

      <div className="password-wrapper">
        <form className="password-card" onSubmit={handleSubmit}>
          <div className="password-brand">
            <div className="password-icon">
              <img src={justoSierraLogo} alt="Justo Sierra" />
            </div>
            <h1 className="password-title">Cambia tu contrasena</h1>
            <p className="password-subtitle">
              Por seguridad, actualiza la contrasena temporal antes de entrar a CalSys.
            </p>
          </div>

          <div className="password-user">
            {user?.firstName} {user?.lastName} Â· {user?.username}
          </div>

          {error && <div className="password-error">{error}</div>}

          <div className="password-field">
            <label className="password-label">Contrasena actual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="password-input"
              autoComplete="current-password"
              required
            />
          </div>

          <div className="password-field">
            <label className="password-label">Nueva contrasena</label>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="password-input"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div className="password-field">
            <label className="password-label">Confirmar contrasena</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="password-input"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <button type="submit" disabled={isLoading} className="password-btn">
            {isLoading ? 'Guardando...' : 'Guardar contrasena'}
          </button>
          <button type="button" className="password-secondary" onClick={logout}>
            Salir
          </button>
        </form>
      </div>
    </>
  );
}

export default ChangePassword;

```

```jsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { gradeStyle } from '../theme';
import justoSierraLogo from '../assets/justo-sierra-logo.jpg';

function AlumnoDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState(1);
  const [materias, setMaterias] = useState([]);
  const [selectedMateria, setSelectedMateria] = useState('');
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [promedio, setPromedio] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMaterias, setLoadingMaterias] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const cargarMaterias = async () => {
      if (!user?.matricula) {
        setError('Usuario no autenticado');
        setLoadingMaterias(false);
        return;
      }
      try {
        const response = await api.get('/grades/student-subjects', {
          params: { matricula: user.matricula }
        });
        setMaterias(response.data.subjects || []);
        if (response.data.subjects && response.data.subjects.length > 0) {
          setSelectedMateria(response.data.subjects[0].subject_code);
        }
      } catch (error) {
        console.error(error);
        setError('Error al cargar materias: ' + (error.response?.data?.error || 'Error de conexiÃ³n'));
      } finally {
        setLoadingMaterias(false);
      }
    };
    cargarMaterias();
  }, [user?.matricula]);

  const cargarParcial = useCallback(async (parcialId, subjectCode) => {
    setLoading(true);
    setError('');
    try {
      if (!user?.matricula) {
        setError('Usuario no autenticado');
        setLoading(false);
        return;
      }
      const response = await api.get('/grades/student-grades', {
        params: { matricula: user.matricula, parcialId, subjectCode }
      });
      const cols = response.data.columns || [];
      const grades = response.data.grades || [];
      const prom = response.data.promedio;
      setColumns(cols);
      setPromedio(prom);
      const gradesMap = {};
      grades.forEach(g => { gradesMap[g.columnName] = g.value; });
      const row = [user.matricula, `${user.firstName} ${user.lastName}`];
      cols.forEach(col => {
        const val = gradesMap[col.name];
        const parsedVal = val !== undefined && val !== null ? parseFloat(val) : NaN;
        row.push(!isNaN(parsedVal) ? parsedVal.toFixed(2) : '');
      });
      setData([row]);
    } catch (error) {
      console.error(error);
      setError('Error al cargar calificaciones del parcial: ' + (error.response?.data?.error || 'Error de conexiÃ³n'));
    } finally {
      setLoading(false);
    }
  }, [user?.matricula, user?.firstName, user?.lastName]);

  const cargarFinal = useCallback(async (subjectCode) => {
    setLoading(true);
    setError('');
    try {
      if (!user?.matricula) {
        setError('Usuario no autenticado');
        setLoading(false);
        return;
      }
      const response = await api.get('/grades/student-final', {
        params: { matricula: user.matricula, subjectCode }
      });
      const cols = response.data.columns || [];
      const grades = response.data.grades || [];
      const prom = response.data.promedio;
      setColumns(cols);
      setPromedio(prom);
      const gradesMap = {};
      grades.forEach(g => { gradesMap[g.columnName] = g.value; });
      const row = [user.matricula, `${user.firstName} ${user.lastName}`];
      cols.forEach(col => {
        const val = gradesMap[col.name];
        const parsedVal = val !== undefined && val !== null ? parseFloat(val) : NaN;
        row.push(!isNaN(parsedVal) ? parsedVal.toFixed(2) : '');
      });
      setData([row]);
    } catch (error) {
      console.error(error);
      setError('Error al cargar calificaciÃ³n final: ' + (error.response?.data?.error || 'Error de conexiÃ³n'));
    } finally {
      setLoading(false);
    }
  }, [user?.matricula, user?.firstName, user?.lastName]);

  const cargarAsistencia = useCallback(async (subjectCode) => {
    setLoading(true);
    setError('');
    try {
      if (!user?.matricula) {
        setError('Usuario no autenticado');
        setLoading(false);
        return;
      }
      const response = await api.get('/attendance/student', {
        params: { matricula: user.matricula, subjectCode }
      });
      setAttendanceData(response.data);
    } catch (error) {
      console.error(error);
      setError('Error al cargar asistencia: ' + (error.response?.data?.error || 'Error de conexiÃ³n'));
    } finally {
      setLoading(false);
    }
  }, [user?.matricula]);

  useEffect(() => {
    if (selectedMateria && user?.matricula) {
      if (activeTab === 5) {
        cargarAsistencia(selectedMateria);
      } else if (activeTab === 4) {
        cargarFinal(selectedMateria);
      } else {
        cargarParcial(activeTab, selectedMateria);
      }
    }
  }, [activeTab, selectedMateria, user?.matricula, cargarParcial, cargarFinal, cargarAsistencia]);

  const tabs = [
    { id: 1, label: 'Parcial 1', icon: 'ðŸ“˜' },
    { id: 2, label: 'Parcial 2', icon: 'ðŸ“—' },
    { id: 3, label: 'Parcial 3', icon: 'ðŸ“™' },
    { id: 4, label: 'CalificaciÃ³n Final', icon: 'ðŸŽ“' },
    { id: 5, label: 'Asistencia', icon: 'ðŸ“…' }
  ];

  const getGradeColor = (value) => {
    const style = gradeStyle(value);
    if (value !== '' && !isNaN(parseFloat(value))) {
      return { bg: style.soft.bg, text: style.soft.text };
    }
    return { bg: '', text: '' };
  };

  const renderTabContent = () => {
    if (loading) return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ marginBottom: '8px' }}>â³</div>
        Cargando informaciÃ³n...
      </div>
    );
    
    if (activeTab === 5) {
      if (!attendanceData || attendanceData.dates?.length === 0) {
        return (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', fontFamily: 'DM Sans, sans-serif' }}>
            No hay registros de asistencia para esta materia.
          </div>
        );
      }
      return (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{
              background: '#eff6ff',
              padding: '1rem',
              borderRadius: '12px',
              textAlign: 'center',
              border: '0.5px solid #dbeafe'
            }}>
              <p style={{ fontSize: '12px', color: '#4b5563', marginBottom: '4px' }}>Clases Totales</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: '#1e40af' }}>{attendanceData.summary?.total || 0}</p>
            </div>
            <div style={{
              background: '#f0fdf4',
              padding: '1rem',
              borderRadius: '12px',
              textAlign: 'center',
              border: '0.5px solid #dcfce7'
            }}>
              <p style={{ fontSize: '12px', color: '#4b5563', marginBottom: '4px' }}>Asistencias</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: '#166534' }}>{attendanceData.summary?.attended || 0}</p>
            </div>
            <div style={{
              background: '#f5f3ff',
              padding: '1rem',
              borderRadius: '12px',
              textAlign: 'center',
              border: '0.5px solid #ede9fe'
            }}>
              <p style={{ fontSize: '12px', color: '#4b5563', marginBottom: '4px' }}>Porcentaje</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: '#5b21b6' }}>{attendanceData.summary?.percentage || 0}%</p>
            </div>
          </div>
          
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <table style={{ width: '100%', backgroundColor: '#ffffff', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Fecha</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>AsistiÃ³</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData.dates.map((d, idx) => (
                  <tr key={d.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '10px 16px', borderBottom: '0.5px solid #f0f0f0' }}>{d.date}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', borderBottom: '0.5px solid #f0f0f0' }}>
                      {d.present ? (
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>âœ”ï¸ SÃ­</span>
                      ) : (
                        <span style={{ color: 'var(--error)', fontWeight: 600 }}>âŒ No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (columns.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', fontFamily: 'DM Sans, sans-serif' }}>
          No hay actividades configuradas para esta evaluaciÃ³n.
        </div>
      );
    }

    return (
      <div>
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', backgroundColor: '#ffffff', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>MatrÃ­cula</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Alumno</th>
                {columns.map(col => (
                  <th key={col.name} style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>
                    {col.name}{col.isSpecial ? ' â­' : ''}
                    <div style={{ fontSize: '10px', fontWeight: 400, color: '#6b7280', marginTop: '2px' }}>
                      ({col.weight}% / {col.maxValue})
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIdx) => (
                <tr key={rowIdx} style={{ backgroundColor: rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  {row.map((cell, cellIdx) => {
                    const gradeColor = cellIdx >= 2 ? getGradeColor(cell) : { bg: '', text: '' };
                    const isNumeric = cellIdx >= 2 && !isNaN(parseFloat(cell)) && cell !== '';
                    return (
                      <td 
                        key={cellIdx} 
                        style={{
                          padding: '10px 12px',
                          borderBottom: '0.5px solid #f0f0f0',
                          textAlign: cellIdx >= 2 ? 'center' : 'left',
                          fontWeight: cellIdx < 2 ? 500 : 'normal',
                          backgroundColor: gradeColor.bg,
                          color: gradeColor.text
                        }}
                      >
                        {cell !== '' ? cell : 'â€”'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem 1.5rem',
          background: '#f0f9ff',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderLeft: '4px solid #0284c7'
        }}>
          <p style={{ fontWeight: 600, color: '#0c4a6e' }}>
            {activeTab === 4 ? 'ðŸŽ¯ CalificaciÃ³n Final Global:' : 'ðŸ“Š CalificaciÃ³n Final del Parcial:'}
          </p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#0284c7' }}>
            {promedio !== null ? promedio.toFixed(2) : 'N/A'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        fontFamily: 'DM Sans, sans-serif'
      }}>
        {/* Navbar */}
        <nav style={{
          background: '#880000',
          padding: '0 2rem',
          height: '56px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src={justoSierraLogo}
              alt="Justo Sierra"
              style={{ width: '26px', height: '26px', objectFit: 'cover', borderRadius: '50%', background: '#ffffff', boxShadow: '0 1px 5px rgba(0, 0, 0, 0.18)' }}
            />
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>Calsys Â· Alumno</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '13px', color: '#ffffff' }}>
              Hola, {user?.firstName} {user?.lastName}
            </span>
            <button 
              onClick={logout} 
              style={{
                background: '#ffffff',
                color: '#000000',
                border: 'none',
                borderRadius: '7px',
                padding: '7px 16px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.target.style.background = 'var(--text-secondary)'}
              onMouseLeave={e => e.target.style.background = '#ffffff'}
            >
              Salir
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '0.5px solid #e5e7eb',
            padding: '1.5rem',
            boxShadow: '0 4px 32px rgba(0, 0, 0, 0.04)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#111111', marginBottom: '1.5rem' }}>
              Mis Calificaciones
            </h2>

            {error && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '1.25rem',
                background: 'var(--error-bg)',
                border: '0.5px solid var(--error-border)',
                color: 'var(--error-text)'
              }}>
                {error}
              </div>
            )}

            {!error && !materias.length && !loadingMaterias && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '1.25rem',
                background: 'var(--warning-bg)',
                border: '0.5px solid #f59e0b',
                color: 'var(--warning-text)'
              }}>
                No tienes materias asignadas.
              </div>
            )}

            {/* Selector de materia */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 500,
                color: '#9ca3af',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: '6px'
              }}>
                Materia
              </label>
              {loadingMaterias ? (
                <p style={{ fontSize: '13px', color: '#6b7280' }}>Cargando materias...</p>
              ) : (
                <select
                  value={selectedMateria}
                  onChange={(e) => setSelectedMateria(e.target.value)}
                  disabled={!materias.length}
                  style={{
                    width: '100%',
                    maxWidth: '300px',
                    background: '#fafafa',
                    border: '0.5px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '13px',
                    color: '#111111',
                    fontFamily: 'DM Sans, sans-serif',
                    outline: 'none',
                    cursor: materias.length ? 'pointer' : 'not-allowed',
                    transition: 'border-color 0.2s, background 0.2s'
                  }}
                >
                  {materias.map(m => (
                    <option key={m.subject_code} value={m.subject_code}>
                      {m.subject_code} - {m.semester_code}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Tabs */}
            <div style={{
              borderBottom: '0.5px solid #e5e7eb',
              marginBottom: '1.5rem'
            }}>
              <nav style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '8px 8px 0 0',
                      fontSize: '13px',
                      fontWeight: 500,
                      fontFamily: 'DM Sans, sans-serif',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: activeTab === tab.id ? '#880000' : '#f3f4f6',
                      color: activeTab === tab.id ? '#ffffff' : '#4b5563'
                    }}
                    onMouseEnter={e => {
                      if (activeTab !== tab.id) {
                        e.target.style.background = '#e5e7eb';
                      }
                    }}
                    onMouseLeave={e => {
                      if (activeTab !== tab.id) {
                        e.target.style.background = '#f3f4f6';
                      }
                    }}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            {renderTabContent()}
          </div>
        </div>
      </div>
    </>
  );
}

export default AlumnoDashboard;

```

```jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import GradesViewer from '../components/admin/GradesViewer';
import StudentsManager from '../components/admin/StudentsManager';
import UsersManager from '../components/admin/UsersManager';
import MateriasManager from '../components/admin/MateriasManager';
import GroupsManager from '../components/admin/GroupsManager';
import api from '../api/axios';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { colors } from '../theme';
import justoSierraLogo from '../assets/justo-sierra-logo.jpg';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('stats');
  const [stats, setStats] = useState({
    students: 0, teachers: 0, subjects: 0, grades: 0,
    average: 0, passed: 0, failed: 0, inProgress: 0,
    subjectStats: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cargarEstadisticas = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/stats');
      const data = response.data;
      setStats({
        students: Number(data.students) || 0,
        teachers: Number(data.teachers) || 0,
        subjects: Number(data.subjects) || 0,
        grades: Number(data.grades) || 0,
        average: Number(data.average) || 0,
        passed: Number(data.passed) || 0,
        failed: Number(data.failed) || 0,
        inProgress: Number(data.inProgress) || 0,
        subjectStats: Array.isArray(data.subjectStats) ? data.subjectStats : []
      });
    } catch (error) {
      console.error('Error cargando estadÃ­sticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'stats', label: 'EstadÃ­sticas', icon: 'ðŸ“Š' },
    { id: 'materias', label: 'Materias', icon: 'ðŸ“š' },
    { id: 'grades', label: 'Calificaciones', icon: 'ðŸ“' },
    { id: 'students', label: 'Alumnos', icon: 'ðŸ‘¨â€ðŸŽ“' },
    { id: 'groups', label: 'Grupos', icon: 'ðŸ«' },
    { id: 'users', label: 'Usuarios', icon: 'ðŸ‘¥' }
  ];

  const distributionData = {
    labels: ['Aprobados', 'Reprobados', 'En Progreso'],
    datasets: [{
      data: [stats.passed, stats.failed, stats.inProgress],
      backgroundColor: [colors.success, colors.errorStrong, colors.warning],
      borderWidth: 0
    }]
  };

  const subjectNames = stats.subjectStats.map(s => s.subject_code);
  const subjectAverages = stats.subjectStats.map(s => {
    const prom = Number(s.promedio);
    return isNaN(prom) ? 0 : prom;
  });
  
  const barData = {
    labels: subjectNames,
    datasets: [{
      label: 'Promedio',
      data: subjectAverages,
      backgroundColor: colors.brand,
      borderRadius: 8
    }]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true, max: 10, title: { display: true, text: 'CalificaciÃ³n' } }
    },
    plugins: {
      legend: { position: 'top' },
      tooltip: { callbacks: { label: (ctx) => `${ctx.raw.toFixed(2)}` } }
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: 'DM Sans, sans-serif' }}>
        {/* Navbar */}
        <nav style={{ background: '#880000', padding: '0 2rem', height: '56px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src={justoSierraLogo}
              alt="Justo Sierra"
              style={{ width: '26px', height: '26px', objectFit: 'cover', borderRadius: '50%', background: '#ffffff', boxShadow: '0 1px 5px rgba(0, 0, 0, 0.18)' }}
            />
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>Calsys Â· Director</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '13px', color: '#ffffff' }}>ðŸ‘‘ {user?.firstName} {user?.lastName}</span>
            <button 
              onClick={logout} 
              style={{ background: '#ffffff', color: '#000000', border: 'none', borderRadius: '7px', padding: '7px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={e => e.target.style.background = 'var(--text-secondary)'}
              onMouseLeave={e => e.target.style.background = '#ffffff'}
            >
              Salir
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '0.5px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 4px 32px rgba(0, 0, 0, 0.04)' }}>
            {/* Tabs */}
            <div style={{ borderBottom: '0.5px solid #e5e7eb', padding: '0 1.5rem' }}>
              <nav style={{ display: 'flex', gap: '4px', overflowX: 'auto' }}>
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '12px 20px',
                      fontSize: '13px',
                      fontWeight: 500,
                      fontFamily: 'DM Sans, sans-serif',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      color: activeTab === tab.id ? '#880000' : '#6b7280',
                      borderBottom: activeTab === tab.id ? '2px solid #880000' : '2px solid transparent'
                    }}
                    onMouseEnter={e => { if (activeTab !== tab.id) e.target.style.color = '#374151'; }}
                    onMouseLeave={e => { if (activeTab !== tab.id) e.target.style.color = '#6b7280'; }}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem' }}>
              {activeTab === 'stats' && (
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#111111', marginBottom: '1.5rem' }}>ðŸ“ˆ Panel de AnÃ¡lisis</h2>
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Cargando estadÃ­sticas...</div>
                  ) : (
                    <>
                      {/* Tarjetas de resumen */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        {[
                          { icon: 'ðŸ‘¨â€ðŸŽ“', label: 'Estudiantes Activos', value: stats.students, color: '#3b82f6' },
                          { icon: 'ðŸ‘¨â€ðŸ«', label: 'Maestros', value: stats.teachers, color: '#10b981' },
                          { icon: 'ðŸ“š', label: 'Materias', value: stats.subjects, color: '#8b5cf6' },
                          { icon: 'ðŸ“Š', label: 'Calificaciones', value: stats.grades, color: '#f59e0b' }
                        ].map((card, idx) => (
                          <div key={idx} style={{ background: `linear-gradient(135deg, ${card.color} 0%, ${card.color}cc 100%)`, borderRadius: '12px', padding: '1rem', color: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                            <div style={{ fontSize: '28px', marginBottom: '8px' }}>{card.icon}</div>
                            <div style={{ fontSize: '28px', fontWeight: 700 }}>{card.value}</div>
                            <div style={{ fontSize: '12px', opacity: 0.9 }}>{card.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* MÃ©tricas clave */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem', textAlign: 'center' }}>
                          <p style={{ fontSize: '12px', color: '#6b7280' }}>Promedio General</p>
                          <p style={{ fontSize: '36px', fontWeight: 700, color: '#880000' }}>{stats.average.toFixed(1)}</p>
                          <p style={{ fontSize: '10px', color: '#9ca3af' }}>Sobre 10</p>
                        </div>
                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem', textAlign: 'center' }}>
                          <p style={{ fontSize: '12px', color: '#6b7280' }}>Tasa de AprobaciÃ³n</p>
                          <p style={{ fontSize: '36px', fontWeight: 700, color: '#10b981' }}>
                            {stats.passed + stats.failed > 0 ? Math.round((stats.passed / (stats.passed + stats.failed)) * 100) : 0}%
                          </p>
                          <p style={{ fontSize: '10px', color: '#9ca3af' }}>{stats.passed} aprobados / {stats.failed} reprobados</p>
                        </div>
                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem', textAlign: 'center' }}>
                          <p style={{ fontSize: '12px', color: '#6b7280' }}>En Progreso</p>
                          <p style={{ fontSize: '36px', fontWeight: 700, color: '#f59e0b' }}>{stats.inProgress}</p>
                          <p style={{ fontSize: '10px', color: '#9ca3af' }}>Sin calificaciÃ³n completa</p>
                        </div>
                      </div>

                      {/* GrÃ¡ficos */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem' }}>
                          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '1rem' }}>DistribuciÃ³n de Rendimiento</h3>
                          <div style={{ height: '250px' }}>
                            <Pie data={distributionData} options={{ maintainAspectRatio: false }} />
                          </div>
                        </div>
                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem' }}>
                          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '1rem' }}>Promedio por Materia</h3>
                          <div style={{ height: '250px' }}>
                            {stats.subjectStats.length === 0 ? (
                              <div style={{ textAlign: 'center', paddingTop: '80px', color: '#9ca3af' }}>Sin datos suficientes</div>
                            ) : (
                              <Bar data={barData} options={barOptions} />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tabla de materias */}
                      {stats.subjectStats.length > 0 && (
                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
                          <h3 style={{ fontSize: '14px', fontWeight: 600, padding: '1rem', borderBottom: '0.5px solid #e5e7eb' }}>Desglose por Materia</h3>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', fontSize: '13px' }}>
                              <thead style={{ background: '#f9fafb' }}>
                                <tr>
                                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Materia</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Estudiantes</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Promedio</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Rendimiento</th>
                                </tr>
                              </thead>
                              <tbody>
                                {stats.subjectStats.map((subj, idx) => {
                                  const promedio = Number(subj.promedio);
                                  const isInvalid = isNaN(promedio);
                                  const barColor = isInvalid ? colors.neutral : (promedio < 6 ? colors.errorStrong : (promedio < 9 ? colors.warning : colors.success));
                                  const percent = isInvalid ? 0 : (promedio / 10) * 100;
                                  return (
                                    <tr key={idx} style={{ borderBottom: '0.5px solid #f0f0f0' }}>
                                      <td style={{ padding: '10px 16px' }}>{subj.subject_code}</td>
                                      <td style={{ padding: '10px 16px' }}>{subj.estudiantes || 0}</td>
                                      <td style={{ padding: '10px 16px' }}>{isInvalid ? 'N/A' : promedio.toFixed(2)}</td>
                                      <td style={{ padding: '10px 16px', width: '200px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <div style={{ flex: 1, background: '#e5e7eb', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                                            <div style={{ width: `${percent}%`, height: '100%', background: barColor, borderRadius: '9999px' }} />
                                          </div>
                                          <span style={{ fontSize: '11px', color: '#6b7280' }}>{Math.round(percent)}%</span>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {activeTab === 'materias' && <MateriasManager />}
              {activeTab === 'grades' && <GradesViewer />}
              {activeTab === 'students' && <StudentsManager />}
              {activeTab === 'groups' && <GroupsManager />}
              {activeTab === 'users' && <UsersManager />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default AdminDashboard;

```

```jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import justoSierraLogo from '../assets/justo-sierra-logo-transparent.png';

const roles = ['alumno', 'maestro', 'director'];
const roleLabels = { alumno: 'Alumno', maestro: 'Maestro', director: 'Director' };

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('alumno');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const result = await login(username, password, role);
    setIsLoading(false);
    if (result.success) {
      if (result.role === 'alumno') navigate('/alumno');
      else if (result.role === 'maestro') navigate('/maestro');
      else if (result.role === 'director') navigate('/admin');
    } else {
      setError(result.error);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&display=swap');

        .login-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f5f5;
          font-family: 'DM Sans', sans-serif;
          padding: 1rem;
        }

        .login-card {
          background: #ffffff;
          border: 0.5px solid #e5e7eb;
          border-radius: 16px;
          padding: 2.5rem;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 4px 32px rgba(0, 0, 0, 0.07);
        }

        .login-brand {
          text-align: center;
          margin-bottom: 2rem;
        }

        .login-icon {
          width: 70px;
          height: 70px;
          background: transparent;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.9rem;
          overflow: hidden;
        }

        .login-icon img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        .login-title {
          font-family: 'DM Serif Display', serif;
          font-size: 24px;
          font-weight: 400;
          color: #111111;
          margin: 0 0 4px;
        }

        .login-subtitle {
          font-size: 13px;
          color: #9ca3af;
          margin: 0;
        }

        .role-tabs {
          display: flex;
          gap: 6px;
          background: #5a5a5a;
          border-radius: 10px;
          padding: 4px;
          margin-bottom: 1.5rem;
        }

        .role-tab {
          flex: 1;
          padding: 9px 4px;
          border: none;
          border-radius: 7px;
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          color: #9ca3af;
          background: transparent;
        }

        .role-tab.active {
          background: #ffffff;
          color: var(--brand);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
        }

        .login-field {
          margin-bottom: 1.25rem;
        }

        .login-label {
          display: block;
          font-size: 11px;
          font-weight: 500;
          color: #9ca3af;
          margin-bottom: 6px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .login-input {
          width: 100%;
          background: #fafafa;
          border: 0.5px solid #e5e7eb;
          border-radius: 8px;
          padding: 11px 14px;
          font-size: 14px;
          color: #111111;
          font-family: 'DM Sans', sans-serif;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }

        .login-input:focus {
          border-color: var(--brand);
          background: #ffffff;
        }

        .login-input::placeholder {
          color: #d1d5db;
        }

        .login-error {
          background: var(--error-bg);
          border: 0.5px solid var(--error-border);
          color: var(--error-text);
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 1.25rem;
        }

        .login-btn {
          width: 100%;
          padding: 13px;
          background: var(--brand);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 14px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          margin-top: 0.5rem;
          letter-spacing: 0.02em;
          transition: background 0.2s;
        }

        .login-btn:hover:not(:disabled) {
          background: var(--brand-hover);
        }

        .login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .login-footer {
          text-align: center;
          font-size: 12px;
          color: var(--brand);
          margin-top: 1.5rem;
          cursor: pointer;
        }
      `}</style>

      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-brand">
            <div className="login-icon">
              <img src={justoSierraLogo} alt="Justo Sierra" />
            </div>
            <h1 className="login-title">Bienvenido a Justo Sierra</h1>
            <p className="login-subtitle">CalSys Â· Sistema Escolar</p>
          </div>

          <div className="role-tabs">
            {roles.map((r) => (
              <button
                key={r}
                type="button"
                className={`role-tab ${role === r ? 'active' : ''}`}
                onClick={() => setRole(r)}
              >
                {roleLabels[r]}
              </button>
            ))} 
          </div>

          {error && <div className="login-error">{error}</div>}

          <div className="login-field">
            <label className="login-label">Usuario / MatrÃ­cula</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input"
              placeholder="Ingresa tu matrÃ­cula"
              required
            />
          </div>

          <div className="login-field">
            <label className="login-label">ContraseÃ±a</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              required
            />
          </div>

          <button
            type="button"
            disabled={isLoading}
            className="login-btn"
            onClick={handleSubmit}
          >
            {isLoading ? 'Ingresando...' : 'Ingresar â†’'}
          </button>

          <p className="login-footer">Â¿Problemas para ingresar? Contacta a soporte</p>
        </div>
      </div>
    </>
  );
}

export default Login;

```

```jsx
import AdminDashboard from './AdminDashboard';

function DirectorDashboard() {
  return <AdminDashboard />;
}

export default DirectorDashboard;
```

```jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import PartialManager from '../components/PartialManager';
import api from '../api/axios';
import justoSierraLogo from '../assets/justo-sierra-logo.jpg';

function MaestroDashboard() {
  const { user, logout } = useAuth();
  const [semester, setSemester] = useState('2025-1');
  const [subject, setSubject] = useState('');
  const [group, setGroup] = useState('');
  const [subjectsList, setSubjectsList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.id) loadTeacherSubjects();
  }, [user, semester]);

  const loadTeacherSubjects = async () => {
    setLoading(true);
    setError('');
    try {
      if (!user?.id) { setError('Usuario no autenticado'); setLoading(false); return; }
      const response = await api.get('/grades/teacher/subjects', {
        params: { teacherId: user.id, semester }
      });
      if (response.data.subjects?.length) {
        setSubjectsList(response.data.subjects);
        const first = response.data.subjects[0];
        setSubject(first.subject_code);
        setGroup(first.group_code || '');
        if (first.subject_code) loadGroups(first.subject_code);
      } else {
        setSubjectsList([]);
        setSubject('');
        setGroup('');
      }
    } catch (err) {
      setError('Error al cargar materias: ' + (err.response?.data?.error || 'Error de conexiÃ³n'));
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async (subjectCode) => {
    try {
      if (!user?.id) { setError('Usuario no autenticado'); return; }
      const response = await api.get('/grades/subject/groups', {
        params: { teacherId: user.id, semester, subjectCode }
      });
      setGroupsList(response.data.groups || []);
    } catch (err) {
      setError('Error al cargar grupos: ' + (err.response?.data?.error || 'Error de conexiÃ³n'));
    }
  };

  const handleSubjectChange = async (e) => {
    const newSubject = e.target.value;
    setSubject(newSubject);
    const subjectData = subjectsList.find(s => s.subject_code === newSubject);
    setGroup(subjectData?.group_code || '');
    await loadGroups(newSubject);
  };

  if (loading) return (
    <div className="maestro-loading">Cargando materias...</div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .maestro-loading {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f5f5;
          font-family: 'DM Sans', sans-serif;
          color: #6b7280;
          font-size: 14px;
        }

        .maestro-wrapper {
          min-height: 100vh;
          background: #f5f5f5;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
        }

        .maestro-nav {
          background: #880000;
          border-bottom: 0.5px solid #e5e7eb;
          padding: 0 2rem;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .maestro-nav-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .maestro-nav-dot {
          width: 26px;
          height: 26px;
          background: #ffffff;
          border-radius: 50%;
          object-fit: cover;
          display: block;
          box-shadow: 0 1px 5px rgba(0, 0, 0, 0.18);
        }

        .maestro-nav-title {
          font-size: 15px;
          font-weight: 600;
          color: #ffffff;
        }

        .maestro-nav-right {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .maestro-nav-user {
          font-size: 13px;
          color: #ffffff;
        }

        .maestro-nav-btn {
          background: #ffffff;
          color: black;
          border: none;
          border-radius: 7px;
          padding: 7px 16px;
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .maestro-nav-btn:hover {
          background: var(--text-secondary);
        }

        .maestro-main-content {
          flex: 1;
          padding: 1.5rem;
          overflow-y: auto;
        }

        .maestro-filters-card {
          background: #ffffff;
          border: 0.5px solid #e5e7eb;
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 4px 32px rgba(0, 0, 0, 0.04);
        }

        .maestro-filters-title {
          font-size: 18px;
          font-weight: 500;
          color: #111111;
          margin-bottom: 1.5rem;
        }

        .maestro-alert {
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 1.25rem;
        }

        .maestro-alert-error {
          background: var(--error-bg);
          border: 0.5px solid var(--error-border);
          color: var(--error-text);
        }

        .maestro-alert-warning {
          background: var(--warning-bg);
          border: 0.5px solid #f59e0b;
          color: var(--warning-text);
        }

        .maestro-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }

        .maestro-field label {
          display: block;
          font-size: 11px;
          font-weight: 500;
          color: #9ca3af;
          letter-spacing: 0.06em; 
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .maestro-select {
          width: 100%;
          background: #fafafa;
          border: 0.5px solid #e5e7eb;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 13px;
          color: #111111;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          appearance: none;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
        }

        .maestro-select:focus {
          border-color: var(--brand);
          background: #ffffff;
        }

        .maestro-select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .maestro-partial-container {
          background: #ffffff;
          border: 0.5px solid #e5e7eb;
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 4px 32px rgba(0, 0, 0, 0.04);
        }

        .maestro-partial-container > * {
          width: 100%;
        }
      `}</style>

      <div className="maestro-wrapper">
        <nav className="maestro-nav">
          <div className="maestro-nav-left">
            <img className="maestro-nav-dot" src={justoSierraLogo} alt="Justo Sierra" />
            <span className="maestro-nav-title">Calsys Â· Maestro</span>
          </div>
          <div className="maestro-nav-right">
            <span className="maestro-nav-user">
              Hola, {user?.firstName} {user?.lastName}
            </span>
            <button className="maestro-nav-btn" onClick={logout}>Salir</button>
          </div>
        </nav>

        <div className="maestro-main-content">
          <div className="maestro-filters-card">
            <p className="maestro-filters-title">Captura de Calificaciones</p>

            {error && (
              <div className="maestro-alert maestro-alert-error">{error}</div>
            )}
            {!error && !subjectsList.length && (
              <div className="maestro-alert maestro-alert-warning">
                No tienes materias asignadas para este semestre.
              </div>
            )}

            <div className="maestro-grid">
              <div className="maestro-field">
                <label>Semestre</label>
                <select
                  value={semester}
                  onChange={e => setSemester(e.target.value)}
                  className="maestro-select"
                >
                  <option value="2025-1">2025-1</option>
                  <option value="2024-2">2024-2</option>
                  <option value="2024-1">2024-1</option>
                </select>
              </div>

              <div className="maestro-field">
                <label>Materia</label>
                <select
                  value={subject}
                  onChange={handleSubjectChange}
                  className="maestro-select"
                  disabled={!subjectsList.length}
                >
                  {subjectsList.map(s => (
                    <option key={s.subject_code} value={s.subject_code}>
                      {s.subject_code} ({s.total_students} alumnos)
                    </option>
                  ))}
                </select>
              </div>

              <div className="maestro-field">
                <label>Grupo</label>
                <select
                  value={group}
                  onChange={e => setGroup(e.target.value)}
                  className="maestro-select"
                  disabled={!groupsList.length}
                >
                  {groupsList.map(g => (
                    <option key={g.group_code} value={g.group_code}>
                      Grupo {g.group_code} ({g.total_students} alumnos)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {subject && (
            <div className="maestro-partial-container">
              <PartialManager
                semester={semester}
                subject={subject}
                group={group}
                teacherId={user?.id}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default MaestroDashboard;

```

```js
import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  const csrfToken = sessionStorage.getItem('csrfToken');
  const method = (config.method || 'get').toLowerCase();

  if (method === 'delete' && config.data === undefined) {
    config.data = {};
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (csrfToken && !['get', 'head', 'options'].includes(method)) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

export default api;

```

```jsx
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = sessionStorage.getItem('token');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        try {
          const response = await api.get('/auth/me');
          setUser(response.data.user);
        } catch (error) {
          console.error('Error al verificar token:', error);
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('csrfToken');
          delete api.defaults.headers.common['Authorization'];
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (username, password, role) => {
    try {
      const response = await api.post('/auth/login', { username, password, role });
      const { token, csrfToken, user: userData } = response.data;
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('csrfToken', csrfToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
      return { success: true, role: userData.role, mustChangePassword: userData.mustChangePassword };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.response?.data?.error || 'Error al iniciar sesiÃ³n' };
    }
  };

  const changePassword = async (currentPassword, newPassword, confirmPassword) => {
    try {
      const response = await api.post('/auth/change-password', { currentPassword, newPassword, confirmPassword });
      const { token, csrfToken, user: userData } = response.data;
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('csrfToken', csrfToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
      return { success: true, role: userData.role };
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, error: error.response?.data?.error || 'Error al cambiar contrasena' };
    }
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('csrfToken');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

```

```jsx
import { useState } from 'react';
import PartialGradesTable from './PartialGradesTable';
import AttendanceTable from './AttendanceTable';

const tabs = [
  { id: 1, label: 'Parcial 1', icon: 'ti-book' },
  { id: 2, label: 'Parcial 2', icon: 'ti-book-2' },
  { id: 3, label: 'Parcial 3', icon: 'ti-books' },
  { id: 4, label: 'Examen Final', icon: 'ti-pencil' },
  { id: 5, label: 'Cal. Final', icon: 'ti-award' },
  { id: 6, label: 'Asistencia', icon: 'ti-calendar-check' },
];

function PartialManager({ semester, subject, group, teacherId }) {
  const [activeTab, setActiveTab] = useState(1);

  return (
    <>
      <style>{`
        @import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css');

        .pm-wrapper {
          font-family: 'DM Sans', sans-serif;
        }

        .pm-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 1.5rem;
          border-bottom: 0.5px solid #e5e7eb;
          padding-bottom: 1rem;
        }

        .pm-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          background: #f3f4f6;
          font-size: 13px;
          font-weight: 500;
          color: #4b5563;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.2s;
          border: 0.5px solid #e5e7eb;
        }

        .pm-tab i {
          font-size: 16px;
        }

        .pm-tab:hover {
          background: #e5e7eb;
          color: #111111;
        }

        .pm-tab.pm-tab-active {
          background: var(--brand);
          color: #ffffff;
          border-color: var(--brand);
        }

        .pm-content {
          background: #ffffff;
          border-radius: 8px;
          padding: 0;
        }
      `}</style>

      <div className="pm-wrapper">
        <nav className="pm-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pm-tab ${activeTab === tab.id ? 'pm-tab-active' : ''}`}
            >
              <i className={`ti ${tab.icon}`} aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="pm-content">
          {activeTab === 1 && <PartialGradesTable partialId={1} semester={semester} subject={subject} group={group} teacherId={teacherId} showSpecial={false} />}
          {activeTab === 2 && <PartialGradesTable partialId={2} semester={semester} subject={subject} group={group} teacherId={teacherId} showSpecial={false} />}
          {activeTab === 3 && <PartialGradesTable partialId={3} semester={semester} subject={subject} group={group} teacherId={teacherId} showSpecial={false} />}
          {activeTab === 4 && <PartialGradesTable partialId={4} semester={semester} subject={subject} group={group} teacherId={teacherId} showSpecial={false} />}
          {activeTab === 5 && <PartialGradesTable partialId={5} semester={semester} subject={subject} group={group} teacherId={teacherId} showSpecial={true} />}
          {activeTab === 6 && <AttendanceTable semester={semester} subject={subject} group={group} teacherId={teacherId} />}
        </div>
      </div>
    </>
  );
}

export default PartialManager;
```

```jsx
import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../api/axios';
import ColumnConfig from './ColumnConfig';

registerAllModules();

const EXAMEN_FINAL_PARTIAL_ID = 4;
const CALIFICACION_FINAL_PARTIAL_ID = 5;

function PartialGradesTable({ partialId, semester, subject, group, teacherId, showSpecial = false }) {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const hotRef = useRef(null);
  const isUpdating = useRef(false);
  const isCalificacionFinalTab = partialId === CALIFICACION_FINAL_PARTIAL_ID;

  const safeColumns = () => (Array.isArray(columns) ? columns.filter(c => c && typeof c === 'object') : []);

  useEffect(() => {
    loadConfig();
  }, [partialId, semester, subject, group, teacherId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const params = { teacherId, semester, subject, partialId };
      if (group && group !== '') params.group = group;
      const res = await api.get('/partials/config', { params });
      let cols = res.data.columns || [];
      if (!Array.isArray(cols)) cols = [];
      const valid = cols.filter(c => c && typeof c === 'object');
      setColumns(valid);
      await loadGrades();
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const loadGrades = async () => {
    try {
      const params = { teacherId, semester, subject, partialId };
      if (group && group !== '') params.group = group;
      const res = await api.get('/partials/grades', { params });
      const raw = res.data.grades || [];
      const cfg = res.data.columns || [];
      const validCfg = Array.isArray(cfg) ? cfg.filter(c => c && typeof c === 'object') : [];
      const table = raw.map(g => {
        const row = [g.matricula, g.nombre];
        validCfg.forEach(col => {
          const val = g[`col_${col.column_name}`];
          const num = parseFloat(val);
          row.push(!isNaN(num) && val !== null && val !== '' ? num.toFixed(2) : '');
        });
        return row;
      });
      setData(table);
    } catch (error) {
      console.error(error);
      alert('Error al cargar calificaciones');
    } finally {
      setLoading(false);
    }
  };

  const calcularNotaFinal = (rowData, cols) => {
    let total = 0, peso = 0;
    for (let i = 0; i < cols.length; i++) {
      if (cols[i].is_special) continue;
      const val = parseFloat(rowData[2 + i]);
      if (!isNaN(val) && val !== '') {
        const w = parseFloat(cols[i].weight) || 0;
        const max = parseFloat(cols[i].max_value) || 10;
        total += (val / max) * 10 * (w / 100);
        peso += w;
      }
    }
    return peso > 0 ? parseFloat(total.toFixed(2)) : null;
  };

  const afterChange = (changes, source) => {
    if (isCalificacionFinalTab) return;
    if (!changes || source === 'loadData' || source === 'autoFinal') return;
    if (isUpdating.current) return;

    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    const safe = safeColumns();
    const affectedRows = new Set(changes.map(c => c[0]));
    isUpdating.current = true;
    for (let row of affectedRows) {
      const currentRow = hot.getDataAtRow(row);
      const finalColIndex = 2 + safe.length;
      const nota = calcularNotaFinal(currentRow, safe);
      const nuevoVal = nota !== null ? nota.toFixed(2) : '';
      const valorActual = hot.getDataAtCell(row, finalColIndex);
      if (valorActual !== nuevoVal) {
        hot.setDataAtCell(row, finalColIndex, nuevoVal, 'autoFinal');
      }
    }
    setTimeout(() => {
      isUpdating.current = false;
    }, 50);
  };

  const handleSaveConfig = async (newColumns) => {
    setSaving(true);
    try {
      await api.post('/partials/config', {
        teacherId, semester, subject, group, partialId, columns: newColumns
      });
      alert('ConfiguraciÃ³n guardada');
      setShowConfig(false);
      await loadConfig();
    } catch (error) {
      console.error(error);
      alert('Error al guardar configuraciÃ³n: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGrades = async () => {
    setSaving(true);
    try {
      const hot = hotRef.current.hotInstance;
      const tableData = hot.getData();
      const values = [];
      const safe = safeColumns();
      for (let rowIdx = 0; rowIdx < tableData.length; rowIdx++) {
        const row = tableData[rowIdx];
        const matricula = row[0];
        for (let colIdx = 0; colIdx < safe.length; colIdx++) {
          const col = safe[colIdx];
          if (isCalificacionFinalTab && col.is_special) continue;
          if (col.is_virtual) continue;
          const val = row[2 + colIdx];
          const valueToStore = (val !== '' && !isNaN(parseFloat(val))) ? val.toString() : null;
          values.push({ matricula, columnName: col.column_name, value: valueToStore });
        }
      }
      await api.post('/partials/save-grades', { teacherId, semester, subject, group, partialId, values });
      alert('Calificaciones guardadas exitosamente');
      await loadConfig();
    } catch (error) {
      console.error(error);
      alert('Error al guardar calificaciones');
    } finally {
      setSaving(false);
    }
  };

  const buildColumns = () => {
    const base = [
      { data: 0, title: 'MatrÃ­cula', readOnly: true, width: 100 },
      { data: 1, title: 'Nombre completo', readOnly: true, width: 220 }
    ];
    const safe = safeColumns();
    safe.forEach((col, idx) => {
      const isSpecialReadonly = isCalificacionFinalTab && !!col.is_special;
      base.push({
        data: 2 + idx,
        title: `${col.column_name}${col.is_special ? ' â­' : ''}`,
        type: 'numeric',
        numericFormat: { pattern: '0.00' },
        width: 140,
        readOnly: isSpecialReadonly || !!col.is_virtual,
        validator: (value, callback) => {
          if (isSpecialReadonly || col.is_virtual) {
            callback(true);
            return;
          }
          if (value === '' || value === null) {
            callback(true);
            return;
          }
          const num = parseFloat(value);
          const max = parseFloat(col.max_value) || 10;
          if (isNaN(num)) {
            callback(false);
          } else if (num < 0 || num > max) {
            callback(false);
          } else {
            callback(true);
          }
        },
        allowInvalid: false
      });
    });
    if (!isCalificacionFinalTab) {
      base.push({ 
        data: 2 + safe.length, 
        title: 'Promedio', 
        readOnly: true, 
        type: 'numeric', 
        numericFormat: { pattern: '0.00' }, 
        width: 100 
      });
    } else {
      base.push({ 
        data: 2 + safe.length, 
        title: 'FINAL', 
        readOnly: true, 
        type: 'numeric', 
        numericFormat: { pattern: '0.00' }, 
        width: 100 
      });
    }
    return base;
  };

  const hotSettings = {
    licenseKey: 'non-commercial-and-evaluation',
    stretchH: 'all',
    contextMenu: true,
    manualColumnResize: true,
    manualRowResize: true,
    filters: true,
    columnSorting: true,
    search: true,
    autoWrapRow: true,
    persistentState: true,
    rowHeaders: true,
    colHeaders: true,
    height: 500,
    width: '100%',
    className: 'htMiddle'
  };

  if (showConfig) {
    return <ColumnConfig columns={columns} onSave={handleSaveConfig} onCancel={() => setShowConfig(false)} showSpecialColumn={showSpecial} />;
  }

  if (loading) return (
    <div style={{ 
      textAlign: 'center', 
      padding: '3rem', 
      fontFamily: 'DM Sans, sans-serif', 
      color: '#6b7280',
      fontSize: '14px'
    }}>
      <div style={{ marginBottom: '8px' }}>â³</div>
      Cargando calificaciones...
    </div>
  );

  const partialName = partialId === 1 ? 'Primer Parcial' : partialId === 2 ? 'Segundo Parcial' : partialId === 3 ? 'Tercer Parcial' : partialId === 4 ? 'Examen Final' : 'CalificaciÃ³n Final';

  return (
    <>
      <style>{`
        .handsontable {
          font-family: 'DM Sans', sans-serif !important;
          font-size: 13px !important;
        }

        .handsontable thead th {
          background: linear-gradient(135deg, #f8f9fa 0%, #f1f3f5 100%) !important;
          color: #1f2937 !important;
          font-weight: 600 !important;
          font-size: 12px !important;
          letter-spacing: 0.3px !important;
          text-transform: uppercase !important;
          border-bottom: 2px solid #e5e7eb !important;
          border-right: 1px solid #e5e7eb !important;
          padding: 12px 8px !important;
        }

        .handsontable tbody td {
          border-right: 1px solid #f0f0f0 !important;
          border-bottom: 1px solid #f0f0f0 !important;
          padding: 8px 8px !important;
          color: #374151 !important;
        }

        .handsontable tbody tr:nth-child(even) td {
          background-color: #fafbfc !important;
        }

        .handsontable tbody tr:nth-child(odd) td {
          background-color: #ffffff !important;
        }

        .handsontable tbody td.readOnly {
          background-color: #f9fafb !important;
          color: #6b7280 !important;
          font-style: italic !important;
        }

        .handsontable tbody td:last-child {
          background-color: #fef3c7 !important;
          font-weight: 600 !important;
          color: #92400e !important;
          border-left: 1px solid #fde68a !important;
        }

        .handsontable tbody td:not(.readOnly):not(:empty) {
          font-weight: 500 !important;
        }

        .handsontable input {
          font-family: 'DM Sans', sans-serif !important;
          font-size: 13px !important;
          background-color: #ffffff !important;
          border: 2px solid var(--brand) !important;
          border-radius: 6px !important;
          padding: 4px 8px !important;
          box-shadow: 0 0 0 2px rgba(136, 0, 0, 0.1) !important;
        }

        .handsontable .wtHolder::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .handsontable .wtHolder::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }

        .handsontable .wtHolder::-webkit-scrollbar-thumb {
          background: var(--brand);
          border-radius: 4px;
        }

        .handsontable .wtHolder::-webkit-scrollbar-thumb:hover {
          background: var(--brand-hover);
        }

        .htContextMenu {
          font-family: 'DM Sans', sans-serif !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
          border: 1px solid #e5e7eb !important;
        }

        .htContextMenu .htItem:hover {
          background-color: #fef3c7 !important;
        }

        .handsontable .manualColumnResizer {
          background-color: #d1d5db !important;
          width: 3px !important;
        }

        .handsontable .manualColumnResizer:hover {
          background-color: var(--brand) !important;
        }

        .handsontable .rowHeader {
          background: #f8f9fa !important;
          color: #6b7280 !important;
          font-weight: 500 !important;
          font-size: 11px !important;
          text-align: center !important;
          border-right: 1px solid #e5e7eb !important;
        }
      `}</style>

      <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              background: 'var(--brand)',
              color: '#ffffff',
              borderRadius: '10px',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.5px'
            }}>
              {partialName}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#4b5563',
              fontSize: '13px'
            }}>
              <span style={{ fontWeight: 600, color: '#111111', fontSize: '15px' }}>{data.length}</span>
              <span>alumnos</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => setShowConfig(true)} 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#ffffff',
                color: '#4b5563',
                border: '1px solid #d1d5db',
                borderRadius: '10px',
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f9fafb';
                e.currentTarget.style.borderColor = '#9ca3af';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.borderColor = '#d1d5db';
              }}
            >
              <span style={{ fontSize: '15px' }}>âš™ï¸</span>
              Configurar
            </button>
            
            <button 
              onClick={handleSaveGrades} 
              disabled={saving} 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: saving ? '#9ca3af' : 'var(--brand)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '8px 24px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                transition: 'all 0.2s',
                boxShadow: saving ? 'none' : '0 2px 4px rgba(136, 0, 0, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!saving) {
                  e.currentTarget.style.background = 'var(--brand-hover)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(136, 0, 0, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!saving) {
                  e.currentTarget.style.background = 'var(--brand)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(136, 0, 0, 0.3)';
                }
              }}
            >
              {saving ? (
                <>
                  <span>â³</span>
                  Guardando...
                </>
              ) : (
                <>
                  <span>ðŸ’¾</span>
                  Guardar
                </>
              )}
            </button>
          </div>
        </div>

        {!isCalificacionFinalTab && (
          <div style={{
            marginBottom: '1.25rem',
            padding: '14px 18px',
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e6f4ff 100%)',
            borderLeft: '4px solid #0284c7',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '20px', lineHeight: 1 }}>
              {partialId === EXAMEN_FINAL_PARTIAL_ID ? 'ðŸ“' : 'ðŸ“Š'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: 600,
                color: '#0c4a6e',
                fontSize: '13px',
                marginBottom: '4px',
                letterSpacing: '0.3px'
              }}>
                {partialId === EXAMEN_FINAL_PARTIAL_ID ? 'CÃ¡lculo AutomÃ¡tico' : 'CÃ¡lculo AutomÃ¡tico del Parcial'}
              </div>
              <div style={{
                color: '#1e40af',
                fontSize: '12px',
                lineHeight: '1.4'
              }}>
                {partialId === EXAMEN_FINAL_PARTIAL_ID 
                  ? 'La calificaciÃ³n se calcula automÃ¡ticamente segÃºn los pesos configurados.'
                  : 'Edita las notas en las columnas numÃ©ricas. La calificaciÃ³n final se actualizarÃ¡ automÃ¡ticamente.'}
              </div>
            </div>
            <div style={{
              fontSize: '11px',
              color: '#0284c7',
              background: '#dbeafe',
              padding: '4px 10px',
              borderRadius: '20px',
              fontWeight: 500
            }}>
              âš¡ En vivo
            </div>
          </div>
        )}

        {isCalificacionFinalTab && (
          <div style={{
            marginBottom: '1.25rem',
            padding: '14px 18px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderLeft: '4px solid #d97706',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '20px', lineHeight: 1 }}>ðŸŽ¯</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: 600,
                color: '#92400e',
                fontSize: '13px',
                marginBottom: '4px',
                letterSpacing: '0.3px'
              }}>
                CalificaciÃ³n Final Global
              </div>
              <div style={{
                color: '#78350f',
                fontSize: '12px',
                lineHeight: '1.4'
              }}>
                Combina todos los parciales y actividades segÃºn los porcentajes configurados.
              </div>
            </div>
            <div style={{
              fontSize: '11px',
              color: '#92400e',
              background: '#fef3c7',
              padding: '4px 10px',
              borderRadius: '20px',
              fontWeight: 500
            }}>
              ðŸ“ˆ Integral
            </div>
          </div>
        )}

        <div style={{ 
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          background: '#ffffff',
          overflow: 'hidden'
        }}>
          <HotTable
            ref={hotRef}
            data={data}
            columns={buildColumns()}
            {...hotSettings}
            afterChange={afterChange}
          />
        </div>

        <div style={{
          marginTop: '1rem',
          padding: '10px 14px',
          background: '#f9fafb',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '11px',
          color: '#6b7280',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>ðŸ’¡ Consejo: Haz doble clic en una celda para editar</span>
            <span>ðŸ–±ï¸ Redimensiona columnas arrastrando los bordes</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#fef3c7', borderRadius: '2px' }}></span>
              Promedio
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#fafbfc', border: '1px solid #e5e7eb', borderRadius: '2px' }}></span>
              Editable
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#f9fafb', borderRadius: '2px' }}></span>
              Solo lectura
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export default PartialGradesTable;

```

```jsx
import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../api/axios';
import ColumnConfig from './ColumnConfig';

registerAllModules();

const EXAMEN_FINAL_PARTIAL_ID = 4;
const CALIFICACION_FINAL_PARTIAL_ID = 5;

function PartialGradesTable({ partialId, semester, subject, group, teacherId, showSpecial = false }) {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const hotRef = useRef(null);
  const isUpdating = useRef(false);
  const isCalificacionFinalTab = partialId === CALIFICACION_FINAL_PARTIAL_ID;

  const safeColumns = () => (Array.isArray(columns) ? columns.filter(c => c && typeof c === 'object') : []);

  useEffect(() => {
    loadConfig();
  }, [partialId, semester, subject, group, teacherId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const params = { teacherId, semester, subject, partialId };
      if (group && group !== '') params.group = group;
      const res = await api.get('/partials/config', { params });
      let cols = res.data.columns || [];
      if (!Array.isArray(cols)) cols = [];
      const valid = cols.filter(c => c && typeof c === 'object');
      if (valid.length === 0 && !showConfig) {
        setShowConfig(true);
        setLoading(false);
        return;
      }
      setColumns(valid);
      await loadGrades(valid);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const loadGrades = async (cols) => {
    try {
      const params = { teacherId, semester, subject, partialId };
      if (group && group !== '') params.group = group;
      const res = await api.get('/partials/grades', { params });
      const raw = res.data.grades || [];
      const cfg = res.data.columns || [];
      const validCfg = Array.isArray(cfg) ? cfg.filter(c => c && typeof c === 'object') : [];
      const table = raw.map(g => {
        const row = [g.matricula, g.nombre];
        validCfg.forEach(col => {
          const val = g[`col_${col.column_name}`];
          const num = parseFloat(val);
          row.push(!isNaN(num) && val !== null && val !== '' ? num.toFixed(2) : '');
        });
        return row;
      });
      setData(table);
    } catch (error) {
      console.error(error);
      alert('Error al cargar calificaciones');
    } finally {
      setLoading(false);
    }
  };

  const calcularNotaFinal = (rowData, cols) => {
    let total = 0, peso = 0;
    for (let i = 0; i < cols.length; i++) {
      if (cols[i].is_special) continue;
      const val = parseFloat(rowData[2 + i]);
      if (!isNaN(val) && val !== '') {
        const w = parseFloat(cols[i].weight) || 0;
        const max = parseFloat(cols[i].max_value) || 10;
        total += (val / max) * 10 * (w / 100);
        peso += w;
      }
    }
    return peso > 0 ? parseFloat(total.toFixed(2)) : null;
  };

  const afterChange = (changes, source) => {
    if (isCalificacionFinalTab) return;
    if (!changes || source === 'loadData' || source === 'autoFinal') return;
    if (isUpdating.current) return;

    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    const safe = safeColumns();
    const affectedRows = new Set(changes.map(c => c[0]));
    isUpdating.current = true;
    for (let row of affectedRows) {
      const currentRow = hot.getDataAtRow(row);
      const finalColIndex = 2 + safe.length;
      const nota = calcularNotaFinal(currentRow, safe);
      const nuevoVal = nota !== null ? nota.toFixed(2) : '';
      const valorActual = hot.getDataAtCell(row, finalColIndex);
      if (valorActual !== nuevoVal) {
        hot.setDataAtCell(row, finalColIndex, nuevoVal, 'autoFinal');
      }
    }
    setTimeout(() => {
      isUpdating.current = false;
    }, 50);
  };

  const handleSaveConfig = async (newColumns) => {
    setSaving(true);
    try {
      await api.post('/partials/config', {
        teacherId, semester, subject, group, partialId, columns: newColumns
      });
      alert('ConfiguraciÃ³n guardada');
      setShowConfig(false);
      await loadConfig();
    } catch (error) {
      console.error(error);
      alert('Error al guardar configuraciÃ³n: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGrades = async () => {
    setSaving(true);
    try {
      const hot = hotRef.current.hotInstance;
      const tableData = hot.getData();
      const values = [];
      const safe = safeColumns();
      for (let rowIdx = 0; rowIdx < tableData.length; rowIdx++) {
        const row = tableData[rowIdx];
        const matricula = row[0];
        for (let colIdx = 0; colIdx < safe.length; colIdx++) {
          const col = safe[colIdx];
          if (isCalificacionFinalTab && col.is_special) continue;
          if (col.is_virtual) continue;
          const val = row[2 + colIdx];
          const valueToStore = (val !== '' && !isNaN(parseFloat(val))) ? val.toString() : null;
          values.push({ matricula, columnName: col.column_name, value: valueToStore });
        }
      }
      await api.post('/partials/save-grades', { teacherId, semester, subject, group, partialId, values });
      alert('Calificaciones guardadas');
      await loadConfig();
    } catch (error) {
      console.error(error);
      alert('Error al guardar calificaciones');
    } finally {
      setSaving(false);
    }
  };

  const buildColumns = () => {
    const base = [
      { data: 0, title: 'MatrÃ­cula', readOnly: true, width: 100 },
      { data: 1, title: 'Nombre', readOnly: true, width: 200 }
    ];
    const safe = safeColumns();
    safe.forEach((col, idx) => {
      const isSpecialReadonly = isCalificacionFinalTab && !!col.is_special;
      base.push({
        data: 2 + idx,
        title: `${col.column_name}${col.is_special ? ' â­' : ''} (${col.weight}% / ${col.max_value})`,
        type: 'numeric',
        numericFormat: { pattern: '0.00' },
        width: 140,
        readOnly: isSpecialReadonly || !!col.is_virtual,
        validator: (value, callback) => {
          if (isSpecialReadonly || col.is_virtual) {
            callback(true);
            return;
          }
          if (value === '' || value === null) {
            callback(true);
            return;
          }
          const num = parseFloat(value);
          const max = parseFloat(col.max_value) || 10;
          if (isNaN(num)) {
            callback(false);
          } else if (num < 0 || num > max) {
            callback(false);
          } else {
            callback(true);
          }
        },
        allowInvalid: false
      });
    });
    if (!isCalificacionFinalTab) {
      base.push({ data: 2 + safe.length, title: 'ðŸ“Š Promedio Parcial', readOnly: true, type: 'numeric', numericFormat: { pattern: '0.00' }, width: 120 });
    } else {
      base.push({ data: 2 + safe.length, title: 'ðŸŽ¯ CALIFICACIÃ“N FINAL GLOBAL', readOnly: true, type: 'numeric', numericFormat: { pattern: '0.00' }, width: 150 });
    }
    return base;
  };

  if (showConfig) {
    return <ColumnConfig columns={columns} onSave={handleSaveConfig} onCancel={() => setShowConfig(false)} showSpecialColumn={showSpecial} />;
  }

  if (loading) return (
    <div style={{ 
      textAlign: 'center', 
      padding: '2rem', 
      fontFamily: 'DM Sans, sans-serif', 
      color: '#6b7280' 
    }}>
      Cargando...
    </div>
  );

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <h3 style={{ 
          fontSize: '1rem', 
          fontWeight: 600, 
          color: '#111111',
          margin: 0
        }}>
          {data.length} alumnos
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => setShowConfig(true)} 
            style={{
              background: '#4b5563',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.target.style.background = '#374151'}
            onMouseLeave={e => e.target.style.background = '#4b5563'}
          >
            âš™ï¸ Configurar Columnas
          </button>
          <button 
            onClick={handleSaveGrades} 
            disabled={saving} 
            style={{
              background: 'var(--brand)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 24px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => !saving && (e.target.style.background = 'var(--brand-hover)')}
            onMouseLeave={e => !saving && (e.target.style.background = 'var(--brand)')}
          >
            {saving ? 'Guardando...' : 'Guardar Calificaciones'}
          </button>
        </div>
      </div>

      <div style={{
        fontSize: '12px',
        marginBottom: '1rem',
        padding: '8px 12px',
        backgroundColor: 'var(--warning-bg)',
        borderRadius: '8px',
        color: 'var(--warning-text)'
      }}>
        {!isCalificacionFinalTab
          ? `ðŸ“Š La calificaciÃ³n final del ${partialId === EXAMEN_FINAL_PARTIAL_ID ? 'examen final' : 'parcial'} se calcula automÃ¡ticamente al editar las notas.`
          : 'â­ Las columnas especiales (Promedio de Parciales y CalificaciÃ³n Examen Final) se calculan automÃ¡ticamente.'}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <HotTable
          ref={hotRef}
          data={data}
          columns={buildColumns()}
          colHeaders={true}
          rowHeaders={true}
          width="100%"
          height="500"
          licenseKey="non-commercial-and-evaluation"
          stretchH="all"
          contextMenu={true}
          manualColumnResize={true}
          afterChange={afterChange}
        />
      </div>
    </div>
  );
}

export default PartialGradesTable;
```

```jsx
import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../api/axios';
import ColumnConfig from './ColumnConfig';

registerAllModules();

function GradesTable({ semester, subject, group, teacherId }) {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const hotRef = useRef(null);

  useEffect(() => {
    if (semester && subject && teacherId) loadConfig();
  }, [semester, subject, group, teacherId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const params = { teacherId, semester, subject };
      if (group) params.group = group;
      const response = await api.get('/columns/config', { params });
      if (response.data.columns.length === 0) {
        setShowConfig(true);
        setLoading(false);
        return;
      }
      setColumns(response.data.columns);
      await loadGrades(response.data.columns);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const loadGrades = async (cols) => {
    try {
      const params = { teacherId, semester, subject };
      if (group) params.group = group;
      const response = await api.get('/columns/with-custom', { params });
      const tableData = response.data.grades.map(g => {
        const row = [
          g.matricula,
          g.nombre,
          g.parcial_1 !== null ? parseFloat(g.parcial_1).toFixed(2) : '',
          g.parcial_2 !== null ? parseFloat(g.parcial_2).toFixed(2) : '',
          g.parcial_3 !== null ? parseFloat(g.parcial_3).toFixed(2) : '',
          g.promedio_parciales !== null ? parseFloat(g.promedio_parciales).toFixed(2) : '',
          g.ordinario !== null ? parseFloat(g.ordinario).toFixed(2) : ''
        ];
        cols.forEach(col => {
          if (!col.is_special) {
            const val = g[`col_${col.id}`];
            row.push(val !== null ? parseFloat(val).toFixed(2) : '');
          }
        });
        row.push(g.final_grade !== null ? parseFloat(g.final_grade).toFixed(2) : '');
        row.push(g.status === 'passed' ? 'Aprobado' : g.status === 'failed' ? 'Reprobado' : 'En Progreso');
        return row;
      });
      setData(tableData);
    } catch (error) {
      console.error(error);
      alert('Error al cargar calificaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (newColumns) => {
    try {
      await api.post('/columns/config', { teacherId, semester, subject, group, columns: newColumns });
      setShowConfig(false);
      loadConfig();
      alert('ConfiguraciÃ³n guardada');
    } catch (error) {
      alert('Error al guardar configuraciÃ³n');
    }
  };

  const handleSaveGrades = async () => {
    setSaving(true);
    try {
      const hot = hotRef.current.hotInstance;
      const tableData = hot.getData();
      const values = [];
      const parciales = {};
      const ordinarios = {};

      const normalColumns = columns.filter(c => !c.is_special);
      const personalStartIndex = 7;

      tableData.forEach(row => {
        const matricula = row[0];
        const p1 = row[2] !== '' ? parseFloat(row[2]) : null;
        const p2 = row[3] !== '' ? parseFloat(row[3]) : null;
        const p3 = row[4] !== '' ? parseFloat(row[4]) : null;
        const ord = row[6] !== '' ? parseFloat(row[6]) : null;
        
        if (p1 !== null || p2 !== null || p3 !== null) {
          parciales[matricula] = { parcial_1: p1, parcial_2: p2, parcial_3: p3 };
        }
        if (ord !== null) {
          ordinarios[matricula] = ord;
        }
        
        normalColumns.forEach((col, idx) => {
          const val = row[personalStartIndex + idx];
          if (val !== '' && !isNaN(val)) {
            values.push({ matricula, columnId: col.id, value: val.toString() });
          }
        });
      });

      await api.post('/columns/save-custom', { values, parciales, ordinarios, semester, subject, group, teacherId });
      alert('âœ… Calificaciones guardadas');
      loadConfig();
    } catch (error) {
      console.error(error);
      alert('Error al guardar calificaciones');
    } finally {
      setSaving(false);
    }
  };

  const buildColumns = () => {
    const cols = [
      { data: 0, title: 'MatrÃ­cula', readOnly: true, width: 100 },
      { data: 1, title: 'Nombre', readOnly: true, width: 200 },
      { data: 2, title: 'Parcial 1', type: 'numeric', numericFormat: { pattern: '0.00' }, width: 100 },
      { data: 3, title: 'Parcial 2', type: 'numeric', numericFormat: { pattern: '0.00' }, width: 100 },
      { data: 4, title: 'Parcial 3', type: 'numeric', numericFormat: { pattern: '0.00' }, width: 100 },
      { data: 5, title: 'â­ Promedio Parciales', readOnly: true, type: 'numeric', numericFormat: { pattern: '0.00' }, width: 150 },
      { data: 6, title: 'ðŸ“ EvaluaciÃ³n Final', type: 'numeric', numericFormat: { pattern: '0.00' }, width: 130 }
    ];
    
    const normalColumns = columns.filter(c => !c.is_special);
    normalColumns.forEach(col => {
      cols.push({
        data: 7 + cols.length,
        title: `${col.column_name} (${col.weight}% / ${col.max_value})`,
        type: 'numeric',
        numericFormat: { pattern: '0.00' },
        width: 130
      });
    });
    
    cols.push({
      data: 7 + cols.length,
      title: 'ðŸŽ¯ CALIFICACION FINAL',
      readOnly: true,
      type: 'numeric',
      numericFormat: { pattern: '0.00' },
      width: 140
    });
    
    cols.push({
      data: 8 + cols.length,
      title: 'Estado',
      readOnly: true,
      width: 110
    });
    
    return cols;
  };

  const afterChange = (changes, source) => {
    if (!changes || source === 'loadData') return;
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    changes.forEach(([row, prop, oldValue, newValue]) => {
      if ([2, 3, 4, 6].includes(prop)) {
        const p1 = parseFloat(hot.getDataAtCell(row, 2)) || 0;
        const p2 = parseFloat(hot.getDataAtCell(row, 3)) || 0;
        const p3 = parseFloat(hot.getDataAtCell(row, 4)) || 0;
        const promedio = (p1 + p2 + p3) / 3;
        hot.setDataAtCell(row, 5, promedio.toFixed(2), 'thisChange');
        recalcularFinal(hot, row);
      }
      
      const normalCount = columns.filter(c => !c.is_special).length;
      const personalStart = 7;
      if (prop >= personalStart && prop < personalStart + normalCount) {
        recalcularFinal(hot, row);
      }
    });
  };

  const recalcularFinal = (hot, rowIndex) => {
    const p1 = parseFloat(hot.getDataAtCell(rowIndex, 2)) || 0;
    const p2 = parseFloat(hot.getDataAtCell(rowIndex, 3)) || 0;
    const p3 = parseFloat(hot.getDataAtCell(rowIndex, 4)) || 0;
    const promedio = (p1 + p2 + p3) / 3;
    const ordinario = parseFloat(hot.getDataAtCell(rowIndex, 6)) || 0;

    let total = 0, pesoTotal = 0;
    const specialCol = columns.find(c => c.is_special === 1);
    if (specialCol) {
      total += (promedio * (specialCol.weight / 100));
      pesoTotal += specialCol.weight;
    }
    
    const normalColumns = columns.filter(c => !c.is_special);
    const personalStart = 7;
    normalColumns.forEach((col, idx) => {
      const val = parseFloat(hot.getDataAtCell(rowIndex, personalStart + idx)) || 0;
      const w = parseFloat(col.weight) || 0;
      const maxVal = parseFloat(col.max_value) || 10;
      if (val > 0) {
        total += ((val / maxVal) * 10) * (w / 100);
        pesoTotal += w;
      }
    });
    
    const finalGrade = pesoTotal > 0 ? parseFloat(total.toFixed(2)) : null;
    const finalColIndex = personalStart + normalColumns.length;
    hot.setDataAtCell(rowIndex, finalColIndex, finalGrade, 'thisChange');
    const status = finalGrade >= 6 ? 'Aprobado' : finalGrade !== null ? 'Reprobado' : 'En Progreso';
    hot.setDataAtCell(rowIndex, finalColIndex + 1, status, 'thisChange');
  };

  if (showConfig) {
    return <ColumnConfig columns={columns} onSave={handleSaveConfig} onCancel={() => setShowConfig(false)} />;
  }

  if (loading) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '2rem', 
        fontFamily: 'DM Sans, sans-serif', 
        color: '#6b7280' 
      }}>
        Cargando...
      </div>
    );
  }

  if (!semester || !subject) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '2rem', 
        fontFamily: 'DM Sans, sans-serif', 
        color: '#9ca3af' 
      }}>
        Selecciona semestre y materia
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <h3 style={{ 
          fontSize: '1rem', 
          fontWeight: 600, 
          color: '#111111',
          margin: 0
        }}>
          {data.length} alumnos
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => setShowConfig(true)} 
            style={{
              background: '#4b5563',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.target.style.background = '#374151'}
            onMouseLeave={e => e.target.style.background = '#4b5563'}
          >
            âš™ï¸ Configurar Columnas
          </button>
          <button 
            onClick={handleSaveGrades} 
            disabled={saving} 
            style={{
              background: 'var(--brand)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 24px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => !saving && (e.target.style.background = 'var(--brand-hover)')}
            onMouseLeave={e => !saving && (e.target.style.background = 'var(--brand)')}
          >
            {saving ? 'Guardando...' : 'Guardar Calificaciones'}
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <HotTable
          ref={hotRef}
          data={data}
          columns={buildColumns()}
          colHeaders={true}
          rowHeaders={true}
          width="100%"
          height="500"
          licenseKey="non-commercial-and-evaluation"
          stretchH="all"
          contextMenu={true}
          manualColumnResize={true}
          afterChange={afterChange}
        />
      </div>
    </div>
  );
}

export default GradesTable; 
```

```jsx
import { useState, useEffect } from 'react';

function ColumnConfig({ columns, onSave, onCancel, showSpecialColumn = true }) {
  const [localColumns, setLocalColumns] = useState([]);

  useEffect(() => {
    const specials = (columns || []).filter(c => c.is_special).map(col => ({
      name: col.column_name || col.name || '',
      type: 'numeric',
      maxValue: col.max_value || col.maxValue || 10,
      weight: col.weight || 0,
      required: col.is_required || col.required || false,
      is_special: true
    }));
    let normals = (columns || []).filter(c => !c.is_special).map(col => ({
      name: col.column_name || col.name || '',
      type: col.column_type || col.type || 'numeric',
      maxValue: col.max_value || col.maxValue || 10,
      weight: col.weight || 0,
      required: col.is_required || col.required || false,
      is_special: false
    }));
    if (showSpecialColumn) {
      if (specials.length > 0) {
        setLocalColumns([...specials, ...normals]);
      } else {
        setLocalColumns([
          { name: 'Promedio de Parciales', type: 'numeric', maxValue: 10, weight: 0, required: false, is_special: true },
          ...normals
        ]);
      }
    } else {
      setLocalColumns(normals);
    }
  }, [columns, showSpecialColumn]);

  const addColumn = () => {
    setLocalColumns([...localColumns, { name: '', type: 'numeric', maxValue: 10, weight: 0, required: false, is_special: false }]);
  };

  const updateColumn = (idx, field, val) => {
    const updated = [...localColumns];
    if (updated[idx].is_special && field !== 'weight' && field !== 'required' && field !== 'name') return;
    if (field === 'maxValue' || field === 'weight') {
      const num = val === '' ? '' : parseFloat(val);
      updated[idx][field] = num === '' || isNaN(num) ? 0 : num;
    } else if (field === 'type') {
      updated[idx][field] = val;
      if (val === 'text') updated[idx].weight = 0;
    } else {
      updated[idx][field] = val;
    }
    setLocalColumns(updated);
  };

  const removeColumn = (idx) => {
    if (localColumns[idx].is_special) {
      alert('No se puede eliminar una columna especial');
      return;
    }
    setLocalColumns(localColumns.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const normals = localColumns.filter(c => !c.is_special);
    if (!normals.every(c => c.name && c.name.trim())) {
      alert('Todas las columnas deben tener un nombre');
      return;
    }
    const totalWeight = localColumns
      .filter(c => c.type === 'numeric')
      .reduce((s, c) => s + (parseFloat(c.weight) || 0), 0);
    if (totalWeight > 100) {
      alert(`La suma de pesos es ${totalWeight.toFixed(1)}%. No puede superar 100%`);
      return;
    }
    if (totalWeight < 100 && totalWeight > 0 && !window.confirm(`La suma de pesos es ${totalWeight.toFixed(1)}% (falta ${(100 - totalWeight).toFixed(1)}%). Â¿Continuar?`)) return;
    const validatedColumns = localColumns.map(c => ({
      name: c.name.trim(),
      type: c.type || 'numeric',
      maxValue: parseFloat(c.maxValue) || 10,
      weight: c.type === 'text' ? 0 : (parseFloat(c.weight) || 0),
      required: c.required || false,
      is_special: c.is_special || false
    }));
    onSave(validatedColumns);
  };

  const totalWeight = localColumns
    .filter(c => c.type === 'numeric')
    .reduce((s, c) => s + (parseFloat(c.weight) || 0), 0);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
      fontFamily: 'DM Sans, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        maxWidth: '1000px',
        width: '100%',
        maxHeight: '95vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{
          background: '#880000',
          padding: '1.5rem',
          color: '#ffffff'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>Configurar Columnas de EvaluaciÃ³n</h2>
          <p style={{ color: '#fca5a5' }}>{showSpecialColumn ? 'Las filas especiales son de solo lectura y su peso es configurable.' : 'Define las actividades que componen este parcial.'}</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          <div style={{
            marginBottom: '1.5rem',
            backgroundColor: '#f9fafb',
            border: '0.5px solid #e5e7eb',
            borderRadius: '12px',
            padding: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#4b5563' }}>PonderaciÃ³n Total:</span>
              <span style={{
                fontSize: '24px',
                fontWeight: 700,
                color: totalWeight > 100 ? 'var(--error)' : totalWeight === 100 ? 'var(--success)' : 'var(--warning)'
              }}>
                {totalWeight.toFixed(1)}%
              </span>
            </div>
            <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                transition: 'all 0.3s',
                backgroundColor: totalWeight > 100 ? 'var(--error)' : totalWeight === 100 ? 'var(--success)' : 'var(--warning)',
                width: `${Math.min(totalWeight, 100)}%`
              }} />
            </div>
          </div>

          {localColumns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: '#f9fafb', borderRadius: '12px', border: '2px dashed #d1d5db' }}>
              <p style={{ color: '#6b7280', marginBottom: '8px' }}>No hay columnas configuradas</p>
              <p style={{ color: '#9ca3af', fontSize: '13px' }}>Haz clic en "Agregar Columna" para comenzar</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {localColumns.map((col, idx) => (
                <div key={idx} style={{
                  backgroundColor: col.is_special ? '#fef3c7' : '#ffffff',
                  border: `1px solid ${col.is_special ? '#fcd34b' : '#e5e7eb'}`,
                  borderRadius: '12px',
                  padding: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '9999px',
                      backgroundColor: col.is_special ? 'var(--warning)' : 'var(--brand)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: '14px'
                    }}>
                      {idx + 1}
                    </div>
                    <h3 style={{ fontWeight: 600, color: '#111111' }}>
                      {col.name || `Columna ${idx + 1}`}
                      {col.is_special && <span style={{ marginLeft: '8px', fontSize: '11px', backgroundColor: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '9999px' }}>Especial</span>}
                      {col.type === 'text' && <span style={{ marginLeft: '8px', fontSize: '11px', backgroundColor: '#e5e7eb', color: '#4b5563', padding: '2px 6px', borderRadius: '9999px' }}>Texto</span>}
                      {col.required && <span style={{ marginLeft: '8px', fontSize: '11px', backgroundColor: 'var(--error-bg)', color: 'var(--error)', padding: '2px 6px', borderRadius: '9999px' }}>Obligatoria</span>}
                    </h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '8px' }}>
                    <div style={{ gridColumn: 'span 4' }}>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Nombre</label>
                      <input
                        type="text"
                        value={col.name}
                        onChange={e => updateColumn(idx, 'name', e.target.value)}
                        disabled={col.is_special}
                        style={{
                          width: '100%',
                          border: `1px solid ${col.is_special ? '#fcd34b' : '#e5e7eb'}`,
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '13px',
                          backgroundColor: col.is_special ? '#fef3c7' : '#ffffff'
                        }}
                        placeholder={col.is_special ? 'Nombre fijo' : 'Ej: Tarea 1'}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Tipo</label>
                      <select
                        value={col.type}
                        onChange={e => updateColumn(idx, 'type', e.target.value)}
                        disabled={col.is_special}
                        style={{
                          width: '100%',
                          border: `1px solid ${col.is_special ? '#fcd34b' : '#e5e7eb'}`,
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '13px',
                          backgroundColor: col.is_special ? '#fef3c7' : '#ffffff'
                        }}
                      >
                        <option value="numeric">NumÃ©rico</option>
                        <option value="text">Texto</option>
                      </select>
                    </div>
                    {col.type === 'numeric' ? (
                      <>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Valor Max</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={col.maxValue}
                            onChange={e => updateColumn(idx, 'maxValue', e.target.value)}
                            disabled={col.is_special}
                            style={{
                              width: '100%',
                              border: `1px solid ${col.is_special ? '#fcd34b' : '#e5e7eb'}`,
                              borderRadius: '8px',
                              padding: '8px 12px',
                              fontSize: '13px',
                              backgroundColor: col.is_special ? '#fef3c7' : '#ffffff'
                            }}
                          />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Peso (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={col.weight}
                            onChange={e => updateColumn(idx, 'weight', e.target.value)}
                            style={{
                              width: '100%',
                              border: `1px solid ${col.is_special ? '#fcd34b' : '#e5e7eb'}`,
                              borderRadius: '8px',
                              padding: '8px 12px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <div style={{ gridColumn: 'span 4' }}>
                        <label style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Sin PonderaciÃ³n</label>
                        <div style={{ backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                          Campo de texto
                        </div>
                      </div>
                    )}
                    <div style={{ gridColumn: 'span 1', display: 'flex', alignItems: 'flex-end' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={col.required}
                          onChange={e => updateColumn(idx, 'required', e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: '#880000' }}
                        />
                        <span style={{ fontSize: '11px', fontWeight: 500, color: '#4b5563' }}>Req.</span>
                      </label>
                    </div>
                    <div style={{ gridColumn: 'span 1', display: 'flex', alignItems: 'flex-end' }}>
                      <button
                        onClick={() => removeColumn(idx)}
                        disabled={col.is_special}
                        style={{
                          width: '100%',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          border: 'none',
                          cursor: col.is_special ? 'not-allowed' : 'pointer',
                          backgroundColor: col.is_special ? '#e5e7eb' : 'var(--error)',
                          color: col.is_special ? '#9ca3af' : '#ffffff',
                          fontSize: '12px'
                        }}
                      >
                        ðŸ—‘ï¸
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={addColumn}
            style={{
              marginTop: '1rem',
              width: '100%',
              border: '2px dashed var(--brand)',
              backgroundColor: 'var(--error-bg)',
              color: 'var(--brand)',
              padding: '12px',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            + Agregar Nueva Columna
          </button>

          <div style={{
            marginTop: '1.5rem',
            backgroundColor: '#fef2f2',
            borderLeft: '4px solid var(--brand)',
            borderRadius: '8px',
            padding: '1rem'
          }}>
            <p style={{ fontWeight: 700, color: 'var(--brand)', marginBottom: '8px' }}>ðŸ’¡ Consejos:</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px', color: '#7f1d1d' }}>
              {showSpecialColumn && <li>â€¢ <strong>Columnas especiales:</strong> Se calculan automÃ¡ticamente y solo puedes ajustar su peso.</li>}
              <li>â€¢ <strong>NumÃ©rico:</strong> Para calificaciones que suman a la nota final.</li>
              <li>â€¢ <strong>Texto:</strong> Solo comentarios (no afecta la nota).</li>
              <li>â€¢ <strong>Peso:</strong> La suma de los pesos de todas las columnas numÃ©ricas debe ser 100%.</li>
            </ul>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>{localColumns.length} columnas</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: totalWeight > 100 ? 'var(--error)' : totalWeight === 100 ? 'var(--success)' : 'var(--warning)' }}>
              Total: {totalWeight.toFixed(1)}% / 100%
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '8px 20px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                color: '#4b5563',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 24px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: 'var(--brand)',
                color: '#ffffff',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}
            >
              Guardar ConfiguraciÃ³n
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ColumnConfig;

```

```jsx
import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

function AttendanceTable({ semester, subject, group, teacherId }) {
  const [dates, setDates] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/attendance/records', {
        params: { teacherId, semester, subject, group }
      });
      setDates(response.data.dates || []);
      setRecords(response.data.records || []);
    } catch (error) {
      console.error(error);
      alert('Error cargando asistencias');
    } finally {
      setLoading(false);
    }
  }, [teacherId, semester, subject, group]);

  useEffect(() => {
    if (subject) loadAttendance();
  }, [subject, loadAttendance]);

  const handleAddDate = async (e) => {
    e.preventDefault();
    if (!newDate) return;
    try {
      await api.post('/attendance/dates', {
        teacherId, semester, subject, group, date: newDate
      });
      setNewDate('');
      loadAttendance();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al agregar fecha');
    }
  };

  const handleDeleteDate = async (id) => {
    if (!confirm('Â¿Seguro que deseas eliminar esta fecha y todas sus asistencias?')) return;
    try {
      await api.delete(`/attendance/dates/${id}`);
      loadAttendance();
    } catch (error) {
      alert('Error al eliminar fecha');
    }
  };

  const handleToggle = (matricula, dateId) => {
    setRecords(prev => prev.map(row => {
      if (row.matricula === matricula) {
        return { ...row, [`date_${dateId}`]: !row[`date_${dateId}`] };
      }
      return row;
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [];
      records.forEach(row => {
        dates.forEach(d => {
          updates.push({
            matricula: row.matricula,
            dateId: d.id,
            isPresent: row[`date_${d.id}`] ? true : false
          });
        });
      });
      await api.post('/attendance/records', { updates });
      alert('Asistencias guardadas correctamente');
      loadAttendance();
    } catch (error) {
      alert('Error al guardar asistencias');
    } finally {
      setSaving(false);
    }
  };

  const styles = {
    container: { fontFamily: 'DM Sans, sans-serif' },
    header: { marginBottom: '1.5rem', backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '12px', border: '0.5px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' },
    form: { display: 'flex', gap: '0.5rem', alignItems: 'center' },
    label: { fontSize: '13px', fontWeight: 500, color: '#374151' },
    input: { border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' },
    addBtn: { background: 'var(--brand)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' },
    saveBtn: { background: 'var(--brand)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 24px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' },
    table: { width: '100%', backgroundColor: '#ffffff', border: '0.5px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', fontSize: '13px' },
    th: { borderBottom: '0.5px solid #e5e7eb', padding: '12px 8px', textAlign: 'left', backgroundColor: '#f9fafb', fontWeight: 600, color: '#374151' },
    td: { borderBottom: '0.5px solid #e5e7eb', padding: '10px 8px' },
    stickyLeft: { position: 'sticky', left: 0, backgroundColor: '#ffffff', zIndex: 10 },
    emptyState: { textAlign: 'center', padding: '2rem', color: '#9ca3af' }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', fontFamily: 'DM Sans, sans-serif', color: '#6b7280' }}>Cargando asistencia...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <form onSubmit={handleAddDate} style={styles.form}>
          <label style={styles.label}>Nueva fecha de clase:</label>
          <input 
            type="date" 
            value={newDate} 
            onChange={e => setNewDate(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.addBtn}>
            AÃ±adir
          </button>
        </form>
        <button 
          onClick={handleSave} 
          disabled={saving || dates.length === 0}
          style={{ ...styles.saveBtn, opacity: (saving || dates.length === 0) ? 0.5 : 1 }}
        >
          {saving ? 'Guardando...' : 'Guardar Asistencias'}
        </button>
      </div>

      {dates.length === 0 ? (
        <div style={styles.emptyState}>
          No hay fechas registradas. AÃ±ade una fecha para comenzar a tomar asistencia.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.stickyLeft, left: 0, minWidth: '100px' }}>MatrÃ­cula</th>
                <th style={{ ...styles.th, ...styles.stickyLeft, left: '100px', minWidth: '200px' }}>Alumno</th>
                {dates.map(d => (
                  <th key={d.id} style={{ ...styles.th, textAlign: 'center', minWidth: '100px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <span>{d.class_date}</span>
                      <button 
                        onClick={() => handleDeleteDate(d.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '11px' }}
                        title="Eliminar fecha"
                      >
                        âœ•
                      </button>
                    </div>
                  </th>
                ))}
                <th style={{ ...styles.th, textAlign: 'center', backgroundColor: '#fef3c7', fontWeight: 700 }}>% Final</th>
              </tr>
            </thead>
            <tbody>
              {records.map((row, idx) => (
                <tr key={row.matricula} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ ...styles.td, ...styles.stickyLeft, left: 0, fontWeight: 500 }}>{row.matricula}</td>
                  <td style={{ ...styles.td, ...styles.stickyLeft, left: '100px' }}>{row.nombre}</td>
                  {dates.map(d => (
                    <td key={d.id} style={{ ...styles.td, textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={row[`date_${d.id}`] || false}
                        onChange={() => handleToggle(row.matricula, d.id)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--brand)' }}
                      />
                    </td>
                  ))}
                  <td style={{ ...styles.td, textAlign: 'center', fontWeight: 700, backgroundColor: '#fef3c7' }}>
                    {row.percentage}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AttendanceTable;
```

```jsx
import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../../api/axios';

registerAllModules();

function UsersManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '', firstName: '', lastName: '', email: '', password: '', role: 'maestro', phone: '', isActive: true
  });
  const hotRef = useRef(null);

  useEffect(() => { cargarUsuarios(); }, []);

  const cargarUsuarios = async () => {
    try {
      const response = await api.get('/admin/users');
      const data = response.data.users.map(u => [
        u.id, u.username, u.first_name, u.last_name, u.email,
        u.role === 'maestro' ? 'Maestro' : 'Director',
        u.is_active ? 'Activo' : 'Inactivo'
      ]);
      setUsers(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) await api.put(`/admin/users/${editingUser}`, formData);
      else await api.post('/admin/users', formData);
      alert(editingUser ? 'Usuario actualizado' : 'Usuario creado');
      setShowModal(false); resetForm(); cargarUsuarios();
    } catch (error) { alert(error.response?.data?.error || 'Error'); }
  };

  const handleEdit = (id) => {
    api.get('/admin/users').then(response => {
      const user = response.data.users.find(u => u.id === id);
      if (user) {
        setFormData({
          username: user.username, firstName: user.first_name, lastName: user.last_name,
          email: user.email, password: '', role: user.role, phone: user.phone || '', isActive: user.is_active
        });
        setEditingUser(id); setShowModal(true);
      }
    });
  };

  const handleDeactivate = async (id) => {
    if (!confirm('Â¿Desactivar este usuario/maestro? No podrÃ¡ iniciar sesiÃ³n, pero su cuenta se conserva.')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      alert('Usuario desactivado');
      cargarUsuarios();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al desactivar');
    }
  };

  const handlePermanentDelete = async (id) => {
    if (!confirm('Â¿BORRAR PERMANENTEMENTE este usuario?\n\nSe eliminarÃ¡n sus asignaciones, calificaciones y la cuenta. No se puede deshacer.')) return;
    if (!confirm('Confirme de nuevo: eliminar permanentemente el usuario ID ' + id)) return;
    try {
      await api.delete(`/admin/users/${id}?permanent=true`);
      alert('Usuario eliminado permanentemente');
      cargarUsuarios();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al borrar');
    }
  };

  const resetForm = () => {
    setFormData({ username: '', firstName: '', lastName: '', email: '', password: '', role: 'maestro', phone: '', isActive: true });
    setEditingUser(null);
  };

  const columns = [
    { data: 0, title: 'ID', readOnly: true, width: 60 },
    { data: 1, title: 'Usuario', readOnly: true, width: 120 },
    { data: 2, title: 'Nombre', readOnly: true, width: 150 },
    { data: 3, title: 'Apellido', readOnly: true, width: 150 },
    { data: 4, title: 'Email', readOnly: true, width: 200 },
    { data: 5, title: 'Rol', readOnly: true, width: 120 },
    { data: 6, title: 'Estado', readOnly: true, width: 100 }
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Cargando...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#111111' }}>GestiÃ³n de usuarios y maestros</h2>
        <button onClick={() => { resetForm(); setShowModal(true); }} style={{ background: 'var(--brand)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>+ Agregar Usuario</button>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem' }}>
        <HotTable ref={hotRef} data={users} columns={columns} colHeaders={true} rowHeaders={true} width="100%" height="500"
          licenseKey="non-commercial-and-evaluation" stretchH="all" filters={true} dropdownMenu={true} columnSorting={true}
          contextMenu={{
            items: {
              edit: { name: 'Editar', callback: (key, sel) => handleEdit(users[sel[0].start.row][0]) },
              deactivate: { name: 'Desactivar usuario', callback: (key, sel) => handleDeactivate(users[sel[0].start.row][0]) },
              permanent: { name: 'Borrar permanentemente', callback: (key, sel) => handlePermanentDelete(users[sel[0].start.row][0]) }
            }
          }}
        />
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>Clic derecho: editar, desactivar o borrar permanentemente (maestros y staff).</p>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.5rem', maxWidth: '700px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '1rem' }}>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Usuario *</label>
                  <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} disabled={editingUser}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Email *</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Nombre *</label>
                  <input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Apellido *</label>
                  <input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>ContraseÃ±a {!editingUser && '*'}</label>
                  <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required={!editingUser} /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Rol *</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
                    <option value="maestro">Maestro</option><option value="director">Director</option>
                  </select></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>TelÃ©fono</label>
                  <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Estado</label>
                  <select value={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.value === 'true'})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
                    <option value="true">Activo</option><option value="false">Inactivo</option>
                  </select></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} style={{ padding: '8px 20px', border: '0.5px solid #e5e7eb', borderRadius: '8px', background: '#ffffff', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 24px', border: 'none', borderRadius: '8px', background: 'var(--brand)', color: '#ffffff', cursor: 'pointer' }}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersManager;

```

```jsx
import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../../api/axios';

registerAllModules();

function StudentsManager() {
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [formData, setFormData] = useState({
    matricula: '', firstName: '', lastName: '', email: '', password: '',
    dateOfBirth: '', phone: '', address: '', status: 'active', groupId: ''
  });
  const hotRef = useRef(null);

  useEffect(() => { cargarEstudiantes(); }, []);

  const cargarEstudiantes = async () => {
    try {
      const [studentsRes, groupsRes] = await Promise.all([
        api.get('/admin/students'),
        api.get('/admin/student-groups')
      ]);
      setGroups((groupsRes.data.groups || []).filter(g => g.is_active));
      const data = studentsRes.data.students.map(s => [
        s.matricula, s.first_name, s.last_name, s.email,
        s.group_name || s.group_code || 'â€”',
        s.phone || '', s.status === 'active' ? 'Activo' : 'Inactivo'
      ]);
      setStudents(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = submitPayload();
      if (editingStudent) await api.put(`/admin/students/${editingStudent}`, payload);
      else await api.post('/admin/students', payload);
      setMessage({ text: editingStudent ? 'Estudiante actualizado' : 'Estudiante creado', type: 'success' });
      setShowModal(false); resetForm(); cargarEstudiantes();
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (error) { setMessage({ text: error.response?.data?.error || 'Error', type: 'error' }); }
  };

  const handleEdit = (matricula) => {
    api.get('/admin/students').then(response => {
      const student = response.data.students.find(s => s.matricula === matricula);
      if (student) {
        setFormData({
          matricula: student.matricula, firstName: student.first_name, lastName: student.last_name,
          email: student.email, password: '', dateOfBirth: student.date_of_birth || '',
          phone: student.phone || '', address: student.address || '', status: student.status,
          groupId: student.group_id || ''
        });
        setEditingStudent(matricula); setShowModal(true);
      }
    });
  };

  const handleDeactivate = async (matricula) => {
    if (!confirm('Â¿Desactivar este alumno? No podrÃ¡ iniciar sesiÃ³n, pero su registro y datos se conservan.')) return;
    try {
      await api.delete(`/admin/students/${matricula}`);
      setMessage({ text: 'Alumno desactivado', type: 'success' });
      cargarEstudiantes();
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (error) {
      setMessage({ text: error.response?.data?.error || 'Error al desactivar', type: 'error' });
    }
  };

  const handlePermanentDelete = async (matricula) => {
    if (!confirm('Â¿BORRAR PERMANENTEMENTE este alumno?\n\nSe eliminarÃ¡n calificaciones, asistencia y el registro. Esta acciÃ³n no se puede deshacer.')) return;
    if (!confirm('Confirme de nuevo: eliminar permanentemente al alumno ' + matricula)) return;
    try {
      await api.delete(`/admin/students/${matricula}?permanent=true`);
      setMessage({ text: 'Alumno eliminado permanentemente', type: 'success' });
      cargarEstudiantes();
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (error) {
      setMessage({ text: error.response?.data?.error || 'Error al borrar', type: 'error' });
    }
  };

  const resetForm = () => {
    setFormData({ matricula: '', firstName: '', lastName: '', email: '', password: '', dateOfBirth: '', phone: '', address: '', status: 'active', groupId: '' });
    setEditingStudent(null);
  };

  const submitPayload = () => ({
    ...formData,
    groupId: formData.groupId === '' ? null : formData.groupId
  });

  const columns = [
    { data: 0, title: 'MatrÃ­cula', readOnly: true, width: 100 },
    { data: 1, title: 'Nombre', readOnly: true, width: 150 },
    { data: 2, title: 'Apellido', readOnly: true, width: 150 },
    { data: 3, title: 'Email', readOnly: true, width: 180 },
    { data: 4, title: 'Grupo', readOnly: true, width: 100 },
    { data: 5, title: 'TelÃ©fono', readOnly: true, width: 110 },
    { data: 6, title: 'Estado', readOnly: true, width: 90 }
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Cargando...</div>;

  return (
    <div>
      {message.text && (
        <div style={{ padding: '12px', borderRadius: '8px', marginBottom: '1rem', background: message.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)', color: message.type === 'success' ? 'var(--success-text)' : 'var(--error-text)' }}>
          {message.text}
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#111111' }}>ðŸ‘¨â€ðŸŽ“ GestiÃ³n de Estudiantes</h2>
        <button onClick={() => { resetForm(); setShowModal(true); }} style={{ background: 'var(--brand)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>+ Agregar Estudiante</button>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem' }}>
        <HotTable ref={hotRef} data={students} columns={columns} colHeaders={true} rowHeaders={true} width="100%" height="500"
          licenseKey="non-commercial-and-evaluation" stretchH="all" filters={true} dropdownMenu={true} columnSorting={true}
          contextMenu={{
            items: {
              edit: { name: 'Editar', callback: (key, sel) => handleEdit(students[sel[0].start.row][0]) },
              deactivate: { name: 'Desactivar alumno', callback: (key, sel) => handleDeactivate(students[sel[0].start.row][0]) },
              permanent: { name: 'Borrar permanentemente', callback: (key, sel) => handlePermanentDelete(students[sel[0].start.row][0]) }
            }
          }}
        />
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>Clic derecho: editar, desactivar (conserva datos) o borrar permanentemente.</p>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.5rem', maxWidth: '700px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '1rem' }}>{editingStudent ? 'Editar Estudiante' : 'Nuevo Estudiante'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>MatrÃ­cula *</label>
                  <input type="text" value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value})} disabled={editingStudent}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Email *</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Nombre *</label>
                  <input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Apellido *</label>
                  <input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>ContraseÃ±a {!editingStudent && '*'}</label>
                  <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required={!editingStudent} /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Estado</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
                    <option value="active">Activo</option><option value="inactive">Inactivo</option>
                  </select></div>
                <div><label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Grupo</label>
                  <select value={formData.groupId} onChange={e => setFormData({...formData, groupId: e.target.value})}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
                    <option value="">Sin grupo</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.group_code} â€” {g.name}</option>
                    ))}
                  </select></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} style={{ padding: '8px 20px', border: '0.5px solid #e5e7eb', borderRadius: '8px', background: '#ffffff', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 24px', border: 'none', borderRadius: '8px', background: 'var(--brand)', color: '#ffffff', cursor: 'pointer' }}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentsManager;
```

```jsx
import { useState, useEffect } from 'react';
import api from '../../api/axios';

function Stats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cargarEstadisticas = async () => {
    try {
      const response = await api.get('/admin/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error cargando estadÃ­sticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value, decimals = 2) => {
    const num = Number(value);
    return isNaN(num) ? '0.00' : num.toFixed(decimals);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ marginBottom: '8px' }}>â³</div>
        Cargando estadÃ­sticas...
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--error)', fontFamily: 'DM Sans, sans-serif' }}>
        âŒ Error al cargar estadÃ­sticas
      </div>
    );
  }

  const cards = [
    { 
      title: 'Total Estudiantes', 
      value: Number(stats.totalEstudiantes) || 0, 
      icon: 'ðŸ‘¨â€ðŸŽ“',
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
    },
    { 
      title: 'Total Maestros', 
      value: Number(stats.totalMaestros) || 0, 
      icon: 'ðŸ‘¨â€ðŸ«',
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
    },
    { 
      title: 'Promedio General', 
      value: formatNumber(stats.promedioGeneral), 
      icon: 'ðŸ“Š',
      color: '#8b5cf6',
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
    },
    { 
      title: 'Total Materias', 
      value: Number(stats.totalMaterias) || 0, 
      icon: 'ðŸ“š',
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
    },
    { 
      title: 'Estudiantes Excelentes', 
      value: Number(stats.estudiantesExcelentes) || 0, 
      icon: 'â­',
      color: '#06b6d4',
      gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
      subtitle: 'CalificaciÃ³n â‰¥ 9'
    },
    { 
      title: 'Estudiantes con Materias Reprobadas', 
      value: Number(stats.estudiantesReprobados) || 0, 
      icon: 'âš ï¸',
      color: '#ef4444',
      gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      subtitle: 'Al menos una materia < 6'
    }
  ];

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#111111', marginBottom: '1.5rem' }}>
        ðŸ“ˆ EstadÃ­sticas Generales
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1rem'
      }}>
        {cards.map((card, idx) => (
          <div
            key={idx}
            style={{
              background: card.gradient,
              borderRadius: '16px',
              padding: '1.25rem',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              cursor: 'pointer'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <span style={{ fontSize: '36px' }}>{card.icon}</span>
              {card.subtitle && (
                <span style={{
                  fontSize: '10px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  fontWeight: 500
                }}>
                  {card.subtitle}
                </span>
              )}
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, marginBottom: '4px' }}>
              {card.value}
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              {card.title}
            </div>
          </div>
        ))}
      </div>

      {/* InformaciÃ³n adicional */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        background: '#f9fafb',
        borderRadius: '12px',
        border: '0.5px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#6b7280' }}>
          <span>ðŸ“… Ãšltima actualizaciÃ³n: {new Date().toLocaleDateString()}</span>
          <span>ðŸ”„ Los datos se actualizan automÃ¡ticamente</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'var(--brand)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '6px 16px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.target.style.background = 'var(--brand-hover)'}
          onMouseLeave={e => e.target.style.background = 'var(--brand)'}
        >
          ðŸ”„ Actualizar
        </button>
      </div>
    </div>
  );
}

export default Stats;
```

```jsx
import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../../api/axios';

registerAllModules();

function MateriasManager() {
  const [materias, setMaterias] = useState([]);
  const [profesores, setProfesores] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAsignarModal, setShowAsignarModal] = useState(false);
  const [nuevaMateria, setNuevaMateria] = useState({ subject_code: '', subject_name: '', credits: 5, description: '' });
  const [asignacion, setAsignacion] = useState({ subject_code: '', teacher_id: '', semester_code: '2025-1', group_code: '' });
  const hotMateriasRef = useRef(null);
  const hotAsignacionesRef = useRef(null);
  const materiasRawRef = useRef([]);
  const asignacionesRawRef = useRef([]);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [materiasRes, profesoresRes, gruposRes, asignacionesRes] = await Promise.all([
        api.get('/admin/materias'), api.get('/admin/profesores'), api.get('/admin/grupos'), api.get('/admin/asignaciones')
      ]);
      materiasRawRef.current = materiasRes.data.materias || [];
      asignacionesRawRef.current = asignacionesRes.data.asignaciones || [];
      setMaterias(materiasRawRef.current);
      setProfesores(profesoresRes.data.profesores);
      setGrupos(gruposRes.data.grupos);
      setAsignaciones(asignacionesRawRef.current);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleCrearMateria = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/materias', nuevaMateria);
      alert('Materia creada exitosamente');
      setShowModal(false);
      setNuevaMateria({ subject_code: '', subject_name: '', credits: 5, description: '' });
      cargarDatos();
    } catch (error) { alert(error.response?.data?.error || 'Error'); }
  };

  const handleAsignarMateria = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/asignar-materia', asignacion);
      alert('Materia asignada exitosamente');
      setShowAsignarModal(false);
      setAsignacion({ subject_code: '', teacher_id: '', semester_code: '2025-1', group_code: '' });
      cargarDatos();
    } catch (error) { alert(error.response?.data?.error || 'Error'); }
  };

  const handleDeleteMateria = async (id) => {
    const m = materiasRawRef.current.find(x => x.id === id);
    if (!m) return;
    const msg = (m.total_estudiantes || 0) > 0
      ? `Â¿Eliminar la materia "${m.subject_code}"? Se borrarÃ¡n tambiÃ©n todas las asignaciones y calificaciones asociadas.`
      : `Â¿Eliminar la materia "${m.subject_code}" del catÃ¡logo?`;
    if (!confirm(msg)) return;
    try {
      await api.delete(`/admin/materias/${id}`);
      alert('Materia eliminada');
      cargarDatos();
    } catch (error) { alert(error.response?.data?.error || 'Error al eliminar'); }
  };

  const handleDeleteAsignacion = async (index) => {
    const a = asignacionesRawRef.current[index];
    if (!a) return;
    const grupoLabel = a.group_code || 'sin grupo';
    if (!confirm(`Â¿Eliminar la asignaciÃ³n de ${a.subject_code} (${a.semester_code}, grupo ${grupoLabel}) con ${a.teacher_name}? Se borrarÃ¡n inscripciones y calificaciones de esa clase.`)) return;
    try {
      const params = new URLSearchParams({
        subject_code: a.subject_code,
        teacher_id: String(a.teacher_id),
        semester_code: a.semester_code
      });
      if (a.group_code) params.set('group_code', a.group_code);
      await api.delete(`/admin/asignaciones?${params.toString()}`);
      alert('AsignaciÃ³n eliminada');
      cargarDatos();
    } catch (error) { alert(error.response?.data?.error || 'Error al eliminar'); }
  };

  const materiasData = materias.map(m => [m.id, m.subject_code, m.subject_name, m.credits || 5, m.total_estudiantes || 0, m.total_maestros || 0]);
  const asignacionesData = asignaciones.map((a, i) => [i, a.subject_code, a.subject_name || a.subject_code, a.teacher_name || 'Sin asignar', a.semester_code, a.group_code || 'â€”', a.total_estudiantes || 0]);

  const materiasColumns = [
    { data: 0, title: 'ID', readOnly: true, width: 50 },
    { data: 1, title: 'CÃ³digo', readOnly: true, width: 110 },
    { data: 2, title: 'Nombre', readOnly: true, width: 180 },
    { data: 3, title: 'CrÃ©ditos', readOnly: true, width: 80 },
    { data: 4, title: 'Estudiantes', readOnly: true, width: 90 },
    { data: 5, title: 'Maestros', readOnly: true, width: 90 }
  ];

  const asignacionesColumns = [
    { data: 1, title: 'CÃ³digo', readOnly: true, width: 100 },
    { data: 2, title: 'Materia', readOnly: true, width: 140 },
    { data: 3, title: 'Profesor', readOnly: true, width: 160 },
    { data: 4, title: 'Semestre', readOnly: true, width: 90 },
    { data: 5, title: 'Grupo', readOnly: true, width: 80 },
    { data: 6, title: 'Estudiantes', readOnly: true, width: 90 }
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Cargando...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#111111' }}>ðŸ“š GestiÃ³n de Materias</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setShowModal(true)} style={{ background: 'var(--brand)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>+ Nueva Materia</button>
          <button onClick={() => setShowAsignarModal(true)} style={{ background: 'var(--brand)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>ðŸ“Œ Asignar</button>
        </div>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '1rem' }}>ðŸ“– CatÃ¡logo de Materias</h3>
        <HotTable ref={hotMateriasRef} data={materiasData} columns={materiasColumns} colHeaders={true} rowHeaders={true} width="100%" height="300"
          licenseKey="non-commercial-and-evaluation" stretchH="all" filters={true} dropdownMenu={true} columnSorting={true}
          contextMenu={{
            items: {
              delete: {
                name: 'Eliminar materia',
                callback: (key, sel) => handleDeleteMateria(materiasData[sel[0].start.row][0])
              }
            }
          }}
        />
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '1rem' }}>ðŸ“Œ Asignaciones Actuales</h3>
        <HotTable ref={hotAsignacionesRef} data={asignacionesData} columns={asignacionesColumns} colHeaders={true} rowHeaders={true} width="100%" height="300"
          licenseKey="non-commercial-and-evaluation" stretchH="all" filters={true} dropdownMenu={true} columnSorting={true}
          contextMenu={{
            items: {
              delete: {
                name: 'Eliminar asignaciÃ³n',
                callback: (key, sel) => handleDeleteAsignacion(asignacionesData[sel[0].start.row][0])
              }
            }
          }}
        />
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>Clic derecho en una fila para eliminar materia o asignaciÃ³n.</p>
      </div>

      {/* Modal Nueva Materia */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.5rem', maxWidth: '500px', width: '90%' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '1rem' }}>ðŸ“– Nueva Materia</h3>
            <form onSubmit={handleCrearMateria}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>CÃ³digo *</label>
                <input type="text" value={nuevaMateria.subject_code} onChange={e => setNuevaMateria({...nuevaMateria, subject_code: e.target.value.toUpperCase()})}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Nombre *</label>
                <input type="text" value={nuevaMateria.subject_name} onChange={e => setNuevaMateria({...nuevaMateria, subject_name: e.target.value})}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>CrÃ©ditos</label>
                <input type="number" value={nuevaMateria.credits} onChange={e => setNuevaMateria({...nuevaMateria, credits: parseInt(e.target.value)})}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} min="1" max="10" />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>DescripciÃ³n</label>
                <textarea value={nuevaMateria.description} onChange={e => setNuevaMateria({...nuevaMateria, description: e.target.value})}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} rows="3" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 20px', border: '0.5px solid #e5e7eb', borderRadius: '8px', background: '#ffffff', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 24px', border: 'none', borderRadius: '8px', background: 'var(--brand)', color: '#ffffff', cursor: 'pointer' }}>Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Asignar Materia */}
      {showAsignarModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.5rem', maxWidth: '500px', width: '90%' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '1rem' }}>ðŸ“Œ Asignar Materia</h3>
            <form onSubmit={handleAsignarMateria}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Materia *</label>
                <select value={asignacion.subject_code} onChange={e => setAsignacion({...asignacion, subject_code: e.target.value})}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required>
                  <option value="">Seleccionar</option>
                  {materias.map(m => <option key={m.subject_code} value={m.subject_code}>{m.subject_code} - {m.subject_name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Profesor *</label>
                <select value={asignacion.teacher_id} onChange={e => setAsignacion({...asignacion, teacher_id: e.target.value})}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }} required>
                  <option value="">Seleccionar</option>
                  {profesores.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Semestre *</label>
                <select value={asignacion.semester_code} onChange={e => setAsignacion({...asignacion, semester_code: e.target.value})}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
                  <option value="2025-1">2025-1</option><option value="2024-2">2024-2</option><option value="2024-1">2024-1</option>
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Grupo</label>
                <select value={asignacion.group_code} onChange={e => setAsignacion({...asignacion, group_code: e.target.value})}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
                  <option value="">Sin grupo</option>
                  {grupos.map(g => <option key={g} value={g}>Grupo {g}</option>)}
                </select>
              </div>
              <div style={{ background: 'var(--warning-bg)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', color: 'var(--warning-text)', marginBottom: '1rem' }}>
                Solo se inscribirÃ¡n los alumnos del grupo seleccionado. Si deja &quot;Sin grupo&quot;, solo alumnos sin grupo asignado.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setShowAsignarModal(false)} style={{ padding: '8px 20px', border: '0.5px solid #e5e7eb', borderRadius: '8px', background: '#ffffff', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 24px', border: 'none', borderRadius: '8px', background: 'var(--brand)', color: '#ffffff', cursor: 'pointer' }}>Asignar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MateriasManager;
```

```jsx
import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../../api/axios';

registerAllModules();

function GroupsManager() {
  const [groups, setGroups] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [managingGroup, setManagingGroup] = useState(null);
  const [selectedMatriculas, setSelectedMatriculas] = useState([]);
  const [formData, setFormData] = useState({ groupCode: '', name: '', description: '', isActive: true });
  const hotRef = useRef(null);
  const groupsRawRef = useRef([]);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [groupsRes, studentsRes] = await Promise.all([
        api.get('/admin/student-groups'),
        api.get('/admin/students')
      ]);
      groupsRawRef.current = groupsRes.data.groups || [];
      const data = groupsRawRef.current.map(g => [
        g.id,
        g.group_code,
        g.name,
        g.member_count || 0,
        g.is_active ? 'Activo' : 'Inactivo'
      ]);
      setGroups(data);
      setAllStudents((studentsRes.data.students || []).filter(s => s.status === 'active'));
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || 'Error al cargar grupos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingGroup) {
        await api.put(`/admin/student-groups/${editingGroup}`, {
          name: formData.name,
          description: formData.description,
          isActive: formData.isActive
        });
      } else {
        await api.post('/admin/student-groups', {
          groupCode: formData.groupCode,
          name: formData.name,
          description: formData.description
        });
      }
      setShowModal(false);
      resetForm();
      cargarDatos();
    } catch (error) {
      alert(error.response?.data?.error || 'Error');
    }
  };

  const handleEdit = (id) => {
    const group = groupsRawRef.current.find(g => g.id === id);
    if (group) {
      setFormData({
        groupCode: group.group_code,
        name: group.name,
        description: group.description || '',
        isActive: !!group.is_active
      });
      setEditingGroup(id);
      setShowModal(true);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Â¿Desactivar este grupo? Los alumnos quedarÃ¡n sin grupo asignado.')) return;
    try {
      await api.delete(`/admin/student-groups/${id}`);
      cargarDatos();
    } catch (error) {
      alert(error.response?.data?.error || 'Error');
    }
  };

  const openMembers = (id) => {
    const group = groupsRawRef.current.find(g => g.id === id);
    if (!group) return;
    const members = allStudents.filter(s => s.group_id === id).map(s => s.matricula);
    setManagingGroup(group);
    setSelectedMatriculas(members);
    setShowMembersModal(true);
  };

  const toggleMatricula = (matricula) => {
    setSelectedMatriculas(prev =>
      prev.includes(matricula) ? prev.filter(m => m !== matricula) : [...prev, matricula]
    );
  };

  const saveMembers = async () => {
    try {
      await api.put(`/admin/student-groups/${managingGroup.id}/members`, {
        matriculas: selectedMatriculas
      });
      alert('Alumnos actualizados');
      setShowMembersModal(false);
      setManagingGroup(null);
      cargarDatos();
    } catch (error) {
      alert(error.response?.data?.error || 'Error');
    }
  };

  const resetForm = () => {
    setFormData({ groupCode: '', name: '', description: '', isActive: true });
    setEditingGroup(null);
  };

  const columns = [
    { data: 0, title: 'ID', readOnly: true, width: 50 },
    { data: 1, title: 'CÃ³digo', readOnly: true, width: 100 },
    { data: 2, title: 'Nombre', readOnly: true, width: 200 },
    { data: 3, title: 'Alumnos', readOnly: true, width: 90 },
    { data: 4, title: 'Estado', readOnly: true, width: 90 }
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Cargando...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#111111' }}>Grupos de estudiantes</h2>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          style={{ background: 'var(--brand)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
        >
          + Nuevo grupo
        </button>
      </div>

      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '1rem' }}>
        Cada alumno puede pertenecer a un solo grupo. Al asignar materias, solo se inscriben los alumnos del grupo seleccionado.
        Cambiar el grupo de un alumno no actualiza inscripciones ya existentes.
      </p>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem' }}>
        <HotTable
          ref={hotRef}
          data={groups}
          columns={columns}
          colHeaders={true}
          rowHeaders={true}
          width="100%"
          height="400"
          licenseKey="non-commercial-and-evaluation"
          stretchH="all"
          filters={true}
          dropdownMenu={true}
          columnSorting={true}
          contextMenu={{
            items: {
              edit: { name: 'Editar', callback: (key, sel) => handleEdit(groups[sel[0].start.row][0]) },
              members: { name: 'Gestionar alumnos', callback: (key, sel) => openMembers(groups[sel[0].start.row][0]) },
              delete: { name: 'Desactivar', callback: (key, sel) => handleDelete(groups[sel[0].start.row][0]) }
            }
          }}
        />
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.5rem', maxWidth: '480px', width: '90%' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '1rem' }}>{editingGroup ? 'Editar grupo' : 'Nuevo grupo'}</h3>
            <form onSubmit={handleSubmit}>
              {!editingGroup && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>CÃ³digo *</label>
                  <input
                    type="text"
                    value={formData.groupCode}
                    onChange={e => setFormData({ ...formData, groupCode: e.target.value.toUpperCase() })}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}
                    required
                    maxLength={20}
                  />
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Nombre *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>DescripciÃ³n</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}
                  rows="2"
                />
              </div>
              {editingGroup && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Estado</label>
                  <select
                    value={formData.isActive ? 'active' : 'inactive'}
                    onChange={e => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1rem' }}>
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} style={{ padding: '8px 20px', border: '0.5px solid #e5e7eb', borderRadius: '8px', background: '#ffffff', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 24px', border: 'none', borderRadius: '8px', background: 'var(--brand)', color: '#ffffff', cursor: 'pointer' }}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMembersModal && managingGroup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '1.5rem', maxWidth: '560px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '0.5rem' }}>
              Alumnos â€” {managingGroup.group_code} ({managingGroup.name})
            </h3>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '1rem' }}>
              Marque los alumnos que pertenecen a este grupo.
            </p>
            <div style={{ flex: 1, overflowY: 'auto', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px' }}>
              {allStudents.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '13px' }}>No hay alumnos activos</p>
              ) : (
                allStudents.map(s => (
                  <label key={s.matricula} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedMatriculas.includes(s.matricula)}
                      onChange={() => toggleMatricula(s.matricula)}
                    />
                    <span>{s.matricula} â€” {s.first_name} {s.last_name}</span>
                    {s.group_id && s.group_id !== managingGroup.id && (
                      <span style={{ fontSize: '11px', color: '#b45309' }}>(en otro grupo)</span>
                    )}
                  </label>
                ))
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1rem' }}>
              <button type="button" onClick={() => { setShowMembersModal(false); setManagingGroup(null); }} style={{ padding: '8px 20px', border: '0.5px solid #e5e7eb', borderRadius: '8px', background: '#ffffff', cursor: 'pointer' }}>Cancelar</button>
              <button type="button" onClick={saveMembers} style={{ padding: '8px 24px', border: 'none', borderRadius: '8px', background: 'var(--brand)', color: '#ffffff', cursor: 'pointer' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupsManager;

```

```jsx
import { useState, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import api from '../../api/axios';
import { gradeStyle, colors } from '../../theme';

registerAllModules();

function GradesViewer() {
  const [grades, setGrades] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subjectsList, setSubjectsList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [teachersList, setTeachersList] = useState([]);
  const [semestersList, setSemestersList] = useState([]);
  const [partialId, setPartialId] = useState(1);
  const [filters, setFilters] = useState({ semester: '', subject: '', group: '', teacherId: '' });
  const hotRef = useRef(null);

  useEffect(() => {
    cargarMaterias();
    cargarMaestros();
    cargarSemestres();
  }, []);

  useEffect(() => {
    if (filters.subject && filters.semester && filters.teacherId) {
      cargarCalificaciones();
    }
  }, [filters, partialId]);

  const cargarMaterias = async () => {
    try {
      const response = await api.get('/admin/subjects');
      setSubjectsList(response.data.subjects || []);
    } catch (error) { console.error(error); }
  };

  const cargarMaestros = async () => {
    try {
      const response = await api.get('/admin/teachers');
      setTeachersList(response.data.teachers || []);
    } catch (error) { console.error(error); }
  };

  const cargarSemestres = async () => {
    try {
      const response = await api.get('/admin/semesters');
      setSemestersList(response.data.semesters || []);
      if (response.data.semesters?.length > 0) {
        setFilters(prev => ({ ...prev, semester: response.data.semesters[0] }));
      }
    } catch (error) { console.error(error); }
  };

  const cargarGrupos = async (subjectCode, teacherId) => {
    if (!subjectCode) { setGroupsList([]); return; }
    try {
      const params = { subjectCode };
      if (filters.semester) params.semester = filters.semester;
      if (teacherId) params.teacherId = teacherId;
      const response = await api.get('/admin/subject-groups', { params });
      setGroupsList(response.data.groups || []);
    } catch (error) { console.error(error); }
  };

  const cargarCalificaciones = async () => {
    setLoading(true);
    try {
      const params = { teacherId: filters.teacherId, semester: filters.semester, subject: filters.subject, partialId };
      if (filters.group && filters.group !== '') params.group = filters.group;
      const response = await api.get('/partials/grades', { params });
      const rawGrades = response.data.grades || [];
      const columnsData = response.data.columns || [];
      const tableData = rawGrades.map(g => {
        const row = [g.matricula, g.nombre];
        columnsData.forEach(col => {
          const val = g[`col_${col.column_name}`];
          row.push(val !== null ? parseFloat(val).toFixed(2) : '');
        });
        return row;
      });
      setGrades(tableData);
      setColumns(columnsData);
    } catch (error) {
      console.error(error);
      alert('Error al cargar calificaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectChange = async (e) => {
    const subjectCode = e.target.value;
    const selectedSubject = subjectsList.find(s => s.subject_code === subjectCode);
    const teacherId = selectedSubject ? selectedSubject.teacher_id : '';
    setFilters(prev => ({ ...prev, subject: subjectCode, group: '', teacherId }));
    if (subjectCode && teacherId) await cargarGrupos(subjectCode, teacherId);
    else setGroupsList([]);
  };

  const resetFilters = () => {
    setFilters({ semester: semestersList[0] || '', subject: '', group: '', teacherId: '' });
    setGroupsList([]);
    setPartialId(1);
  };

  const buildColumns = () => {
    const base = [
      { data: 0, title: 'MatrÃ­cula', readOnly: true, width: 100 },
      { data: 1, title: 'Alumno', readOnly: true, width: 200 }
    ];
    columns.forEach((col, idx) => {
      base.push({
        data: 2 + idx,
        title: `${col.column_name}${col.is_special ? ' â­' : ''}`,
        readOnly: true,
        type: 'numeric',
        numericFormat: { pattern: '0.00' },
        width: 140
      });
    });
    return base;
  };

  const finalColIndex = 2 + columns.length - 1;

  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#111111', marginBottom: '1rem' }}>ðŸ“Š Calificaciones</h2>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Semestre</label>
            <select value={filters.semester} onChange={e => setFilters({ ...filters, semester: e.target.value, subject: '', group: '', teacherId: '' })}
              style={{ width: '100%', background: '#fafafa', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
              <option value="">Todos</option>
              {semestersList.map(sem => <option key={sem} value={sem}>{sem}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Materia</label>
            <select value={filters.subject} onChange={handleSubjectChange}
              style={{ width: '100%', background: '#fafafa', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
              <option value="">Seleccionar</option>
              {subjectsList.map(subj => <option key={`${subj.subject_code}-${subj.teacher_id}`} value={subj.subject_code}>{subj.subject_code}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Grupo</label>
            <select value={filters.group} onChange={e => setFilters({ ...filters, group: e.target.value })} disabled={!filters.subject}
              style={{ width: '100%', background: '#fafafa', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
              <option value="">Todos</option>
              {groupsList.map(g => <option key={g.group_code} value={g.group_code}>Grupo {g.group_code}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Tipo</label>
            <select value={partialId} onChange={e => setPartialId(parseInt(e.target.value))}
              style={{ width: '100%', background: '#fafafa', border: '0.5px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
              <option value={1}>Parcial 1</option>
              <option value={2}>Parcial 2</option>
              <option value={3}>Parcial 3</option>
              <option value={4}>Examen Final</option>
              <option value={5}>CalificaciÃ³n Final</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <button onClick={() => cargarCalificaciones()}
              style={{ background: '#880000', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              ðŸ”„ Actualizar
            </button>
            <button onClick={resetFilters}
              style={{ background: '#6b7280', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              Limpiar
            </button>
          </div>
        </div>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '0.5px solid #e5e7eb', padding: '1rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Cargando calificaciones...</div>
        ) : !filters.subject ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Selecciona una materia</div>
        ) : grades.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>No hay calificaciones</div>
        ) : (
          <HotTable
            ref={hotRef}
            data={grades}
            columns={buildColumns()}
            colHeaders={true}
            rowHeaders={true}
            width="100%"
            height="500"
            licenseKey="non-commercial-and-evaluation"
            stretchH="all"
            filters={true}
            dropdownMenu={true}
            columnSorting={true}
            cells={(row, col) => {
              const cellProperties = {};
              if (col === finalColIndex) {
                cellProperties.renderer = function(instance, td, row, col, prop, value) {
                  td.textContent = value !== null && value !== '' ? parseFloat(value).toFixed(2) : 'N/A';
                  td.style.fontWeight = 'bold';
                  td.style.textAlign = 'center';
                  const style = gradeStyle(value);
                  if (value !== null && value !== '' && !isNaN(parseFloat(value))) {
                    td.style.backgroundColor = style.solid;
                    td.style.color = 'white';
                  } else {
                    td.style.backgroundColor = style.bg;
                    td.style.color = style.text;
                  }
                  return td;
                };
              }
              return cellProperties;
            }}
          />
        )}
      </div>
    </div>
  );
}

export default GradesViewer;
```

