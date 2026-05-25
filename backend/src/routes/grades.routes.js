import express from 'express';
import db from '../config/database.js';

const router = express.Router();

router.get('/teacher/subjects', async (req, res) => {
  try {
    const { teacherId, semester } = req.query;
    if (!teacherId) return res.status(400).json({ error: 'Teacher ID requerido' });
    let query = `
      SELECT DISTINCT 
        fg.subject_code,
        fg.semester_code,
        fg.group_code,
        COUNT(DISTINCT fg.student_matricula) as total_students
      FROM final_grades fg
      WHERE fg.teacher_id = ?
    `;
    const params = [teacherId];
    if (semester) { query += ` AND fg.semester_code = ?`; params.push(semester); }
    query += ` GROUP BY fg.subject_code, fg.semester_code, fg.group_code ORDER BY fg.subject_code`;
    const [subjects] = await db.query(query, params);
    res.json({ subjects });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.get('/subject/groups', async (req, res) => {
  try {
    const { teacherId, semester, subjectCode } = req.query;
    if (!teacherId || !semester || !subjectCode) {
      return res.status(400).json({ error: 'Parámetros incompletos' });
    }
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

// ============================================
// RUTAS PARA ALUMNOS
// ============================================

router.get('/student-subjects', async (req, res) => {
  try {
    const { matricula } = req.query;
    if (!matricula) return res.status(400).json({ error: 'Matrícula requerida' });

    const [subjects] = await db.query(`
      SELECT DISTINCT subject_code, semester_code, group_code, teacher_id
      FROM final_grades
      WHERE student_matricula = ?
    `, [matricula]);
    
    res.json({ subjects });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.get('/student-grades', async (req, res) => {
  try {
    const { matricula, parcialId, subjectCode } = req.query;
    if (!matricula || !parcialId || !subjectCode) return res.status(400).json({ error: 'Parámetros incompletos' });

    // Obtener contexto (teacher, semester, group)
    const [context] = await db.query(`
      SELECT teacher_id, semester_code, group_code
      FROM final_grades
      WHERE student_matricula = ? AND subject_code = ?
      LIMIT 1
    `, [matricula, subjectCode]);

    if (context.length === 0) return res.json({ columns: [], grades: [], promedio: null });

    const { teacher_id, semester_code, group_code } = context[0];

    // Obtener columnas
    let queryCols = `
      SELECT column_name as name, weight, max_value as \`maxValue\`, is_special as \`isSpecial\`
      FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ? AND partial_id = ? AND is_special = 0
    `;
    const paramsCols = [teacher_id, semester_code, subjectCode, parcialId];
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
    const paramsGrades = [teacher_id, semester_code, subjectCode, parcialId, matricula];
    if (group_code) { queryGrades += ` AND group_code = ?`; paramsGrades.push(group_code); }
    else { queryGrades += ` AND group_code IS NULL`; }

    const [grades] = await db.query(queryGrades, paramsGrades);

    // Obtener promedio
    const promedioObj = grades.find(g => g.columnName === '__promedio');
    const promedio = promedioObj ? parseFloat(promedioObj.value) : null;

    res.json({ columns, grades, promedio });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

router.get('/student-final', async (req, res) => {
  try {
    const { matricula, subjectCode } = req.query;
    if (!matricula || !subjectCode) return res.status(400).json({ error: 'Parámetros incompletos' });
    const parcialId = 4;

    // Obtener contexto
    const [context] = await db.query(`
      SELECT teacher_id, semester_code, group_code
      FROM final_grades
      WHERE student_matricula = ? AND subject_code = ?
      LIMIT 1
    `, [matricula, subjectCode]);

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
    const paramsGrades = [teacher_id, semester_code, subjectCode, parcialId, matricula];
    if (group_code) { queryGrades += ` AND group_code = ?`; paramsGrades.push(group_code); }
    else { queryGrades += ` AND group_code IS NULL`; }
    
    const [gradesData] = await db.query(queryGrades, paramsGrades);
    let finalGrades = [...gradesData];

    // Necesitamos calcular el Promedio de Parciales si la columna especial existe
    const specialCol = columns.find(c => c.isSpecial === 1);
    const specialWeight = specialCol ? (parseFloat(specialCol.weight) || 0) : 0;
    
    let promedioEspecial = null;
    if (specialCol) {
      let promQuery = `
        SELECT partial_id, value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ? 
          AND partial_id IN (1,2,3) AND column_name = '__promedio' AND student_matricula = ?
      `;
      const promParams = [teacher_id, semester_code, subjectCode, matricula];
      if (group_code) { promQuery += ` AND group_code = ?`; promParams.push(group_code); }
      else { promQuery += ` AND group_code IS NULL`; }
      
      const [promRows] = await db.query(promQuery, promParams);
      if (promRows.length > 0) {
        const sum = promRows.reduce((a, b) => a + parseFloat(b.value), 0);
        promedioEspecial = sum / promRows.length;
        promedioEspecial = parseFloat(promedioEspecial.toFixed(2));
        
        finalGrades.push({
          columnName: specialCol.name,
          value: promedioEspecial
        });
      }
    }

    // Calcular Promedio Final Global
    let total = 0, pesoTotal = 0;
    for (const col of columns) {
      if (col.isSpecial === 1) continue;
      const g = finalGrades.find(g => g.columnName === col.name);
      const val = g ? parseFloat(g.value) : null;
      if (val !== null && !isNaN(val)) {
        const w = parseFloat(col.weight) || 0;
        const max = parseFloat(col.maxValue) || 10;
        total += (val / max) * 10 * (w / 100);
        pesoTotal += w;
      }
    }
    if (promedioEspecial !== null && specialWeight > 0) {
      total += (promedioEspecial / 10) * 10 * (specialWeight / 100);
      pesoTotal += specialWeight;
    }
    
    const finalGlobal = pesoTotal > 0 ? parseFloat(total.toFixed(2)) : null;

    res.json({ columns, grades: finalGrades, promedio: finalGlobal });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

export default router;