import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// ============================================
// FUNCIONES AUXILIARES PARA CÁLCULOS
// ============================================

// Calcula el promedio ponderado de un parcial para un estudiante
async function calcularPromedioParcial(teacherId, semester, subject, group, partialId, matricula) {
  // Obtener columnas configuradas
  let colQuery = `
    SELECT column_name, weight, max_value
    FROM partial_columns_config
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = ?
      AND is_special = 0
  `;
  const colParams = [teacherId, semester, subject, partialId];
  if (group) {
    colQuery += ` AND group_code = ?`;
    colParams.push(group);
  } else {
    colQuery += ` AND group_code IS NULL`;
  }
  const [columns] = await db.query(colQuery, colParams);
  if (columns.length === 0) return null;

  // Obtener valores del estudiante para esas columnas
  let valQuery = `
    SELECT column_name, value
    FROM partial_grades
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = ?
      AND student_matricula = ?
  `;
  const valParams = [teacherId, semester, subject, partialId, matricula];
  if (group) {
    valQuery += ` AND group_code = ?`;
    valParams.push(group);
  } else {
    valQuery += ` AND group_code IS NULL`;
  }
  const [values] = await db.query(valQuery, valParams);
  const valMap = {};
  for (const v of values) valMap[v.column_name] = parseFloat(v.value);

  let total = 0, pesoTotal = 0;
  for (const col of columns) {
    const val = valMap[col.column_name];
    if (val !== undefined && !isNaN(val)) {
      const w = parseFloat(col.weight) || 0;
      const max = parseFloat(col.max_value) || 10;
      total += (val / max) * 10 * (w / 100);
      pesoTotal += w;
    }
  }
  return pesoTotal > 0 ? parseFloat(total.toFixed(2)) : null;
}

// Calcula la calificación final global para un estudiante (partialId=4)
async function calcularFinalGlobal(teacherId, semester, subject, group, matricula) {
  // Obtener columnas de la pestaña final (normales y especial)
  let colQuery = `
    SELECT column_name, weight, max_value, is_special
    FROM partial_columns_config
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = 4
  `;
  const colParams = [teacherId, semester, subject];
  if (group) {
    colQuery += ` AND group_code = ?`;
    colParams.push(group);
  } else {
    colQuery += ` AND group_code IS NULL`;
  }
  const [columns] = await db.query(colQuery, colParams);
  if (columns.length === 0) return null;

  // Obtener valores de las columnas normales (no especiales)
  const normalCols = columns.filter(c => !c.is_special);
  let valQuery = `
    SELECT column_name, value
    FROM partial_grades
    WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
      AND partial_id = 4
      AND student_matricula = ?
  `;
  const valParams = [teacherId, semester, subject, matricula];
  if (group) {
    valQuery += ` AND group_code = ?`;
    valParams.push(group);
  } else {
    valQuery += ` AND group_code IS NULL`;
  }
  const [values] = await db.query(valQuery, valParams);
  const valMap = {};
  for (const v of values) valMap[v.column_name] = parseFloat(v.value);

  let total = 0, pesoTotal = 0;

  // 1. Columnas normales
  for (const col of normalCols) {
    const val = valMap[col.column_name];
    if (val !== undefined && !isNaN(val)) {
      const w = parseFloat(col.weight) || 0;
      const max = parseFloat(col.max_value) || 10;
      total += (val / max) * 10 * (w / 100);
      pesoTotal += w;
    }
  }

  // 2. Columna especial (Promedio de Parciales)
  const specialCol = columns.find(c => c.is_special === 1);
  if (specialCol) {
    // Calcular promedio de los tres parciales
    const p1 = await calcularPromedioParcial(teacherId, semester, subject, group, 1, matricula);
    const p2 = await calcularPromedioParcial(teacherId, semester, subject, group, 2, matricula);
    const p3 = await calcularPromedioParcial(teacherId, semester, subject, group, 3, matricula);
    const valores = [p1, p2, p3].filter(v => v !== null);
    const promedioEspecial = valores.length > 0 ? valores.reduce((a,b)=>a+b,0)/valores.length : null;
    if (promedioEspecial !== null) {
      const w = parseFloat(specialCol.weight) || 0;
      total += (promedioEspecial / 10) * 10 * (w / 100); // normalizado a 10
      pesoTotal += w;
    }
  }

  return pesoTotal > 0 ? parseFloat(total.toFixed(2)) : null;
}

