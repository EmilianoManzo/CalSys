import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// ============================================
// FUNCIONES AUXILIARES DE AUTO‑CONFIGURACIÓN
// ============================================

async function ensureColumnsConfig(teacherId, semester, subject, group, partialId) {
  // Obtener columnas existentes en partial_grades (excepto __promedio)
  let query = `
    SELECT DISTINCT column_name
    FROM partial_grades
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = ?
      AND column_name != '__promedio'
  `;
  const params = [teacherId, semester, subject, partialId];
  if (group !== null && group !== '') {
    query += ` AND group_code = ?`;
    params.push(group);
  }
  const [existingColumns] = await db.query(query, params);
  if (existingColumns.length === 0) return;

  // Obtener columnas ya configuradas
  let configQuery = `
    SELECT column_name FROM partial_columns_config
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = ?
      AND is_special = 0
  `;
  const configParams = [teacherId, semester, subject, partialId];
  if (group !== null && group !== '') {
    configQuery += ` AND group_code = ?`;
    configParams.push(group);
  }
  const [configuredColumns] = await db.query(configQuery, configParams);
  const configuredNames = new Set(configuredColumns.map(c => c.column_name));
  const missingColumns = existingColumns.filter(c => !configuredNames.has(c.column_name));
  if (missingColumns.length === 0) return;

  const totalColumns = existingColumns.length;
  const equalWeight = parseFloat((100 / totalColumns).toFixed(2));

  let orderQuery = `
    SELECT IFNULL(MAX(display_order), -1) as max_order
    FROM partial_columns_config
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = ?
  `;
  const orderParams = [teacherId, semester, subject, partialId];
  if (group !== null && group !== '') {
    orderQuery += ` AND group_code = ?`;
    orderParams.push(group);
  }
  const [maxOrder] = await db.query(orderQuery, orderParams);
  let order = maxOrder[0].max_order + 1;

  for (const col of missingColumns) {
    let insertQuery = `
      INSERT INTO partial_columns_config
      (teacher_id, semester_code, subject_code, group_code, partial_id, column_name, weight, max_value, display_order, is_special)
      VALUES (?, ?, ?, ?, ?, ?, ?, 10, ?, 0)
    `;
    const insertParams = [teacherId, semester, subject, group, partialId, col.column_name, equalWeight, order++];
    await db.query(insertQuery, insertParams);
  }
}

async function recalcPartialAverages(teacherId, semester, subject, group, partialId) {
  let deleteQuery = `
    DELETE FROM partial_grades
    WHERE column_name = '__promedio'
      AND teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = ?
  `;
  const deleteParams = [teacherId, semester, subject, partialId];
  if (group !== null && group !== '') {
    deleteQuery += ` AND group_code = ?`;
    deleteParams.push(group);
  }
  await db.query(deleteQuery, deleteParams);

  let insertQuery = `
    INSERT INTO partial_grades (student_matricula, teacher_id, semester_code, subject_code, group_code, partial_id, column_name, value)
    SELECT 
      g.student_matricula, g.teacher_id, g.semester_code, g.subject_code, g.group_code, g.partial_id, '__promedio',
      ROUND(SUM((CAST(g.value AS DECIMAL(5,2)) / pc.max_value) * 10 * (pc.weight / 100)), 2)
    FROM partial_grades g
    JOIN partial_columns_config pc ON 
      pc.teacher_id = g.teacher_id 
      AND pc.semester_code = g.semester_code 
      AND pc.subject_code = g.subject_code 
      AND (pc.group_code = g.group_code OR (pc.group_code IS NULL AND g.group_code IS NULL))
      AND pc.partial_id = g.partial_id
      AND pc.column_name = g.column_name
    WHERE g.teacher_id = ? AND g.semester_code = ? AND g.subject_code = ?
      AND g.partial_id = ?
      AND g.column_name != '__promedio'
  `;
  const insertParams = [teacherId, semester, subject, partialId];
  if (group !== null && group !== '') {
    insertQuery += ` AND g.group_code = ?`;
    insertParams.push(group);
  }
  insertQuery += ` GROUP BY g.student_matricula, g.teacher_id, g.semester_code, g.subject_code, g.group_code, g.partial_id`;
  await db.query(insertQuery, insertParams);
}

