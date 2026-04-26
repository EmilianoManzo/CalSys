import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// ----------------------------------------------------------------------
// Funciones auxiliares (reutilizadas)
// ----------------------------------------------------------------------
async function calcularPromedioParcial(teacherId, semester, subject, group, partialId, matricula) {
  const [columns] = await db.query(`
    SELECT column_name, weight, max_value
    FROM partial_columns_config
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = ?
      AND is_special = 0
      AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
  `, [teacherId, semester, subject, partialId, group, group]);
  if (columns.length === 0) return null;

  const [values] = await db.query(`
    SELECT column_name, value
    FROM partial_grades
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = ?
      AND student_matricula = ?
      AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
  `, [teacherId, semester, subject, partialId, matricula, group, group]);
  const valMap = {};
  for (const v of values) valMap[v.column_name] = parseFloat(v.value);

  let total = 0, peso = 0;
  for (const col of columns) {
    const val = valMap[col.column_name];
    if (val !== undefined && !isNaN(val)) {
      const w = parseFloat(col.weight) || 0;
      const max = parseFloat(col.max_value) || 10;
      total += (val / max) * 10 * (w / 100);
      peso += w;
    }
  }
  return peso > 0 ? parseFloat(total.toFixed(2)) : null;
}

async function calcularFinalGlobal(teacherId, semester, subject, group, matricula) {
  const [columns] = await db.query(`
    SELECT column_name, weight, max_value, is_special
    FROM partial_columns_config
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = 4
      AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
  `, [teacherId, semester, subject, group, group]);
  if (columns.length === 0) return null;

  const normalCols = columns.filter(c => !c.is_special);
  const [values] = await db.query(`
    SELECT column_name, value
    FROM partial_grades
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = 4
      AND student_matricula = ?
      AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
  `, [teacherId, semester, subject, matricula, group, group]);
  const valMap = {};
  for (const v of values) valMap[v.column_name] = parseFloat(v.value);

  let total = 0, peso = 0;
  for (const col of normalCols) {
    const val = valMap[col.column_name];
    if (val !== undefined && !isNaN(val)) {
      const w = parseFloat(col.weight) || 0;
      const max = parseFloat(col.max_value) || 10;
      total += (val / max) * 10 * (w / 100);
      peso += w;
    }
  }

  const specialCol = columns.find(c => c.is_special === 1);
  if (specialCol) {
    const p1 = await calcularPromedioParcial(teacherId, semester, subject, group, 1, matricula);
    const p2 = await calcularPromedioParcial(teacherId, semester, subject, group, 2, matricula);
    const p3 = await calcularPromedioParcial(teacherId, semester, subject, group, 3, matricula);
    const valores = [p1, p2, p3].filter(v => v !== null);
    const promedioEspecial = valores.length > 0 ? valores.reduce((a,b)=>a+b,0)/valores.length : null;
    if (promedioEspecial !== null) {
      const w = parseFloat(specialCol.weight) || 0;
      total += (promedioEspecial / 10) * 10 * (w / 100);
      peso += w;
    }
  }
  return peso > 0 ? parseFloat(total.toFixed(2)) : null;
}