// ============================================
// RUTA: OBTENER CALIFICACIONES (CON CÁLCULO DIRECTO)
// ============================================
router.get('/grades', async (req, res) => {
  try {
    let { teacherId, semester, subject, group, partialId, studentMatricula } = req.query;
    if (!teacherId || !semester || !subject || !partialId) {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }
    if (group === '') group = null;

    // 1. Obtener columnas reales (is_special = 0) para la vista solicitada
    let columnsQuery = `
      SELECT * FROM partial_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND partial_id = ?
        AND is_special = 0
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
    let nombreColumnaPromedioExtra = null;

    // 2. Si es un parcial (1-3), añadir columna virtual del promedio del parcial
    if (parseInt(partialId) !== 4) {
      nombreColumnaPromedioExtra = '📊 Promedio Parcial';
      columns.push({
        id: -2,
        column_name: nombreColumnaPromedioExtra,
        weight: 0,
        max_value: 10,
        display_order: 999,
        is_special: 0,
        is_virtual: true
      });
    }

    // 3. Si es la final (4), añadir columna especial y columna de calificación global
    if (parseInt(partialId) === 4) {
      // Columna especial (Promedio de Parciales)
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
      // Columna de calificación final global
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

    // 4. Obtener todos los estudiantes activos
    let studentsQuery = `SELECT matricula, first_name, last_name FROM students WHERE status = 'active' ORDER BY last_name, first_name`;
    const [students] = await db.query(studentsQuery);
    if (students.length === 0) return res.json({ grades: [], columns });

    // 5. Para cada estudiante, calcular sus valores
    const result = [];
    for (const student of students) {
      const row = { matricula: student.matricula, nombre: `${student.first_name} ${student.last_name}` };

      // 5a. Valores de columnas reales (almacenadas en BD)
      for (const col of realColumns) {
        let valor = null;
        const [val] = await db.query(`
          SELECT value FROM partial_grades
          WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
            AND partial_id = ? AND column_name = ?
            AND student_matricula = ?
            ${group !== null ? 'AND group_code = ?' : 'AND group_code IS NULL'}
        `, [teacherId, semester, subject, partialId, col.column_name, student.matricula, ...(group !== null ? [group] : [])]);
        if (val.length && val[0].value !== null) valor = parseFloat(val[0].value);
        row[`col_${col.column_name}`] = valor;
      }

      // 5b. Si es parcial, calcular promedio del parcial
      if (parseInt(partialId) !== 4) {
        const prom = await calcularPromedioParcial(teacherId, semester, subject, group, partialId, student.matricula);
        row[`col_${nombreColumnaPromedioExtra}`] = prom;
      }

      // 5c. Si es final, calcular especial y final global
      if (parseInt(partialId) === 4) {
        // Calcular promedio de parciales (columna especial)
        const p1 = await calcularPromedioParcial(teacherId, semester, subject, group, 1, student.matricula);
        const p2 = await calcularPromedioParcial(teacherId, semester, subject, group, 2, student.matricula);
        const p3 = await calcularPromedioParcial(teacherId, semester, subject, group, 3, student.matricula);
        const valores = [p1, p2, p3].filter(v => v !== null);
        const promedioEspecial = valores.length > 0 ? valores.reduce((a,b)=>a+b,0)/valores.length : null;
        row[`col_Promedio de Parciales`] = promedioEspecial;

        // Calcular final global
        const final = await calcularFinalGlobal(teacherId, semester, subject, group, student.matricula);
        row[`col_🎯 CALIFICACIÓN FINAL GLOBAL`] = final;
      }

      result.push(row);
    }

    res.json({ grades: result, columns });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS DE CONFIGURACIÓN (sin cambios significativos)
// ============================================
router.get('/config', async (req, res) => {
  // (Mantén el código anterior para /config – no lo repito por brevedad,
  //  pero asegúrate de que esté presente. Si quieres, pídemelo de nuevo)
  res.json({ columns: [] }); // Placeholder
});

router.post('/config', async (req, res) => {
  res.json({ success: true }); // Placeholder
});

router.post('/save-grades', async (req, res) => {
  // (Mantén el código anterior para guardar – no lo repito)
  res.json({ success: true }); // Placeholder
});

export default router;