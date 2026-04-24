import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Obtener configuración de columnas (normales + especial para final)
router.get('/config', async (req, res) => {
  try {
    const { teacherId, semester, subject, group, partialId } = req.query;
    if (!teacherId || !semester || !subject || !partialId) {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }
    let [columns] = await db.query(`
      SELECT * FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND (group_code = ? OR group_code IS NULL)
        AND partial_id = ?
        AND is_special = 0
      ORDER BY display_order
    `, [teacherId, semester, subject, group, partialId]);

    if (parseInt(partialId) === 4) {
      let [special] = await db.query(`
        SELECT * FROM partial_columns_config
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND (group_code = ? OR group_code IS NULL)
          AND partial_id = ? AND is_special = 1
      `, [teacherId, semester, subject, group, partialId]);
      if (special.length === 0) {
        await db.query(`
          INSERT IGNORE INTO partial_columns_config
          (teacher_id, semester_code, subject_code, group_code, partial_id, column_name, weight, max_value, display_order, is_special)
          VALUES (?, ?, ?, ?, ?, 'Promedio de Parciales', 0, 10, -1, 1)
        `, [teacherId, semester, subject, group, partialId]);
        [special] = await db.query(`
          SELECT * FROM partial_columns_config
          WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
            AND (group_code = ? OR group_code IS NULL)
            AND partial_id = ? AND is_special = 1
        `, [teacherId, semester, subject, group, partialId]);
      }
      columns = [special[0], ...columns];
    }
    res.json({ columns });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Guardar configuración de columnas
router.post('/config', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { teacherId, semester, subject, group, partialId, columns } = req.body;
    if (!teacherId || !semester || !subject || !partialId || !columns) {
      connection.release();
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    await connection.beginTransaction();
    // Eliminar columnas normales existentes
    await connection.query(`
      DELETE FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
        AND partial_id = ? AND is_special = 0
    `, [teacherId, semester, subject, group, group, partialId]);
    let order = 0;
    for (const col of columns) {
      if (col.is_special) continue;
      await connection.query(`
        INSERT INTO partial_columns_config
        (teacher_id, semester_code, subject_code, group_code, partial_id,
         column_name, weight, max_value, display_order, is_special)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `, [teacherId, semester, subject, group, partialId,
          col.name, col.weight || 0, col.maxValue || 10, order++]);
    }
    // Actualizar columna especial (solo para final)
    if (parseInt(partialId) === 4) {
      const specialCol = columns.find(c => c.is_special === true);
      if (specialCol) {
        await connection.query(`
          UPDATE partial_columns_config
          SET weight = ?, max_value = ?, column_name = ?
          WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
            AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
            AND partial_id = ? AND is_special = 1
        `, [specialCol.weight, specialCol.maxValue, specialCol.name,
            teacherId, semester, subject, group, group, partialId]);
      }
    }
    await connection.commit();
    connection.release();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener calificaciones (con cálculo de la columna especial)
router.get('/grades', async (req, res) => {
  try {
    const { teacherId, semester, subject, group, partialId } = req.query;
    if (!teacherId || !semester || !subject || !partialId) {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }
    // Obtener columnas
    const [columns] = await db.query(`
      SELECT * FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND (group_code = ? OR group_code IS NULL)
        AND partial_id = ?
      ORDER BY is_special DESC, display_order
    `, [teacherId, semester, subject, group, partialId]);

    const [students] = await db.query(`
      SELECT matricula, first_name, last_name
      FROM students WHERE status = 'active'
      ORDER BY last_name, first_name
    `);
    if (students.length === 0) return res.json({ grades: [], columns });

    const matList = students.map(s => s.matricula);
    const colNames = columns.map(c => c.column_name);
    let gradesData = [];
    if (matList.length) {
      const [rows] = await db.query(`
        SELECT student_matricula, column_name, value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND (group_code = ? OR group_code IS NULL)
          AND partial_id = ?
          AND student_matricula IN (${matList.map(() => '?').join(',')})
          AND column_name IN (${colNames.map(() => '?').join(',')})
      `, [teacherId, semester, subject, group, partialId, ...matList, ...colNames]);
      gradesData = rows;
    }

    // Para la pestaña final, calcular el valor de la columna especial (promedio de los tres parciales)
    if (parseInt(partialId) === 4) {
      const [proms] = await db.query(`
        SELECT student_matricula, partial_id, value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND (group_code = ? OR group_code IS NULL)
          AND partial_id IN (1,2,3) AND column_name = '__promedio'
      `, [teacherId, semester, subject, group]);
      const promMap = {};
      for (const p of proms) {
        if (!promMap[p.student_matricula]) promMap[p.student_matricula] = [null, null, null];
        promMap[p.student_matricula][p.partial_id - 1] = parseFloat(p.value);
      }
      const specialCol = columns.find(c => c.is_special === 1);
      if (specialCol) {
        for (const s of students) {
          const arr = promMap[s.matricula] || [null, null, null];
          const sum = arr.reduce((a, b) => a + (b || 0), 0);
          const cnt = arr.filter(v => v !== null).length;
          const avg = cnt > 0 ? (sum / cnt).toFixed(2) : null;
          const existing = gradesData.find(g => g.student_matricula === s.matricula && g.column_name === specialCol.column_name);
          if (existing) existing.value = avg;
          else if (avg !== null) gradesData.push({ student_matricula: s.matricula, column_name: specialCol.column_name, value: avg });
        }
      }
    }

    const result = students.map(s => {
      const row = { matricula: s.matricula, nombre: `${s.first_name} ${s.last_name}` };
      columns.forEach(col => {
        const g = gradesData.find(g => g.student_matricula === s.matricula && g.column_name === col.column_name);
        row[`col_${col.column_name}`] = g ? g.value : null;
      });
      return row;
    });
    res.json({ grades: result, columns });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Guardar calificaciones (para parciales y columnas adicionales de la final)
router.post('/save-grades', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { teacherId, semester, subject, group, partialId, values } = req.body;
    if (!teacherId || !semester || !subject || !partialId || !values) {
      connection.release();
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    await connection.beginTransaction();
    for (const val of values) {
      const { matricula, columnName, value } = val;
      if (!columnName) continue;
      // No guardar la columna especial de la final (se recalcula)
      if (parseInt(partialId) === 4 && columnName === 'Promedio de Parciales') continue;
      await connection.query(`
        INSERT INTO partial_grades
        (student_matricula, teacher_id, semester_code, subject_code, group_code, partial_id, column_name, value)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE value = VALUES(value)
      `, [matricula, teacherId, semester, subject, group, partialId, columnName, value]);
    }
    await connection.commit();
    connection.release();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

export default router;