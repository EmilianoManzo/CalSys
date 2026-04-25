import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Obtener materias del profesor (para su dashboard)
router.get('/teacher/subjects', async (req, res) => {
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

// Obtener materias que cursa un alumno
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

// Obtener calificaciones de un alumno para un parcial y materia específicos
router.get('/student-grades', async (req, res) => {
  try {
    const { matricula, parcialId, subjectCode } = req.query;
    if (!matricula || !parcialId || !subjectCode) {
      return res.status(400).json({ error: 'Matrícula, parcialId y subjectCode son requeridos' });
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

    const [columns] = await db.query(`
      SELECT column_name, weight, max_value
      FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND (group_code = ? OR group_code IS NULL)
        AND partial_id = ?
      ORDER BY display_order
    `, [teacher_id, semester_code, subjectCode, group_code, parcialId]);

    let grades = [];
    if (columns.length > 0) {
      const columnNames = columns.map(c => c.column_name);
      const placeholders = columnNames.map(() => '?').join(',');
      const [rows] = await db.query(`
        SELECT column_name, value
        FROM partial_grades
        WHERE student_matricula = ? AND teacher_id = ? AND semester_code = ?
          AND subject_code = ? AND (group_code = ? OR group_code IS NULL)
          AND partial_id = ? AND column_name IN (${placeholders})
      `, [matricula, teacher_id, semester_code, subjectCode, group_code, parcialId, ...columnNames]);
      grades = rows;
    }

    let total = 0, pesoTotal = 0;
    for (const col of columns) {
      const grade = grades.find(g => g.column_name === col.column_name);
      const val = grade ? parseFloat(grade.value) : null;
      if (val !== null && !isNaN(val)) {
        total += (val / col.max_value) * 10 * (col.weight / 100);
        pesoTotal += col.weight;
      }
    }
    const promedio = pesoTotal > 0 ? parseFloat(total.toFixed(2)) : null;

    res.json({
      columns: columns.map(c => ({ name: c.column_name, maxValue: c.max_value, weight: c.weight })),
      grades: grades.map(g => ({ columnName: g.column_name, value: g.value })),
      promedio,
      materia: subjectCode
    });
  } catch (error) {
    console.error('Error obteniendo calificaciones del alumno:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Obtener calificación final de un alumno para una materia (pestaña final)
router.get('/student-final', async (req, res) => {
  try {
    const { matricula, subjectCode } = req.query;
    if (!matricula || !subjectCode) {
      return res.status(400).json({ error: 'Matrícula y materia requeridas' });
    }

    const [info] = await db.query(`
      SELECT teacher_id, semester_code, group_code
      FROM final_grades
      WHERE student_matricula = ? AND subject_code = ?
      LIMIT 1
    `, [matricula, subjectCode]);
    if (info.length === 0) {
      return res.json({ columns: [], grades: [], promedio: null, materia: subjectCode });
    }
    const { teacher_id, semester_code, group_code } = info[0];

    // Obtener columnas de la pestaña final (partial_id=4)
    const [columns] = await db.query(`
      SELECT column_name, weight, max_value, is_special
      FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND (group_code = ? OR group_code IS NULL)
        AND partial_id = 4
      ORDER BY display_order
    `, [teacher_id, semester_code, subjectCode, group_code]);

    // Obtener calificaciones del alumno para esas columnas (excluyendo la especial, que se calculará)
    let grades = [];
    if (columns.length > 0) {
      const normalColumns = columns.filter(c => !c.is_special);
      if (normalColumns.length > 0) {
        const columnNames = normalColumns.map(c => c.column_name);
        const placeholders = columnNames.map(() => '?').join(',');
        const [rows] = await db.query(`
          SELECT column_name, value
          FROM partial_grades
          WHERE student_matricula = ? AND teacher_id = ? AND semester_code = ?
            AND subject_code = ? AND (group_code = ? OR group_code IS NULL)
            AND partial_id = 4 AND column_name IN (${placeholders})
        `, [matricula, teacher_id, semester_code, subjectCode, group_code, ...columnNames]);
        grades = rows;
      }
    }

    // Calcular promedio ponderado de la pestaña final, incluyendo la columna especial
    let total = 0, pesoTotal = 0;
    for (const col of columns) {
      let val = null;
      if (col.is_special) {
        // Promedio de los tres parciales
        const [proms] = await db.query(`
          SELECT value FROM partial_grades
          WHERE student_matricula = ? AND teacher_id = ? AND semester_code = ?
            AND subject_code = ? AND (group_code = ? OR group_code IS NULL)
            AND partial_id IN (1,2,3) AND column_name = '__promedio'
        `, [matricula, teacher_id, semester_code, subjectCode, group_code]);
        if (proms.length === 3) {
          const suma = proms.reduce((s, p) => s + (parseFloat(p.value) || 0), 0);
          val = suma / 3;
        } else {
          val = null;
        }
      } else {
        const grade = grades.find(g => g.column_name === col.column_name);
        val = grade ? parseFloat(grade.value) : null;
      }
      if (val !== null && !isNaN(val)) {
        total += (val / col.max_value) * 10 * (col.weight / 100);
        pesoTotal += col.weight;
      }
    }
    const promedioFinal = pesoTotal > 0 ? parseFloat(total.toFixed(2)) : null;

    // Enviar también el valor de la columna especial en el array de grades para que se muestre
    const specialColumn = columns.find(c => c.is_special);
    let specialValue = null;
    if (specialColumn) {
      const [proms] = await db.query(`
        SELECT value FROM partial_grades
        WHERE student_matricula = ? AND teacher_id = ? AND semester_code = ?
          AND subject_code = ? AND (group_code = ? OR group_code IS NULL)
          AND partial_id IN (1,2,3) AND column_name = '__promedio'
      `, [matricula, teacher_id, semester_code, subjectCode, group_code]);
      if (proms.length === 3) {
        const suma = proms.reduce((s, p) => s + (parseFloat(p.value) || 0), 0);
        specialValue = suma / 3;
      }
    }
    const allGrades = [...grades];
    if (specialColumn && specialValue !== null) {
      allGrades.push({ columnName: specialColumn.column_name, value: specialValue });
    }

    res.json({
      columns: columns.map(c => ({ name: c.column_name, maxValue: c.max_value, weight: c.weight, isSpecial: c.is_special })),
      grades: allGrades,
      promedio: promedioFinal,
      materia: subjectCode
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

export default router;