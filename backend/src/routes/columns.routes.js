import express from 'express';
import db from '../config/database.js';
import { sendServerError } from '../middleware/security.js';
import { validateId, safeNumber, safeDivision, safeAverage } from '../utils/validation.js';
import { getEnrolledStudents, getEnrolledMatriculas } from '../utils/enrolledStudents.js';

const router = express.Router();

// Obtener configuración de columnas (incluye la especial "Promedio de Parciales")
router.get('/config', async (req, res) => {
  try {
    const { teacherId, semester, subject, group } = req.query;
    if (!teacherId || !semester || !subject) {
      return res.status(400).json({ error: 'Parametros incompletos' });
    }
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');
    
    const [columns] = await db.query(`
      SELECT * FROM grade_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND (group_code = ? OR group_code IS NULL)
      ORDER BY display_order, id
    `, [validatedTeacherId, semester, subject, group]);
    res.json({ columns: columns || [] });
  } catch (error) {
    console.error('Error obteniendo configuracion:', error);
    sendServerError(res);
  }
});

// Guardar configuración de columnas
router.post('/config', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { teacherId, semester, subject, group, columns } = req.body;
    if (!teacherId || !semester || !subject || !columns) {
      connection.release();
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');
    
    await connection.beginTransaction();
    // Eliminar columnas no especiales existentes
    await connection.query(`
      DELETE FROM grade_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
        AND is_special = 0
    `, [validatedTeacherId, semester, subject, group, group]);
    // Insertar nuevas columnas personalizadas
    let order = 0;
    for (const col of columns) {
      if (col.is_special) continue;
      const weight = safeNumber(col.weight, 0);
      const maxValue = safeNumber(col.maxValue, 10);
      await connection.query(`
        INSERT INTO grade_columns_config 
        (teacher_id, semester_code, subject_code, group_code, 
         column_name, column_type, max_value, weight, is_required, display_order, is_special)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `, [validatedTeacherId, semester, subject, group,
          col.name, col.type || 'numeric', maxValue,
          weight, col.required || false, order++]);
    }
    // Actualizar columna especial "Promedio de Parciales"
    const specialCol = columns.find(c => c.is_special === true);
    if (specialCol) {
      const weight = safeNumber(specialCol.weight, 0);
      const maxValue = safeNumber(specialCol.maxValue, 10);
      await connection.query(`
        UPDATE grade_columns_config
        SET weight = ?, max_value = ?, is_required = ?
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
          AND is_special = 1
      `, [weight, maxValue, specialCol.required ? 1 : 0,
          validatedTeacherId, semester, subject, group, group]);
    } else {
      // Crear especial por defecto si no existe
      const [existing] = await connection.query(`
        SELECT id FROM grade_columns_config
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
          AND is_special = 1
      `, [validatedTeacherId, semester, subject, group, group]);
      if (existing.length === 0) {
        await connection.query(`
          INSERT INTO grade_columns_config
          (teacher_id, semester_code, subject_code, group_code, column_name, column_type, max_value, weight, is_required, display_order, is_special)
          VALUES (?, ?, ?, ?, 'Promedio de Parciales', 'numeric', 10, 0, 0, -1, 1)
        `, [validatedTeacherId, semester, subject, group]);
      }
    }
    await connection.commit();
    connection.release();
    res.json({ success: true, message: 'Configuracion guardada' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error guardando configuracion:', error);
    sendServerError(res, 'Error al guardar configuracion');
  }
});

// Obtener calificaciones con valores personalizados + parciales
router.get('/with-custom', async (req, res) => {
  try {
    const { teacherId, semester, subject, group } = req.query;
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');

    // Configuración de columnas
    const [columns] = await db.query(`
      SELECT * FROM grade_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND (group_code = ? OR group_code IS NULL)
      ORDER BY display_order
    `, [validatedTeacherId, semester, subject, group]);

    const groupNorm = group && String(group).trim() !== '' ? group : null;
    const enrolled = await getEnrolledStudents(db, {
      teacherId: validatedTeacherId,
      semester,
      subject,
      groupCode: groupNorm
    });
    if (enrolled.length === 0) {
      return res.json({ grades: [], columns: columns || [] });
    }
    const matPlaceholders = enrolled.map(() => '?').join(',');
    const [grades] = await db.query(`
      SELECT 
        s.matricula, s.first_name, s.last_name,
        fg.id as grade_id, fg.final_grade, fg.status,
        fg.parcial_1, fg.parcial_2, fg.parcial_3, fg.ordinario,
        fg.promedio_parciales
      FROM students s
      INNER JOIN final_grades fg ON fg.student_matricula = s.matricula
        AND fg.teacher_id = ?
        AND fg.semester_code = ?
        AND fg.subject_code = ?
        AND (fg.group_code <=> ?)
      WHERE s.status = 'active' AND s.matricula IN (${matPlaceholders})
      ORDER BY s.last_name, s.first_name
    `, [validatedTeacherId, semester, subject, groupNorm, ...enrolled.map((s) => s.matricula)]);

    const gradeIds = grades.map(g => g.grade_id).filter(Boolean);
    let customValues = [];
    if (gradeIds.length > 0) {
      const placeholders = gradeIds.map(() => '?').join(',');
      [customValues] = await db.query(`
        SELECT gcv.grade_id, gcv.column_config_id, gcv.value
        FROM grade_custom_values gcv
        WHERE gcv.grade_id IN (${placeholders})
      `, gradeIds);
    }

    const result = grades.map(g => {
      const row = {
        matricula: g.matricula,
        nombre: `${g.first_name} ${g.last_name}`,
        grade_id: g.grade_id,
        final_grade: g.final_grade,
        status: g.status,
        parcial_1: g.parcial_1,
        parcial_2: g.parcial_2,
        parcial_3: g.parcial_3,
        ordinario: g.ordinario,
        promedio_parciales: g.promedio_parciales
      };
      columns.forEach(col => {
        const value = customValues.find(v => v.grade_id === g.grade_id && v.column_config_id === col.id);
        row[`col_${col.id}`] = value ? value.value : null;
      });
      return row;
    });

    res.json({ grades: result || [], columns: columns || [] });
  } catch (error) {
    console.error('Error obteniendo calificaciones:', error);
    sendServerError(res);
  }
});

// Calcular calificación final
function calcularFinal(columns, valores, promedioParciales, ordinario) {
  let total = 0, pesoTotal = 0;

  // Promedio de parciales (columna especial)
  const special = columns.find(c => c.is_special === 1);
  if (special && promedioParciales !== null) {
    const safeProm = safeNumber(promedioParciales);
    const weight = safeNumber(special.weight, 0);
    if (safeProm !== null) {
      total += (safeProm * (weight / 100));
      pesoTotal += weight;
    }
  }

  // Columnas personalizadas
  for (const col of columns) {
    if (col.column_type === 'numeric' && !col.is_special) {
      const val = valores[col.id];
      if (val !== null && val !== undefined && val !== '') {
        const v = safeNumber(val);
        if (v !== null) {
          const max = safeNumber(col.max_value, 10);
          const w = safeNumber(col.weight, 0);
          if (max > 0) {
            total += safeDivision(v * 10, max, 0) * (w / 100);
            pesoTotal += w;
          }
        }
      }
    }
  }

  // Evaluación final (ordinario) - se puede ponderar si se agrega como columna personalizada
  // Por ahora, si el profesor quiere ponderar ordinario, debe crearlo como columna adicional.

  return pesoTotal > 0 ? parseFloat(total.toFixed(2)) : null;
}

// Guardar calificaciones (parciales, ordinario, personalizadas)
router.post('/save-custom', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { values, parciales, ordinarios, semester, subject, group, teacherId } = req.body;
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');

    await connection.beginTransaction();

    // Obtener configuración de columnas
    const [columns] = await connection.query(`
      SELECT * FROM grade_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND (group_code = ? OR group_code IS NULL)
    `, [validatedTeacherId, semester, subject, group]);
    const allowedColumnIds = new Set((columns || []).map((col) => String(col.id)));

    // Agrupar valores personalizados por estudiante
    const valoresPorEstudiante = {};
    if (values && Array.isArray(values)) {
      for (const val of values) {
        if (!valoresPorEstudiante[val.matricula]) valoresPorEstudiante[val.matricula] = {};
        valoresPorEstudiante[val.matricula][val.columnId] = val.value;
      }
    }

    const groupNorm = group && String(group).trim() !== '' ? group : null;
    const matriculas = await getEnrolledMatriculas(connection, {
      teacherId: validatedTeacherId,
      semester,
      subject,
      groupCode: groupNorm
    });

    if (!matriculas || matriculas.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'No hay estudiantes inscritos en esta clase' });
    }

    for (const matricula of matriculas) {

      let [grades] = await connection.query(`
        SELECT id, parcial_1, parcial_2, parcial_3, ordinario, promedio_parciales
        FROM final_grades
        WHERE student_matricula = ? AND semester_code = ? AND subject_code = ?
          AND teacher_id = ? AND (group_code <=> ?)
      `, [matricula, semester, subject, validatedTeacherId, groupNorm]);

      let gradeId;
      let p1 = null, p2 = null, p3 = null, ord = null, prom = null;

      if (grades.length === 0) {
        continue;
      } else {
        gradeId = grades[0].id;
        p1 = grades[0].parcial_1;
        p2 = grades[0].parcial_2;
        p3 = grades[0].parcial_3;
        ord = grades[0].ordinario;
        prom = grades[0].promedio_parciales;
      }

      // Actualizar parciales si se enviaron
      if (parciales && parciales[matricula]) {
        p1 = parciales[matricula].parcial_1 !== undefined ? safeNumber(parciales[matricula].parcial_1) : p1;
        p2 = parciales[matricula].parcial_2 !== undefined ? safeNumber(parciales[matricula].parcial_2) : p2;
        p3 = parciales[matricula].parcial_3 !== undefined ? safeNumber(parciales[matricula].parcial_3) : p3;
        await connection.query(`
          UPDATE final_grades SET parcial_1 = ?, parcial_2 = ?, parcial_3 = ?
          WHERE id = ?
        `, [p1, p2, p3, gradeId]);
      }

      // Actualizar ordinario si se envió
      if (ordinarios && ordinarios[matricula] !== undefined) {
        ord = safeNumber(ordinarios[matricula]);
        await connection.query(`
          UPDATE final_grades SET ordinario = ? WHERE id = ?
        `, [ord, gradeId]);
      }

      // Calcular promedio de parciales de forma segura
      if (p1 !== null && p2 !== null && p3 !== null) {
        const validParciales = [p1, p2, p3].filter(p => p !== null);
        if (validParciales.length === 3) {
          prom = safeAverage(validParciales);
          if (prom !== null) {
            await connection.query(`
              UPDATE final_grades SET promedio_parciales = ? WHERE id = ?
            `, [prom, gradeId]);
          }
        }
      }

      // Guardar valores personalizados
      const valores = valoresPorEstudiante[matricula] || {};
      for (const [colId, valor] of Object.entries(valores)) {
        if (!allowedColumnIds.has(String(colId))) continue;
        await connection.query(`
          INSERT INTO grade_custom_values (grade_id, column_config_id, value)
          VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)
        `, [gradeId, colId, valor.toString()]);
      }

      // Calcular calificación final
      const finalGrade = calcularFinal(columns, valores, prom, ord);
      let status = 'in_progress';
      if (finalGrade !== null) status = finalGrade >= 6 ? 'passed' : 'failed';

      await connection.query(`
        UPDATE final_grades SET final_grade = ?, status = ? WHERE id = ?
      `, [finalGrade, status, gradeId]);
    }

    await connection.commit();
    connection.release();
    res.json({ success: true, message: 'Calificaciones guardadas' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error guardando:', error);
    sendServerError(res, 'Error al guardar calificaciones');
  }
});

export default router;