// ----------------------------------------------------------------------
// ENDPOINTS EXISTENTES (sin cambios)
// ----------------------------------------------------------------------
router.get('/teacher/subjects', async (req, res) => {
  // ... (código original, sin modificar)
  try {
    const { teacherId, semester } = req.query;
    if (!teacherId) return res.status(400).json({ error: 'Teacher ID requerido' });
    let query = `
      SELECT DISTINCT subject_code, semester_code, group_code, COUNT(*) as total_students
      FROM final_grades
      WHERE teacher_id = ?
    `;
    const params = [teacherId];
    if (semester) { query += ` AND semester_code = ?`; params.push(semester); }
    query += ` GROUP BY subject_code, semester_code, group_code ORDER BY subject_code`;
    const [subjects] = await db.query(query, params);
    res.json({ subjects });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.get('/subject/groups', async (req, res) => {
  // ... (código original, sin modificar)
  try {
    const { teacherId, semester, subjectCode } = req.query;
    if (!teacherId || !semester || !subjectCode) return res.status(400).json({ error: 'Parámetros incompletos' });
    const [groups] = await db.query(`
      SELECT DISTINCT group_code, COUNT(*) as total_students
      FROM final_grades
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ? AND group_code IS NOT NULL
      GROUP BY group_code
    `, [teacherId, semester, subjectCode]);
    res.json({ groups });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT PARA OBTENER MATERIAS DEL ALUMNO
// ----------------------------------------------------------------------
router.get('/student-subjects', async (req, res) => {
  try {
    const { matricula } = req.query;
    if (!matricula) return res.status(400).json({ error: 'Matrícula requerida' });
    const [subjects] = await db.query(`
      SELECT DISTINCT subject_code, semester_code, group_code
      FROM final_grades
      WHERE student_matricula = ?
    `, [matricula]);
    res.json({ subjects });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: CALIFICACIONES DE UN ALUMNO PARA UN PARCIAL (CON PROMEDIO)
// ----------------------------------------------------------------------
router.get('/student-grades', async (req, res) => {
  try {
    const { matricula, parcialId, subjectCode } = req.query;
    if (!matricula || !parcialId || !subjectCode) {
      return res.status(400).json({ error: 'Matrícula, parcialId y subjectCode son requeridos' });
    }

    // Obtener datos de la materia (teacher_id, semester, group)
    const [subjectInfo] = await db.query(`
      SELECT teacher_id, semester_code, group_code
      FROM final_grades
      WHERE student_matricula = ? AND subject_code = ?
      LIMIT 1
    `, [matricula, subjectCode]);
    if (subjectInfo.length === 0) {
      return res.json({ columns: [], grades: [], promedio: null, materia: subjectCode });
    }
    const { teacher_id, semester_code, group_code } = subjectInfo[0];

    // Columnas reales (is_special = 0)
    const [realColumns] = await db.query(`
      SELECT column_name, weight, max_value
      FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ?
        AND is_special = 0
        AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
      ORDER BY display_order
    `, [teacher_id, semester_code, subjectCode, parcialId, group_code, group_code]);

    // Valores reales
    let colValues = [];
    if (realColumns.length > 0) {
      const colNames = realColumns.map(c => c.column_name);
      const [rows] = await db.query(`
        SELECT column_name, value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ?
          AND student_matricula = ?
          AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
          AND column_name IN (${colNames.map(() => '?').join(',')})
      `, [teacher_id, semester_code, subjectCode, parcialId, matricula, group_code, group_code, ...colNames]);
      colValues = rows;
    }

    // Calcular el promedio del parcial (columna virtual)
    const promedioParcial = await calcularPromedioParcial(teacher_id, semester_code, subjectCode, group_code, parcialId, matricula);

    // Construir respuesta: columnas reales + una columna extra "📊 Promedio Parcial"
    const columns = [...realColumns];
    columns.push({
      column_name: '📊 Promedio Parcial',
      weight: 0,
      max_value: 10,
      is_special: false
    });

    // Asignar valores (incluyendo el promedio calculado)
    const grades = colValues.map(g => ({ columnName: g.column_name, value: g.value }));
    grades.push({ columnName: '📊 Promedio Parcial', value: promedioParcial });

    res.json({
      columns: columns.map(c => ({ name: c.column_name, maxValue: c.max_value, weight: c.weight })),
      grades: grades,
      promedio: promedioParcial,
      materia: subjectCode
    });
  } catch (error) {
    console.error('Error obteniendo calificaciones del alumno:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: CALIFICACIÓN FINAL DEL ALUMNO (CON PROMEDIO DE PARCIALES Y FINAL GLOBAL)
// ----------------------------------------------------------------------
router.get('/student-final', async (req, res) => {
  try {
    const { matricula, subjectCode } = req.query;
    if (!matricula || !subjectCode) {
      return res.status(400).json({ error: 'Matrícula y materia requeridas' });
    }

    const [subjectInfo] = await db.query(`
      SELECT teacher_id, semester_code, group_code
      FROM final_grades
      WHERE student_matricula = ? AND subject_code = ?
      LIMIT 1
    `, [matricula, subjectCode]);
    if (subjectInfo.length === 0) {
      return res.json({ columns: [], grades: [], promedio: null, materia: subjectCode });
    }
    const { teacher_id, semester_code, group_code } = subjectInfo[0];

    // 1. Columnas reales (normales) de la pestaña final (partial_id=4, is_special=0)
    const [realColumns] = await db.query(`
      SELECT column_name, weight, max_value
      FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = 4
        AND is_special = 0
        AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
      ORDER BY display_order
    `, [teacher_id, semester_code, subjectCode, group_code, group_code]);

    // 2. Valores reales
    let colValues = [];
    if (realColumns.length > 0) {
      const colNames = realColumns.map(c => c.column_name);
      const [rows] = await db.query(`
        SELECT column_name, value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = 4
          AND student_matricula = ?
          AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
          AND column_name IN (${colNames.map(() => '?').join(',')})
      `, [teacher_id, semester_code, subjectCode, matricula, group_code, group_code, ...colNames]);
      colValues = rows;
    }

    // 3. Columna especial (Promedio de Parciales)
    // Obtener promedios de los tres parciales
    const p1 = await calcularPromedioParcial(teacher_id, semester_code, subjectCode, group_code, 1, matricula);
    const p2 = await calcularPromedioParcial(teacher_id, semester_code, subjectCode, group_code, 2, matricula);
    const p3 = await calcularPromedioParcial(teacher_id, semester_code, subjectCode, group_code, 3, matricula);
    const valoresParciales = [p1, p2, p3].filter(v => v !== null);
    const promedioEspecial = valoresParciales.length > 0 ? valoresParciales.reduce((a,b)=>a+b,0)/valoresParciales.length : null;

    // 4. Calificar final global
    const finalGlobal = await calcularFinalGlobal(teacher_id, semester_code, subjectCode, group_code, matricula);

    // 5. Construir respuesta (columnas: especial, reales, final global)
    const columns = [];
    // Columna especial
    columns.push({
      column_name: 'Promedio de Parciales',
      weight: 0,
      max_value: 10,
      is_special: true
    });
    // Reales
    columns.push(...realColumns);
    // Columna final global
    columns.push({
      column_name: '🎯 CALIFICACIÓN FINAL GLOBAL',
      weight: 0,
      max_value: 10,
      is_special: false
    });

    // Asignar valores
    const grades = [
      { columnName: 'Promedio de Parciales', value: promedioEspecial },
      ...colValues.map(g => ({ columnName: g.column_name, value: g.value })),
      { columnName: '🎯 CALIFICACIÓN FINAL GLOBAL', value: finalGlobal }
    ];

    res.json({
      columns: columns.map(c => ({ name: c.column_name, maxValue: c.max_value, weight: c.weight, isSpecial: c.is_special })),
      grades: grades,
      promedio: finalGlobal,
      materia: subjectCode
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

export default router;