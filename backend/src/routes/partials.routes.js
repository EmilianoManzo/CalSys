import express from 'express';
import db from '../config/database.js';
import { validateId, validateMatricula, safeNumber, safeDivision, safeAverage } from '../utils/validation.js';
import { getEnrolledStudents } from '../utils/enrolledStudents.js';

const router = express.Router();
const EXAMEN_FINAL_PARTIAL_ID = 4;
const CALIFICACION_FINAL_PARTIAL_ID = 5;
const SPECIAL_PARTIALS_AVG_NAME = 'Promedio de Parciales';
const SPECIAL_EXAMEN_FINAL_NAME = 'Calificación Examen Final';

// ============================================
// FUNCIONES AUXILIARES
// ============================================

async function ensureColumnsConfig(teacherId, semester, subject, group, partialId) {
  const validatedPartialId = validateId(partialId, 'Partial ID');
  if (validatedPartialId === CALIFICACION_FINAL_PARTIAL_ID) return;
  
  let query = `
    SELECT DISTINCT column_name
    FROM partial_grades
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = ?
      AND column_name != '__promedio'
  `;
  const params = [teacherId, semester, subject, validatedPartialId];
  if (group && group !== '') { query += ` AND group_code = ?`; params.push(group); }
  const [existing] = await db.query(query, params);
  if (!existing || existing.length === 0) return;

  let configQuery = `
    SELECT column_name FROM partial_columns_config
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = ?
      AND is_special = 0
  `;
  const configParams = [teacherId, semester, subject, validatedPartialId];
  if (group && group !== '') { configQuery += ` AND group_code = ?`; configParams.push(group); }
  const [configured] = await db.query(configQuery, configParams);
  const configuredNames = new Set(configured ? configured.map(c => c.column_name) : []);
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
  const orderParams = [teacherId, semester, subject, validatedPartialId];
  if (group && group !== '') { orderQuery += ` AND group_code = ?`; orderParams.push(group); }
  const [maxOrder] = await db.query(orderQuery, orderParams);
  let order = (maxOrder && maxOrder[0]) ? safeNumber(maxOrder[0].max_order, -1) + 1 : 0;

  for (const col of missing) {
    const insertParams = [teacherId, semester, subject, group, validatedPartialId, col.column_name, equalWeight, 10, order++];
    await db.query(`
      INSERT INTO partial_columns_config
      (teacher_id, semester_code, subject_code, group_code, partial_id, column_name, weight, max_value, display_order, is_special)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, insertParams);
  }
}

async function recalcPartialAverages(teacherId, semester, subject, group, partialId) {
  const validatedPartialId = validateId(partialId, 'Partial ID');
  if (validatedPartialId === CALIFICACION_FINAL_PARTIAL_ID) return;
  
  let deleteQuery = `
    DELETE FROM partial_grades
    WHERE column_name = '__promedio'
      AND teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = ?
  `;
  const deleteParams = [teacherId, semester, subject, validatedPartialId];
  if (group && group !== '') { deleteQuery += ` AND group_code = ?`; deleteParams.push(group); }
  else deleteQuery += ` AND group_code IS NULL`;
  await db.query(deleteQuery, deleteParams);

  let insertQuery = `
    INSERT INTO partial_grades (student_matricula, teacher_id, semester_code, subject_code, group_code, partial_id, column_name, value)
    SELECT 
      g.student_matricula,
      g.teacher_id,
      g.semester_code,
      g.subject_code,
      g.group_code,
      g.partial_id,
      '__promedio',
      ROUND(SUM((g.value / pc.max_value) * 10 * (pc.weight / 100)), 2)
    FROM partial_grades g
    JOIN partial_columns_config pc ON 
      pc.teacher_id = g.teacher_id 
      AND pc.semester_code = g.semester_code
      AND pc.subject_code = g.subject_code
      AND pc.partial_id = g.partial_id
      AND pc.column_name = g.column_name
      AND pc.is_special = 0
    WHERE g.teacher_id = ?
      AND g.semester_code = ?
      AND g.subject_code = ?
      AND g.partial_id = ?
      AND g.column_name != '__promedio'
  `;
  const insertParams = [teacherId, semester, subject, validatedPartialId];
  if (group && group !== '') {
    insertQuery += ` AND g.group_code = ?`;
    insertParams.push(group);
  } else {
    insertQuery += ` AND g.group_code IS NULL`;
  }
  insertQuery += ` GROUP BY g.student_matricula, g.teacher_id, g.semester_code, g.subject_code, g.group_code, g.partial_id`;
  await db.query(insertQuery, insertParams);
}

async function ensureFinalSpecialColumns(connectionOrDb, teacherId, semester, subject, group) {
  const expected = [
    { name: SPECIAL_PARTIALS_AVG_NAME, order: -2 },
    { name: SPECIAL_EXAMEN_FINAL_NAME, order: -1 }
  ];
  for (const special of expected) {
    let query = `
      SELECT id FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ? AND is_special = 1 AND column_name = ?
    `;
    const params = [teacherId, semester, subject, CALIFICACION_FINAL_PARTIAL_ID, special.name];
    if (group !== null && group !== undefined) {
      query += ` AND group_code = ?`;
      params.push(group);
    } else {
      query += ` AND group_code IS NULL`;
    }
    const [rows] = await connectionOrDb.query(query, params);
    if (!rows || rows.length === 0) {
      await connectionOrDb.query(`
        INSERT INTO partial_columns_config
        (teacher_id, semester_code, subject_code, group_code, partial_id, column_name, weight, max_value, display_order, is_special)
        VALUES (?, ?, ?, ?, ?, ?, 0, 10, ?, 1)
      `, [teacherId, semester, subject, group ?? null, CALIFICACION_FINAL_PARTIAL_ID, special.name, special.order]);
    }
  }
}

// ============================================
// RUTA: CONFIGURACIÓN
// ============================================
router.get('/config', async (req, res) => {
  try {
    let { teacherId, semester, subject, group, partialId } = req.query;
    if (!teacherId || !semester || !subject || !partialId) {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');
    const validatedPartialId = validateId(partialId, 'Partial ID');
    
    if (group === '') group = null;
    if (validatedPartialId !== CALIFICACION_FINAL_PARTIAL_ID) await ensureColumnsConfig(validatedTeacherId, semester, subject, group, validatedPartialId);

    let query = `
      SELECT * FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ? AND is_special = 0
    `;
    const params = [validatedTeacherId, semester, subject, validatedPartialId];
    if (group !== null) { query += ` AND group_code = ?`; params.push(group); }
    else query += ` AND group_code IS NULL`;
    query += ` ORDER BY display_order`;
    let [columns] = await db.query(query, params);

    if (validatedPartialId === CALIFICACION_FINAL_PARTIAL_ID) {
      await ensureFinalSpecialColumns(db, validatedTeacherId, semester, subject, group);
      let specialQuery = `
        SELECT * FROM partial_columns_config
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ? AND is_special = 1
      `;
      const specialParams = [validatedTeacherId, semester, subject, validatedPartialId];
      if (group !== null) { specialQuery += ` AND group_code = ?`; specialParams.push(group); }
      else specialQuery += ` AND group_code IS NULL`;
      specialQuery += ` ORDER BY display_order`;
      const [special] = await db.query(specialQuery, specialParams);
      columns = [...(special || []), ...(columns || [])];
    }
    res.json({ columns: columns || [] });
  } catch (error) {
    console.error('Error en GET /config:', error);
    res.status(500).json({ error: error.message || 'Error en el servidor' });
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
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');
    const validatedPartialId = validateId(partialId, 'Partial ID');
    const groupValue = (group === '' ? null : group);
    
    await connection.beginTransaction();

    let deleteQuery = `
      DELETE FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ? AND is_special = 0
    `;
    const deleteParams = [validatedTeacherId, semester, subject, validatedPartialId];
    if (groupValue !== null) { deleteQuery += ` AND group_code = ?`; deleteParams.push(groupValue); }
    else deleteQuery += ` AND group_code IS NULL`;
    await connection.query(deleteQuery, deleteParams);

    let order = 0;
    for (const col of columns) {
      if (col.is_special) continue;
      const weight = safeNumber(col.weight, 0);
      const maxValue = safeNumber(col.maxValue, 10);
      await connection.query(`
        INSERT INTO partial_columns_config
        (teacher_id, semester_code, subject_code, group_code, partial_id,
         column_name, weight, max_value, display_order, is_special)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `, [validatedTeacherId, semester, subject, groupValue, validatedPartialId,
          col.name, weight, maxValue, order++]);
    }

    if (validatedPartialId === CALIFICACION_FINAL_PARTIAL_ID) {
      await ensureFinalSpecialColumns(connection, validatedTeacherId, semester, subject, groupValue);
      const specialColumns = columns.filter(c => c.is_special === true);
      for (const specialCol of specialColumns) {
        const weight = safeNumber(specialCol.weight, 0);
        const maxValue = safeNumber(specialCol.maxValue, 10);
        let updateQuery = `
          UPDATE partial_columns_config
          SET weight = ?, max_value = ?
          WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
            AND partial_id = ? AND is_special = 1 AND column_name = ?
        `;
        const updateParams = [weight, maxValue,
          validatedTeacherId, semester, subject, validatedPartialId, specialCol.name];
        if (groupValue !== null) { updateQuery += ` AND group_code = ?`; updateParams.push(groupValue); }
        else updateQuery += ` AND group_code IS NULL`;
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
    res.status(500).json({ error: error.message || 'Error en el servidor' });
  }
});

// ============================================
// RUTA: OBTENER CALIFICACIONES (CORREGIDA)
// ============================================
router.get('/grades', async (req, res) => {
  try {
    let { teacherId, semester, subject, group, partialId, studentMatricula } = req.query;
    if (!teacherId || !semester || !subject || !partialId) {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');
    const validatedPartialId = validateId(partialId, 'Partial ID');
    
    if (group === '') group = null;
    if (validatedPartialId !== CALIFICACION_FINAL_PARTIAL_ID) await ensureColumnsConfig(validatedTeacherId, semester, subject, group, validatedPartialId);

    // Obtener columnas reales
    let columnsQuery = `
      SELECT * FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ? AND is_special = 0
      ORDER BY display_order
    `;
    const columnsParams = [validatedTeacherId, semester, subject, validatedPartialId];
    if (group !== null) { columnsQuery += ` AND group_code = ?`; columnsParams.push(group); }
    else columnsQuery += ` AND group_code IS NULL`;
    let [realColumns] = await db.query(columnsQuery, columnsParams);
    let columns = [...realColumns];

    // Agregar columnas virtuales
    if (validatedPartialId !== CALIFICACION_FINAL_PARTIAL_ID) {
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

    if (validatedPartialId === CALIFICACION_FINAL_PARTIAL_ID) {
      await ensureFinalSpecialColumns(db, validatedTeacherId, semester, subject, group);
      let specialQuery = `
        SELECT * FROM partial_columns_config
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ? AND is_special = 1
      `;
      const specialParams = [validatedTeacherId, semester, subject, validatedPartialId];
      if (group !== null) { specialQuery += ` AND group_code = ?`; specialParams.push(group); }
      else specialQuery += ` AND group_code IS NULL`;
      let [special] = await db.query(specialQuery, specialParams);

      const specialCols = (special || []).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      const finalGlobalCol = {
        id: -3,
        column_name: '🎯 CALIFICACIÓN FINAL GLOBAL',
        weight: 0,
        max_value: 10,
        display_order: 998,
        is_special: 0,
        is_virtual: true
      };
      columns = [...specialCols, ...realColumns, finalGlobalCol];
    }

    const students = await getEnrolledStudents(db, {
      teacherId: validatedTeacherId,
      semester,
      subject,
      groupCode: group
    });
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
      const gradesParams = [validatedTeacherId, semester, subject, validatedPartialId, ...matList, ...colNames];
      if (group !== null) { gradesQuery += ` AND group_code = ?`; gradesParams.push(group); }
      else gradesQuery += ` AND group_code IS NULL`;
      const [rows] = await db.query(gradesQuery, gradesParams);
      gradesData = rows;
    }

    // Para parciales normales: cargar __promedio
    if (validatedPartialId !== CALIFICACION_FINAL_PARTIAL_ID) {
      let promQuery = `
        SELECT student_matricula, value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ? AND column_name = '__promedio'
      `;
      const promParams = [validatedTeacherId, semester, subject, validatedPartialId];
      if (group !== null) { promQuery += ` AND group_code = ?`; promParams.push(group); }
      else promQuery += ` AND group_code IS NULL`;
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
    } else {
      // Para pestaña final global: calcular especiales y final global
      let promQuery = `
        SELECT student_matricula, partial_id, value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id IN (1,2,3) AND column_name = '__promedio'
      `;
      const promParams = [validatedTeacherId, semester, subject];
      if (group !== null) { promQuery += ` AND group_code = ?`; promParams.push(group); }
      else promQuery += ` AND group_code IS NULL`;
      const [promRows] = await db.query(promQuery, promParams);
      const promMap = {};
      for (const row of promRows) {
        if (!promMap[row.student_matricula]) promMap[row.student_matricula] = {};
        promMap[row.student_matricula][row.partial_id] = parseFloat(row.value);
      }

      let examQuery = `
        SELECT student_matricula, value
        FROM partial_grades
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ? AND column_name = '__promedio'
      `;
      const examParams = [validatedTeacherId, semester, subject, EXAMEN_FINAL_PARTIAL_ID];
      if (group !== null) { examQuery += ` AND group_code = ?`; examParams.push(group); }
      else examQuery += ` AND group_code IS NULL`;
      const [examRows] = await db.query(examQuery, examParams);
      const examMap = {};
      for (const row of examRows) examMap[row.student_matricula] = safeNumber(row.value);

      const partialAvgSpecialCol = columns.find(c => c.is_special === 1 && c.column_name === SPECIAL_PARTIALS_AVG_NAME);
      const examFinalSpecialCol = columns.find(c => c.is_special === 1 && c.column_name === SPECIAL_EXAMEN_FINAL_NAME);
      const partialAvgWeight = partialAvgSpecialCol ? safeNumber(partialAvgSpecialCol.weight, 0) : 0;
      const examFinalWeight = examFinalSpecialCol ? safeNumber(examFinalSpecialCol.weight, 0) : 0;

      for (const student of students) {
        const p1 = promMap[student.matricula]?.[1];
        const p2 = promMap[student.matricula]?.[2];
        const p3 = promMap[student.matricula]?.[3];
        const valores = [p1, p2, p3].map(v => safeNumber(v)).filter(v => v !== null);
        let promedioEspecial = null;
        if (valores.length > 0) {
          promedioEspecial = safeAverage(valores);
          if (promedioEspecial !== null) {
            promedioEspecial = parseFloat(promedioEspecial.toFixed(2));
          }
        }

        let total = 0, pesoTotal = 0;
        for (const col of realColumns) {
          const grade = gradesData.find(g => g.student_matricula === student.matricula && g.column_name === col.column_name);
          const val = grade ? safeNumber(grade.value) : null;
          if (val !== null) {
            const w = safeNumber(col.weight, 0);
            const max = safeNumber(col.max_value, 10);
            if (max > 0) {
              total += safeDivision(val * 10, max, 0) * (w / 100);
              pesoTotal += w;
            }
          }
        }
        const examenFinalGrade = safeNumber(examMap[student.matricula]);
        if (promedioEspecial !== null && partialAvgWeight > 0) {
          total += safeDivision(promedioEspecial * 10, 10, 0) * (partialAvgWeight / 100);
          pesoTotal += partialAvgWeight;
        }
        if (examenFinalGrade !== null && examFinalWeight > 0) {
          total += safeDivision(examenFinalGrade * 10, 10, 0) * (examFinalWeight / 100);
          pesoTotal += examFinalWeight;
        }
        const finalGlobal = pesoTotal > 0 ? parseFloat(total.toFixed(2)) : null;
        if (finalGlobal !== null) {
          gradesData.push({
            student_matricula: student.matricula,
            column_name: '🎯 CALIFICACIÓN FINAL GLOBAL',
            value: finalGlobal
          });
        }
        if (promedioEspecial !== null && partialAvgSpecialCol && !gradesData.find(g => g.student_matricula === student.matricula && g.column_name === partialAvgSpecialCol.column_name)) {
          gradesData.push({
            student_matricula: student.matricula,
            column_name: partialAvgSpecialCol.column_name,
            value: promedioEspecial
          });
        }
        if (examenFinalGrade !== null && examFinalSpecialCol && !gradesData.find(g => g.student_matricula === student.matricula && g.column_name === examFinalSpecialCol.column_name)) {
          gradesData.push({
            student_matricula: student.matricula,
            column_name: examFinalSpecialCol.column_name,
            value: examenFinalGrade
          });
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
    res.json({ grades: result || [], columns: columns || [] });
  } catch (error) {
    console.error('Error en GET /grades:', error);
    res.status(500).json({ error: error.message || 'Error en el servidor' });
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
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');
    const validatedPartialId = validateId(partialId, 'Partial ID');
    const groupValue = (group === '' ? null : group);
    
    await connection.beginTransaction();
    let specialColumnNames = new Set();
    if (validatedPartialId === CALIFICACION_FINAL_PARTIAL_ID) {
      let specialQuery = `
        SELECT column_name
        FROM partial_columns_config
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND partial_id = ? AND is_special = 1
      `;
      const specialParams = [validatedTeacherId, semester, subject, validatedPartialId];
      if (groupValue !== null) { specialQuery += ` AND group_code = ?`; specialParams.push(groupValue); }
      else specialQuery += ` AND group_code IS NULL`;
      const [specialRows] = await connection.query(specialQuery, specialParams);
      specialColumnNames = new Set((specialRows || []).map(r => r.column_name));
    }

    for (const val of values) {
      const { matricula, columnName, value } = val;
      if (!columnName) continue;
      if (validatedPartialId === CALIFICACION_FINAL_PARTIAL_ID && specialColumnNames.has(columnName)) continue;
      if (columnName === '📊 Promedio Parcial' || columnName === '🎯 CALIFICACIÓN FINAL GLOBAL') continue;
      const safeValue = safeNumber(value);
      const insertParams = [matricula, validatedTeacherId, semester, subject, groupValue, validatedPartialId, columnName, safeValue];
      await connection.query(`
        INSERT INTO partial_grades (student_matricula, teacher_id, semester_code, subject_code, group_code, partial_id, column_name, value)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE value = VALUES(value)
      `, insertParams);
    }
    await connection.commit();
    connection.release();

    if (validatedPartialId !== CALIFICACION_FINAL_PARTIAL_ID) {
      setTimeout(() => {
        recalcPartialAverages(validatedTeacherId, semester, subject, groupValue, validatedPartialId).catch(err =>
          console.error('Error en recálculo asíncrono:', err)
        );
      }, 100);
    }
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ error: error.message || 'Error en el servidor' });
  }
});

export default router;