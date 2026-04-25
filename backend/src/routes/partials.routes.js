import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Función auxiliar para crear columnas faltantes (solo para parciales normales)
async function ensureColumnsConfig(teacherId, semester, subject, group, partialId) {
  if (parseInt(partialId) === 4) return; // la pestaña final no se auto‑configura
  let query = `
    SELECT DISTINCT column_name
    FROM partial_grades
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = ?
      AND column_name != '__promedio'
  `;
  const params = [teacherId, semester, subject, partialId];
  if (group && group !== '') { query += ` AND group_code = ?`; params.push(group); }
  const [existing] = await db.query(query, params);
  if (existing.length === 0) return;

  let configQuery = `
    SELECT column_name FROM partial_columns_config
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = ?
      AND is_special = 0
  `;
  const configParams = [teacherId, semester, subject, partialId];
  if (group && group !== '') { configQuery += ` AND group_code = ?`; configParams.push(group); }
  const [configured] = await db.query(configQuery, configParams);
  const configuredNames = new Set(configured.map(c => c.column_name));
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
  const orderParams = [teacherId, semester, subject, partialId];
  if (group && group !== '') { orderQuery += ` AND group_code = ?`; orderParams.push(group); }
  const [maxOrder] = await db.query(orderQuery, orderParams);
  let order = maxOrder[0].max_order + 1;

  for (const col of missing) {
    const insertParams = [teacherId, semester, subject, group, partialId, col.column_name, equalWeight, 10, order++];
    await db.query(`
      INSERT INTO partial_columns_config
      (teacher_id, semester_code, subject_code, group_code, partial_id, column_name, weight, max_value, display_order, is_special)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, insertParams);
  }
}

// ============================================
// RUTA: OBTENER CONFIGURACIÓN
// ============================================
router.get('/config', async (req, res) => {
  try {
    let { teacherId, semester, subject, group, partialId } = req.query;
    if (!teacherId || !semester || !subject || !partialId) return res.status(400).json({ error: 'Faltan parámetros' });
    if (group === '') group = null;
    if (parseInt(partialId) !== 4) await ensureColumnsConfig(teacherId, semester, subject, group, partialId);

    let query = `
      SELECT * FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ?
        AND is_special = 0
    `;
    const params = [teacherId, semester, subject, partialId];
    if (group !== null) { query += ` AND group_code = ?`; params.push(group); }
    else query += ` AND group_code IS NULL`;
    query += ` ORDER BY display_order`;
    let [columns] = await db.query(query, params);

    // Si es la pestaña final, obtener también la columna especial (si existe)
    if (parseInt(partialId) === 4) {
      let specialQuery = `
        SELECT * FROM partial_columns_config
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ? AND is_special = 1
      `;
      const specialParams = [teacherId, semester, subject, partialId];
      if (group !== null) { specialQuery += ` AND group_code = ?`; specialParams.push(group); }
      else specialQuery += ` AND group_code IS NULL`;
      let [special] = await db.query(specialQuery, specialParams);
      if (special.length === 0) {
        // Crear la columna especial si no existe (peso 0 por defecto)
        const insertParams = [teacherId, semester, subject, group, partialId];
        await db.query(`
          INSERT INTO partial_columns_config
          (teacher_id, semester_code, subject_code, group_code, partial_id, column_name, weight, max_value, display_order, is_special)
          VALUES (?, ?, ?, ?, ?, 'Promedio de Parciales', 0, 10, -1, 1)
        `, insertParams);
        [special] = await db.query(specialQuery, specialParams);
      }
      // Poner la especial al principio
      columns = [special[0], ...columns];
    }
    res.json({ columns });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTA: GUARDAR CONFIGURACIÓN
// ============================================
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

    // 1. Eliminar columnas normales (is_special = 0) existentes
    let deleteNormal = `
      DELETE FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ? AND is_special = 0
    `;
    const deleteNormalParams = [teacherId, semester, subject, partialId];
    if (groupValue !== null) { deleteNormal += ` AND group_code = ?`; deleteNormalParams.push(groupValue); }
    else deleteNormal += ` AND group_code IS NULL`;
    await connection.query(deleteNormal, deleteNormalParams);

    // 2. Insertar columnas normales (las que no son especiales)
    let order = 0;
    for (const col of columns) {
      if (col.is_special) continue;
      const insertParams = [teacherId, semester, subject, groupValue, partialId,
        col.name, col.weight || 0, col.maxValue || 10, order++];
      await connection.query(`
        INSERT INTO partial_columns_config
        (teacher_id, semester_code, subject_code, group_code, partial_id,
         column_name, weight, max_value, display_order, is_special)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `, insertParams);
    }

    // 3. Actualizar (o insertar) la columna especial (solo para partialId=4)
    if (parseInt(partialId) === 4) {
      const specialCol = columns.find(c => c.is_special === true);
      if (specialCol) {
        let updateSpecial = `
          UPDATE partial_columns_config
          SET weight = ?, max_value = ?
          WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
            AND partial_id = ? AND is_special = 1
        `;
        const updateParams = [specialCol.weight, specialCol.maxValue,
          teacherId, semester, subject, partialId];
        if (groupValue !== null) { updateSpecial += ` AND group_code = ?`; updateParams.push(groupValue); }
        else updateSpecial += ` AND group_code IS NULL`;
        const [result] = await connection.query(updateSpecial, updateParams);
        if (result.affectedRows === 0) {
          // Si no existe, insertarla
          const insertSpecial = `
            INSERT INTO partial_columns_config
            (teacher_id, semester_code, subject_code, group_code, partial_id,
             column_name, weight, max_value, display_order, is_special)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, -1, 1)
          `;
          const insertParams = [teacherId, semester, subject, groupValue, partialId,
            specialCol.name || 'Promedio de Parciales', specialCol.weight, specialCol.maxValue];
          await connection.query(insertSpecial, insertParams);
        }
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

// ============================================
// RUTA: OBTENER CALIFICACIONES (sin cambios en la lógica de promedios)
// ============================================
router.get('/grades', async (req, res) => {
  try {
    let { teacherId, semester, subject, group, partialId, studentMatricula } = req.query;
    if (!teacherId || !semester || !subject || !partialId) return res.status(400).json({ error: 'Faltan parámetros' });
    if (group === '') group = null;
    if (parseInt(partialId) !== 4) await ensureColumnsConfig(teacherId, semester, subject, group, partialId);

    // Obtener columnas (normales y especial)
    let columnsQuery = `
      SELECT * FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ?
      ORDER BY is_special DESC, display_order
    `;
    const columnsParams = [teacherId, semester, subject, partialId];
    if (group !== null) { columnsQuery += ` AND group_code = ?`; columnsParams.push(group); }
    else columnsQuery += ` AND group_code IS NULL`;
    let [columns] = await db.query(columnsQuery, columnsParams);

    const [students] = await db.query(`SELECT matricula, first_name, last_name FROM students WHERE status = 'active' ORDER BY last_name, first_name`);
    if (students.length === 0) return res.json({ grades: [], columns });

    const matList = students.map(s => s.matricula);
    const colNames = columns.map(c => c.column_name);
    let gradesData = [];

    if (colNames.length > 0) {
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
      const gradesParams = [teacherId, semester, subject, partialId, ...matList, ...colNames];
      if (group !== null) { gradesQuery += ` AND group_code = ?`; gradesParams.push(group); }
      else gradesQuery += ` AND group_code IS NULL`;
      const [rows] = await db.query(gradesQuery, gradesParams);
      gradesData = rows;
    }

    // Para la pestaña final, calcular el valor de la columna especial (Promedio de Parciales)
    if (parseInt(partialId) === 4) {
      let promQuery = `
        SELECT student_matricula, partial_id, value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id IN (1,2,3) AND column_name = '__promedio'
      `;
      const promParams = [teacherId, semester, subject];
      if (group !== null) { promQuery += ` AND group_code = ?`; promParams.push(group); }
      else promQuery += ` AND group_code IS NULL`;
      const [promRows] = await db.query(promQuery, promParams);
      const promMap = {};
      for (const row of promRows) {
        if (!promMap[row.student_matricula]) promMap[row.student_matricula] = {};
        promMap[row.student_matricula][row.partial_id] = parseFloat(row.value);
      }
      const specialCol = columns.find(c => c.is_special === 1);
      if (specialCol) {
        for (const student of students) {
          const p1 = promMap[student.matricula]?.[1];
          const p2 = promMap[student.matricula]?.[2];
          const p3 = promMap[student.matricula]?.[3];
          const valores = [p1, p2, p3].filter(v => v !== undefined && v !== null);
          if (valores.length > 0) {
            const avg = valores.reduce((a, b) => a + b, 0) / valores.length;
            // Añadir o actualizar el valor en gradesData
            const existing = gradesData.find(g => g.student_matricula === student.matricula && g.column_name === specialCol.column_name);
            if (existing) existing.value = avg.toFixed(2);
            else gradesData.push({ student_matricula: student.matricula, column_name: specialCol.column_name, value: avg.toFixed(2) });
          }
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
    res.json({ grades: result, columns });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTA: GUARDAR CALIFICACIONES (sin recalcular promedios)
// ============================================
router.post('/save-grades', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { teacherId, semester, subject, group, partialId, values } = req.body;
    if (!teacherId || !semester || !subject || !partialId || !values) {
      connection.release();
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    const groupValue = (group === '' ? null : group);
    await connection.beginTransaction();
    for (const val of values) {
      const { matricula, columnName, value } = val;
      if (!columnName) continue;
      // No guardar la columna especial (su valor se calcula automáticamente)
      if (parseInt(partialId) === 4 && columnName === 'Promedio de Parciales') continue;
      const insertParams = [matricula, teacherId, semester, subject, groupValue, partialId, columnName, value];
      await connection.query(`
        INSERT INTO partial_grades (student_matricula, teacher_id, semester_code, subject_code, group_code, partial_id, column_name, value)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE value = VALUES(value)
      `, insertParams);
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