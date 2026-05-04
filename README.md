# 📚 CalSys - Sistema de Gestión de Calificaciones

> Sistema completo para la gestión de calificaciones por parciales, con columnas configurables, promedios automáticos y dashboards para alumnos, profesores y administradores.

## 🚀 Características principales

- **Tres parciales independientes** (Parcial 1, 2, 3), cada uno con sus propias columnas y ponderaciones.
- **Calificación Final Global** que combina los tres parciales y columnas adicionales con pesos configurables.
- **Columnas completamente dinámicas**: el profesor puede crear tantas actividades como desee (tareas, exámenes, proyectos) y asignarles peso y valor máximo.
- **Cálculo automático** de promedios ponderados en tiempo real.
- **Dashboards diferenciados**:
  - 👨‍🏫 **Profesor**: captura de calificaciones, configuración de columnas.
  - 👨‍🎓 **Alumno**: consulta de sus notas en cada parcial y calificación final.
  - 👑 **Administrador**: vista global de todas las calificaciones, gestión de usuarios, materias y asignaciones.
- **Persistencia robusta** mediante MySQL con tablas `partial_columns_config` y `partial_grades`.
- **Interfaz moderna** con Handsontable, React y TailwindCSS.

## 🛠 Tecnologías utilizadas

| Capa          | Tecnologías |
|---------------|-------------|
| **Frontend**  | React 18, Vite, Handsontable, TailwindCSS, Axios |
| **Backend**   | Node.js, Express, JSON Web Token, bcryptjs |
| **Base de datos** | MySQL 8.0 |
| **Autenticación** | JWT con roles (admin, maestro, alumno) |
