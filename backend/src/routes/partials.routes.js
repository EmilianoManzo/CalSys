import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// ============================================
// FUNCIONES AUXILIARES
// ============================================

// Calcula el promedio ponderado de un parcial para un estudiante
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

// Calcula la calificación final global (pestaña final) para un estudiante
async function calcularFinalGlobal(teacherId, semester, subject, group, matricula) {
  // 1. Obtener todas las columnas de la pestaña final (normales y especial)
  const [columns] = await db.query(`
    SELECT column_name, weight, max_value, is_special
    FROM partial_columns_config
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = 4
      AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
  `, [teacherId, semester, subject, group, group]);
  if (columns.length === 0) return null;

  const normalCols = columns.filter(c => !c.is_special);
  const specialCol = columns.find(c => c.is_special === 1);

  // 2. Obtener valores de las columnas normales
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

  let total = 0, pesoTotal = 0;

  // 2a. Columnas normales
  for (const col of normalCols) {
    const val = valMap[col.column_name];
    if (val !== undefined && !isNaN(val)) {
      const w = parseFloat(col.weight) || 0;
      const max = parseFloat(col.max_value) || 10;
      total += (val / max) * 10 * (w / 100);
      pesoTotal += w;
    }
  }

  // 2b. Columna especial (Promedio de Parciales)
  if (specialCol) {
    const p1 = await calcularPromedioParcial(teacherId, semester, subject, group, 1, matricula);
    const p2 = await calcularPromedioParcial(teacherId, semester, subject, group, 2, matricula);
    const p3 = await calcularPromedioParcial(teacherId, semester, subject, group, 3, matricula);
    const valores = [p1, p2, p3].filter(v => v !== null);
    const promedioEspecial = valores.length > 0 ? valores.reduce((a,b)=>a+b,0)/valores.length : null;
    if (promedioEspecial !== null) {
      const w = parseFloat(specialCol.weight) || 0;
      total += (promedioEspecial / 10) * 10 * (w / 100);
      pesoTotal += w;
    }
  }

  return pesoTotal > 0 ? parseFloat(total.toFixed(2)) : null;
}

// Función auxiliar para crear columnas faltantes (solo para parciales normales)
async function ensureColumnsConfig(teacherId, semester, subject, group, partialId) {
  if (parseInt(partialId) === 4) return;
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
// RUTAS DE CONFIGURACIÓN
// ============================================
router.get('/config', async (req, res) => {
  try {
    let { teacherId, semester, subject, group, partialId } = req.query;
    if (!teacherId || !semester || !subject || !partialId) {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }
    if (group === '') group = null;
    // Si es parcial normal, auto‑asegurar columnas
    if (parseInt(partialId) !== 4) await ensureColumnsConfig(teacherId, semester, subject, group, partialId);

    // Columnas normales
    let query = `
      SELECT * FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ?
        AND is_special = 0
    `;
    const params = [teacherId, semester, subject, partialId];
    if (group !== null) {
      query += ` AND group_code = ?`;
      params.push(group);
    } else {
      query += ` AND group_code IS NULL`;
    }
    query += ` ORDER BY display_order`;
    let [columns] = await db.query(query, params);

    // Para pestaña final, añadir columna especial
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
      } else {
        specialQuery += ` AND group_code IS NULL`;
      }
      let [special] = await db.query(specialQuery, specialParams);
      if (special.length === 0) {
        // Crear columna especial por defecto
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

    // Eliminar columnas normales existentes
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

    // Insertar columnas normales
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

    // Actualizar columna especial (solo para final)
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
// RUTA: OBTENER CALIFICACIONES
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

    // Para parciales (1-3): añadir columna virtual de promedio
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

    // Para pestaña final: añadir columna especial y columna final global
    let specialColVirtual = null;
    let finalGlobalColVirtual = null;
    if (parseInt(partialId) === 4) {
      // Buscar columna especial real (ya debería existir)
      let specialColReal = realColumns.find(c => c.is_special === 1);
      if (!specialColReal) {
        // Si no existe, creamos una virtual
        specialColReal = {
          id: -1,
          column_name: 'Promedio de Parciales',
          weight: 0,
          max_value: 10,
          display_order: -1,
          is_special: 1,
          is_virtual: true
        };
      }
      finalGlobalColVirtual = {
        id: -3,
        column_name: '🎯 CALIFICACIÓN FINAL GLOBAL',
        weight: 0,
        max_value: 10,
        display_order: 998,
        is_special: 0,
        is_virtual: true
      };
      columns = [specialColReal, ...realColumns, finalGlobalColVirtual];
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

    // ---- Calcular valores de columnas virtuales ----
    if (parseInt(partialId) !== 4) {
      // Para parciales: obtener __promedio de la BD (si existe)
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
        const avg = promMap[student.matricula];
        if (avg !== undefined && avg !== null) {
          gradesData.push({
            student_matricula: student.matricula,
            column_name: '📊 Promedio Parcial',
            value: avg
          });
        }
      }
    }

    // ---- Pestaña final: calcular columna especial y final global ----
    if (parseInt(partialId) === 4) {
      // 1. Obtener promedios de los tres parciales para cada alumno
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

      // Columna especial (Promedio de Parciales)
      const specialCol = columns.find(c => c.is_special === 1);
      if (specialCol) {
        for (const student of students) {
          const p1 = promMap[student.matricula]?.[1];
          const p2 = promMap[student.matricula]?.[2];
          const p3 = promMap[student.matricula]?.[3];
          const valores = [p1, p2, p3].filter(v => v !== undefined && v !== null);
          if (valores.length > 0) {
            const avg = valores.reduce((a,b)=>a+b,0)/valores.length;
            gradesData.push({
              student_matricula: student.matricula,
              column_name: specialCol.column_name,
              value: avg.toFixed(2)
            });
          }
        }
      }

      // 2. Calcular calificación final global para cada estudiante
      for (const student of students) {
        const finalGlobal = await calcularFinalGlobal(teacherId, semester, subject, group, student.matricula);
        if (finalGlobal !== null) {
          gradesData.push({
            student_matricula: student.matricula,
            column_name: '🎯 CALIFICACIÓN FINAL GLOBAL',
            value: finalGlobal.toFixed(2)
          });
        }
      }
    }

    // Construir resultado
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
      // No guardar columnas virtuales
      if (parseInt(partialId) === 4 && columnName === 'Promedio de Parciales') continue;
      if (columnName === '📊 Promedio Parcial' || columnName === '🎯 CALIFICACIÓN FINAL GLOBAL') continue;
      const insertParams = [matricula, teacherId, semester, subject, groupValue, partialId, columnName, value];
      await connection.query(`
        INSERT INTO partial_grades (student_matricula, teacher_id, semester_code, subject_code, group_code, partial_id, column_name, value)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE value = VALUES(value)
      `, insertParams);
    }
    // NO recalculamos promedios aquí para evitar locks
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