import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// ============================================
// FUNCIÓN AUXILIAR (crea columnas faltantes, solo para parciales normales)
// ============================================
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
// RUTA: OBTENER CONFIGURACIÓN (CORREGIDA)
// ============================================
router.get('/config', async (req, res) => {
  try {
    let { teacherId, semester, subject, group, partialId } = req.query;
    if (!teacherId || !semester || !subject || !partialId) {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }
    // Normalizar group: cadena vacía → null
    if (group === '') group = null;

    // Consultar columnas normales (is_special = 0)
    let query = `
      SELECT * FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ?
        AND is_special = 0
    `;
    const params = [teacherId, semester, subject, partialId];
    // Solo filtramos por grupo si se proporcionó un valor no nulo
    if (group !== null) {
      query += ` AND group_code = ?`;
      params.push(group);
    }
    query += ` ORDER BY display_order`;
    let [columns] = await db.query(query, params);

    // Para la pestaña final (partialId=4), obtener/crear la columna especial
    if (parseInt(partialId) === 4) {
      let specialQuery = `
        SELECT * FROM partial_columns_config
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ? AND is_special = 1
      `;
      const specialParams = [teacherId, semester, subject, partialId];
      if (group !== null) {
        specialQuery += ` AND group_code = ?`;
        specialParams.push(group);
      }
      let [special] = await db.query(specialQuery, specialParams);
      if (special.length === 0) {
        // Crear la columna especial con el grupo actual (o null)
        await db.query(`
          INSERT INTO partial_columns_config
          (teacher_id, semester_code, subject_code, group_code, partial_id, column_name, weight, max_value, display_order, is_special)
          VALUES (?, ?, ?, ?, ?, 'Promedio de Parciales', 0, 10, -1, 1)
        `, [teacherId, semester, subject, group, partialId]);
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

// ============================================
// RUTA: GUARDAR CONFIGURACIÓN (CORREGIDA)
// ============================================
router.post('/config', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { teacherId, semester, subject, group, partialId, columns } = req.body;
    if (!teacherId || !semester || !subject || !partialId || !columns) {
      connection.release();
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    // Normalizar group: cadena vacía → null
    const groupValue = (group === '' ? null : group);

    await connection.beginTransaction();

    // Eliminar columnas normales existentes (coincidiendo con el grupo)
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

    // Insertar nuevas columnas normales
    let order = 0;
    for (const col of columns) {
      if (col.is_special) continue;
      await connection.query(`
        INSERT INTO partial_columns_config
        (teacher_id, semester_code, subject_code, group_code, partial_id,
         column_name, weight, max_value, display_order, is_special)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `, [teacherId, semester, subject, groupValue, partialId,
          col.name, col.weight || 0, col.maxValue || 10, order++]);
    }

    // Actualizar columna especial (solo para pestaña final)
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

// ============================================
// RUTA: OBTENER CALIFICACIONES (con columnas virtuales)
// ============================================
router.get('/grades', async (req, res) => {
  try {
    let { teacherId, semester, subject, group, partialId, studentMatricula } = req.query;
    if (!teacherId || !semester || !subject || !partialId) {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }
    if (group === '') group = null;
    if (parseInt(partialId) !== 4) await ensureColumnsConfig(teacherId, semester, subject, group, partialId);

    // Obtener columnas reales (is_special = 0)
    let columnsQuery = `
      SELECT * FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ? AND is_special = 0
      ORDER BY display_order
    `;
    const columnsParams = [teacherId, semester, subject, partialId];
    if (group !== null) {
      columnsQuery += ` AND group_code = ?`;
      columnsParams.push(group);
    } else {
      columnsQuery += ` AND group_code IS NULL`;
    }
    let [realColumns] = await db.query(columnsQuery, columnsParams);
    let columns = [...realColumns];

    // Para parciales (1-3): añadir columna de promedio virtual
    if (parseInt(partialId) !== 4) {
      columns.push({
        id: -2,
        column_name: '📊 Promedio Parcial',
        weight: 0,
        max_value: 10,
        display_order: 999,
        is_special: 0,
        is_virtual: true
      });
    }

    // Para pestaña final: columna especial y final global
    if (parseInt(partialId) === 4) {
      let specialCol = realColumns.find(c => c.is_special === 1);
      if (!specialCol) {
        specialCol = {
          id: -1,
          column_name: 'Promedio de Parciales',
          weight: 0,
          max_value: 10,
          display_order: -1,
          is_special: 1,
          is_virtual: true
        };
      }
      const finalGlobalCol = {
        id: -3,
        column_name: '🎯 CALIFICACIÓN FINAL GLOBAL',
        weight: 0,
        max_value: 10,
        display_order: 998,
        is_special: 0,
        is_virtual: true
      };
      columns = [specialCol, ...realColumns, finalGlobalCol];
    }

    const [students] = await db.query(`SELECT matricula, first_name, last_name FROM students WHERE status = 'active' ORDER BY last_name, first_name`);
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

    // Calcular valores para columnas virtuales
    if (parseInt(partialId) !== 4) {
      // Para parciales: obtener __promedio guardado (si existe) o calcularlo
      let promQuery = `
        SELECT student_matricula, value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ? AND column_name = '__promedio'
      `;
      const promParams = [teacherId, semester, subject, partialId];
      if (group !== null) {
        promQuery += ` AND group_code = ?`;
        promParams.push(group);
      } else {
        promQuery += ` AND group_code IS NULL`;
      }
      const [promRows] = await db.query(promQuery, promParams);
      const promMap = {};
      for (const row of promRows) promMap[row.student_matricula] = row.value;
      for (const student of students) {
        const promVal = promMap[student.matricula];
        if (promVal !== undefined && promVal !== null) {
          gradesData.push({
            student_matricula: student.matricula,
            column_name: '📊 Promedio Parcial',
            value: promVal
          });
        } else {
          // Si no existe __promedio, calcularlo manualmente (opcional)
          // ... (omitido por brevedad)
        }
      }
    }

    if (parseInt(partialId) === 4) {
      // Calcular promedio de los tres parciales para la columna especial
      let promQuery = `
        SELECT student_matricula, partial_id, value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id IN (1,2,3) AND column_name = '__promedio'
      `;
      const promParams = [teacherId, semester, subject];
      if (group !== null) {
        promQuery += ` AND group_code = ?`;
        promParams.push(group);
      } else {
        promQuery += ` AND group_code IS NULL`;
      }
      const [promRows] = await db.query(promQuery, promParams);
      const promMap = {};
      for (const row of promRows) {
        if (!promMap[row.student_matricula]) promMap[row.student_matricula] = {};
        promMap[row.student_matricula][row.partial_id] = parseFloat(row.value);
      }
      const specialCol = columns.find(c => c.is_special === 1);
      for (const student of students) {
        const p1 = promMap[student.matricula]?.[1];
        const p2 = promMap[student.matricula]?.[2];
        const p3 = promMap[student.matricula]?.[3];
        const vals = [p1, p2, p3].filter(v => v !== undefined && v !== null);
        if (vals.length > 0) {
          const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
          gradesData.push({
            student_matricula: student.matricula,
            column_name: specialCol.column_name,
            value: avg.toFixed(2)
          });
        }
      }
      // Calcular calificación final global (usando pesos de las columnas reales + especial)
      // ... (código existente, no lo repito)
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
    const groupValue = (group === '' ? null : group);
    await connection.beginTransaction();
    for (const val of values) {
      const { matricula, columnName, value } = val;
      if (!columnName) continue;
      if (parseInt(partialId) === 4 && columnName === 'Promedio de Parciales') continue;
      if (columnName === '📊 Promedio Parcial' || columnName === '🎯 CALIFICACIÓN FINAL GLOBAL') continue;
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