# 📊 CALSYS - Sistema de Calificaciones

## STACK TECNOLÓGICO
- **Frontend:** React + Vite + Tailwind CSS + Handsontable
- **Backend:** Node.js + Express + MySQL
- **Autenticación:** JWT + Bcrypt
- **Base de Datos:** MySQL 8.0

## ESTRUCTURA DEL PROYECTO
```
CalSys/
├── backend/
│   ├── src/
│   │   ├── config/database.js          # Conexión MySQL
│   │   ├── routes/
│   │   │   ├── auth.routes.js          # Login (staff + alumnos)
│   │   │   ├── grades.routes.js        # Calificaciones
│   │   │   ├── columns.routes.js       # Columnas personalizables
│   │   │   └── admin.routes.js         # CRUD admin/director
│   │   └── server.js                   # Servidor principal
│   ├── .env                             # Configuración (no subir a Git)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/axios.js                # Cliente API
│   │   ├── context/AuthContext.jsx     # Manejo de autenticación
│   │   ├── components/
│   │   │   ├── GradesTable.jsx         # Tabla Handsontable para maestros
│   │   │   ├── ColumnConfig.jsx        # Configurador de columnas
│   │   │   └── admin/                  # Componentes de admin (EN DESARROLLO)
│   │   ├── pages/
│   │   │   ├── Login.jsx               # Página de login
│   │   │   ├── MaestroDashboard.jsx    # Panel de maestros ✅
│   │   │   ├── AlumnoDashboard.jsx     # Panel de alumnos ✅
│   │   │   ├── AdminDashboard.jsx      # Panel admin/director (EN DESARROLLO)
│   │   │   └── DirectorDashboard.jsx   # Alias de AdminDashboard
│   │   ├── App.jsx                     # Rutas principales
│   │   └── index.css                   # Estilos Tailwind
│   ├── .env                             # Variables de entorno
│   └── package.json
└── DESARROLLO.md                        # Este archivo
```

## BASE DE DATOS

### Tablas principales:
1. **students** - Información de alumnos
2. **users** - Staff (admin, director, maestro)
3. **final_grades** - Registro de calificaciones
4. **grade_columns_config** - Columnas personalizadas por maestro
5. **grade_custom_values** - Valores capturados
6. **grade_history** - Auditoría de cambios

### Triggers automáticos:
- `calculate_final_grade_after_insert` - Calcula final_grade al insertar
- `calculate_final_grade_after_update` - Recalcula al actualizar
- `calculate_final_grade_after_delete` - Recalcula al eliminar

**IMPORTANTE:** Los triggers calculan automáticamente `final_grade` basándose en:
```
final_grade = SUM((valor / max_value) * 10 * (peso / 100))
```

## FUNCIONALIDADES COMPLETADAS ✅

### Sistema de Login
- Login para staff (username/password)
- Login para alumnos (matrícula/password)
- Recuperación de sesión con JWT
- Rutas protegidas por rol

### Panel de Maestros ✅
- Selector de semestre/materia/grupo
- Configurador de columnas personalizadas (numérico/texto)
- Tabla editable tipo Excel con Handsontable
- Cálculo automático de calificación final
- Validación de pesos (máximo 100%)
- Guardado masivo con actualización en tiempo real

### Panel de Alumnos ✅
- Vista de todas las calificaciones en tabla Handsontable
- Filtros y ordenamiento
- Calificación final por materia
- Colores por rango (verde ≥9, azul 6-8.9, rojo <6)
- Estadísticas: promedio general, aprobadas/reprobadas

## EN DESARROLLO 🚧

### Panel de Admin/Director (PRIORIDAD ACTUAL)
**Backend completado:**
- ✅ CRUD de estudiantes (GET, POST, PUT, DELETE)
- ✅ CRUD de usuarios/staff (GET, POST, PUT, DELETE)
- ✅ Estadísticas generales (totales, promedios)
- ✅ Vista de todas las calificaciones con filtros

**Frontend pendiente:**
- [ ] Componente Stats.jsx (estadísticas generales)
- [ ] Componente StudentsManager.jsx (CRUD alumnos)
- [ ] Componente UsersManager.jsx (CRUD usuarios)
- [ ] Componente GradesViewer.jsx (todas las calificaciones)

**Ubicación:** `frontend/src/components/admin/`

## CREDENCIALES DE PRUEBA

### Staff:
- Admin: `admin` / `password123`
- Director: `director` / `password123`
- Maestro: `prof.martinez` / `password123`
- Maestro: `prof.lopez` / `password123`

### Alumnos:
- `2025001` a `2025010` / `password123`
- Hash: `$2b$10$d01Y5Xu3pZJ3KwgytFpzsuqmoEobp5oujCVNYb9YsSbNNVA5m88ci`

## COMANDOS PRINCIPALES

### Iniciar proyecto:
```bash
# Terminal 1 - Backend
cd backend
npm install
node src/server.js

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

### Acceso:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

### Git:
```bash
# Antes de trabajar
git pull origin main

# Después de trabajar
git add .
git commit -m "descripción"
git push origin main
```

## CONVENCIONES DE CÓDIGO

### Backend:
- Usar async/await
- Siempre usar transactions para múltiples queries
- Manejar errores con try/catch
- Logs con console.log para debug

### Frontend:
- Hooks de React (useState, useEffect, useContext)
- Tailwind CSS para estilos
- No usar localStorage (usar AuthContext)
- Validaciones antes de enviar al backend

### Nombres:
- Archivos: camelCase.jsx / kebab-case.js
- Componentes: PascalCase
- Variables: camelCase
- Constantes: UPPER_SNAKE_CASE

## PROBLEMAS RESUELTOS

### 1. Calificación final incorrecta
**Solución:** Triggers de MySQL calculan automáticamente
**Archivo:** Script SQL con triggers

### 2. Login de alumnos en bucle
**Solución:** AuthContext maneja matricula correctamente
**Archivo:** `frontend/src/context/AuthContext.jsx`

### 3. Columna `status` no existe en `users`
**Solución:** Se llama `is_active` (booleano)
**Archivo:** `backend/src/routes/auth.routes.js`

### 4. NaN en inputs numéricos
**Solución:** Validación con `|| 0` en ColumnConfig
**Archivo:** `frontend/src/components/ColumnConfig.jsx`

## PRÓXIMOS PASOS

1. **PRIORIDAD 1:** Completar panel de admin/director
   - Crear 4 componentes en `frontend/src/components/admin/`
   - Integrar con AdminDashboard.jsx

2. **PRIORIDAD 2:** Reportes y exportación
   - Generar PDFs de calificaciones
   - Exportar a Excel

3. **PRIORIDAD 3:** Mejoras
   - Sistema de notificaciones
   - Historial de cambios visible
   - Recuperación de contraseña

## NOTAS IMPORTANTES

- **NO subir .env a Git** (ya está en .gitignore)
- **NO subir node_modules/** (se regenera con npm install)
- Los triggers de MySQL son críticos, no modificarlos sin probar
- Handsontable es "non-commercial-and-evaluation"
- Siempre hacer `git pull` antes de trabajar