// ============================================
// RUTAS
// ============================================

router.get('/config', async (req, res) => {
  try {
    let { teacherId, semester, subject, group, partialId } = req.query;
    if (!teacherId || !semester || !subject || !partialId) {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }
    if (group === '') group = null;

    await ensureColumnsConfig(teacherId, semester, subject, group, partialId);

    let query = `
      SELECT * FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ?
        AND is_special = 0
    `;
    const params = [teacherId, semester, subject, partialId];
    if (group !== null && group !== '') {
      query += ` AND group_code = ?`;
      params.push(group);
    }
    query += ` ORDER BY display_order`;
    let [columns] = await db.query(query, params);

    if (parseInt(partialId) === 4) {
      let specialQuery = `
        SELECT * FROM partial_columns_config
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ? AND is_special = 1
      `;
      const specialParams = [teacherId, semester, subject, partialId];
      if (group !== null && group !== '') {
        specialQuery += ` AND group_code = ?`;
        specialParams.push(group);
      }
      let [special] = await db.query(specialQuery, specialParams);
      if (special.length === 0) {
        const insertParams = [teacherId, semester, subject, group, partialId];
        await db.query(`
          INSERT INTO partial_columns_config
          (teacher_id, semester_code, subject_code, group_code, partial_id, column_name, weight, max_value, display_order, is_special)
          VALUES (?, ?, ?, ?, ?, 'Promedio de Parciales', 0, 10, -1, 1)
        `, insertParams);
        [special] = await db.query(specialQuery, specialParams);
      }
      columns = [special[0], ...columns];
    }
    res.json({ columns });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
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
    const groupValue = (group === '' ? null : group);
    await connection.beginTransaction();
    let deleteQuery = `
      DELETE FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ? AND is_special = 0
    `;
    const deleteParams = [teacherId, semester, subject, partialId];
    if (groupValue !== null) {
      deleteQuery += ` AND group_code = ?`;
      deleteParams.push(groupValue);
    } else {
      deleteQuery += ` AND group_code IS NULL`;
    }
    await connection.query(deleteQuery, deleteParams);
    let order = 0;
    for (const col of columns) {
      if (col.is_special) continue;
      let insertQuery = `
        INSERT INTO partial_columns_config
        (teacher_id, semester_code, subject_code, group_code, partial_id,
         column_name, weight, max_value, display_order, is_special)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `;
      const insertParams = [teacherId, semester, subject, groupValue, partialId,
          col.name, col.weight || 0, col.maxValue || 10, order++];
      await connection.query(insertQuery, insertParams);
    }
    if (parseInt(partialId) === 4) {
      const specialCol = columns.find(c => c.is_special === true);
      if (specialCol) {
        let updateQuery = `
          UPDATE partial_columns_config
          SET weight = ?, max_value = ?, column_name = ?
          WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
            AND partial_id = ? AND is_special = 1
        `;
        const updateParams = [specialCol.weight, specialCol.maxValue, specialCol.name,
            teacherId, semester, subject, partialId];
        if (groupValue !== null) {
          updateQuery += ` AND group_code = ?`;
          updateParams.push(groupValue);
        } else {
          updateQuery += ` AND group_code IS NULL`;
        }
        await connection.query(updateQuery, updateParams);
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

router.get('/grades', async (req, res) => {
  try {
    let { teacherId, semester, subject, group, partialId, studentMatricula } = req.query;
    if (!teacherId || !semester || !subject || !partialId) {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }
    if (group === '') group = null;

    await ensureColumnsConfig(teacherId, semester, subject, group, partialId);

    let columnsQuery = `
      SELECT * FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ?
      ORDER BY is_special DESC, display_order
    `;
    const columnsParams = [teacherId, semester, subject, partialId];
    if (group !== null) {
      columnsQuery += ` AND group_code = ?`;
      columnsParams.push(group);
    } else {
      columnsQuery += ` AND group_code IS NULL`;
    }
    const [columns] = await db.query(columnsQuery, columnsParams);

    // Obtener estudiantes activos sin filtro de grupo (todos los alumnos)
    const [students] = await db.query(`
      SELECT matricula, first_name, last_name
      FROM students WHERE status = 'active'
      ORDER BY last_name, first_name
    `);
    if (students.length === 0) return res.json({ grades: [], columns });

    const matList = students.map(s => s.matricula);
    const colNames = columns.map(c => c.column_name);
    let gradesData = [];

    if (colNames.length > 0) {
      let gradesQuery = `
        SELECT student_matricula, column_name, value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ?
          AND student_matricula IN (${matList.map(() => '?').join(',')})
          AND column_name IN (${colNames.map(() => '?').join(',')})
      `;
      const gradesParams = [teacherId, semester, subject, partialId, ...matList, ...colNames];
      if (group !== null) {
        gradesQuery += ` AND group_code = ?`;
        gradesParams.push(group);
      } else {
        gradesQuery += ` AND group_code IS NULL`;
      }
      const [rows] = await db.query(gradesQuery, gradesParams);
      gradesData = rows;
    }

    // Para la pestaña final y un solo estudiante, calcular promedio de parciales
    if (parseInt(partialId) === 4 && studentMatricula) {
      let promQuery = `
        SELECT partial_id, value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND student_matricula = ?
          AND partial_id IN (1,2,3) AND column_name = '__promedio'
      `;
      const promParams = [teacherId, semester, subject, studentMatricula];
      if (group !== null) {
        promQuery += ` AND group_code = ?`;
        promParams.push(group);
      } else {
        promQuery += ` AND group_code IS NULL`;
      }
      const [proms] = await db.query(promQuery, promParams);
      const arr = [null, null, null];
      for (const p of proms) arr[p.partial_id - 1] = parseFloat(p.value);
      const sum = arr.reduce((a, b) => a + (b || 0), 0);
      const cnt = arr.filter(v => v !== null).length;
      const avg = cnt > 0 ? (sum / cnt).toFixed(2) : null;
      const specialCol = columns.find(c => c.is_special === 1);
      if (specialCol && avg !== null) {
        const existing = gradesData.find(g => g.student_matricula === studentMatricula && g.column_name === specialCol.column_name);
        if (existing) existing.value = avg;
        else gradesData.push({ student_matricula: studentMatricula, column_name: specialCol.column_name, value: avg });
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

router.post('/save-grades', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { teacherId, semester, subject, group, partialId, values } = req.body;
    if (!teacherId || !semester || !subject || !partialId || !values) {
      connection.release();
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    const groupValue = (group === '' ? null : group);
    await ensureColumnsConfig(teacherId, semester, subject, groupValue, partialId);
    await connection.beginTransaction();
    for (const val of values) {
      const { matricula, columnName, value } = val;
      if (!columnName) continue;
      if (parseInt(partialId) === 4 && columnName === 'Promedio de Parciales') continue;
      let insertQuery = `
        INSERT INTO partial_grades
        (student_matricula, teacher_id, semester_code, subject_code, group_code, partial_id, column_name, value)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE value = VALUES(value)
      `;
      const insertParams = [matricula, teacherId, semester, subject, groupValue, partialId, columnName, value];
      await connection.query(insertQuery, insertParams);
    }
    if (parseInt(partialId) !== 4) {
      await recalcPartialAverages(teacherId, semester, subject, groupValue, partialId);
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