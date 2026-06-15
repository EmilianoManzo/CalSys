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
const SPECIAL_EXAMEN_FINAL_NAME = 'Calificación Examen Final';

router.get('/teacher/subjects', async (req, res) => {
  try {
    if (!allowRoles(req, res, ['admin', 'director', 'maestro'])) return;
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
    if (!allowRoles(req, res, ['admin', 'director', 'maestro'])) return;
    const { teacherId, semester, subjectCode } = req.query;
    if (!teacherId || !semester || !subjectCode) {
      return res.status(400).json({ error: 'Parámetros incompletos' });
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
    if (!allowRoles(req, res, ['admin', 'director', 'alumno'])) return;
    const { matricula } = req.query;
    if (!matricula) return res.status(400).json({ error: 'Matrícula requerida' });
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
    if (!allowRoles(req, res, ['admin', 'director', 'alumno'])) return;
    const { matricula, parcialId, subjectCode } = req.query;
    if (!matricula || !parcialId || !subjectCode) return res.status(400).json({ error: 'Parámetros incompletos' });

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
    if (!allowRoles(req, res, ['admin', 'director', 'alumno'])) return;
    const { matricula, subjectCode } = req.query;
    if (!matricula || !subjectCode) return res.status(400).json({ error: 'Parámetros incompletos' });
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
