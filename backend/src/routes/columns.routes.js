import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Obtener configuración de columnas (incluye la especial "Promedio de Parciales")
router.get('/config', async (req, res) => {
  try {
    const { teacherId, semester, subject, group } = req.query;
    if (!teacherId || !semester || !subject) {
      return res.status(400).json({ error: 'Parametros incompletos' });
    }
    const [columns] = await db.query(`
      SELECT * FROM grade_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND (group_code = ? OR group_code IS NULL)
      ORDER BY display_order, id
    `, [teacherId, semester, subject, group]);
    res.json({ columns });
  } catch (error) {
    console.error('Error obteniendo configuracion:', error);
    res.status(500).json({ error: 'Error en el servidor' });
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
    await connection.beginTransaction();
    // Eliminar columnas no especiales existentes
    await connection.query(`
      DELETE FROM grade_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
        AND is_special = 0
    `, [teacherId, semester, subject, group, group]);
    // Insertar nuevas columnas personalizadas
    let order = 0;
    for (const col of columns) {
      if (col.is_special) continue;
      await connection.query(`
        INSERT INTO grade_columns_config 
        (teacher_id, semester_code, subject_code, group_code, 
         column_name, column_type, max_value, weight, is_required, display_order, is_special)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `, [teacherId, semester, subject, group,
          col.name, col.type || 'numeric', col.maxValue || 10,
          col.weight || 0, col.required || false, order++]);
    }
    // Actualizar columna especial "Promedio de Parciales"
    const specialCol = columns.find(c => c.is_special === true);
    if (specialCol) {
      await connection.query(`
        UPDATE grade_columns_config
        SET weight = ?, max_value = ?, is_required = ?
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
          AND is_special = 1
      `, [specialCol.weight, specialCol.maxValue, specialCol.required ? 1 : 0,
          teacherId, semester, subject, group, group]);
    } else {
      // Crear especial por defecto si no existe
      const [existing] = await connection.query(`
        SELECT id FROM grade_columns_config
        WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
          AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
          AND is_special = 1
      `, [teacherId, semester, subject, group, group]);
      if (existing.length === 0) {
        await connection.query(`
          INSERT INTO grade_columns_config
          (teacher_id, semester_code, subject_code, group_code, column_name, column_type, max_value, weight, is_required, display_order, is_special)
          VALUES (?, ?, ?, ?, 'Promedio de Parciales', 'numeric', 10, 0, 0, -1, 1)
        `, [teacherId, semester, subject, group]);
      }
    }
    await connection.commit();
    connection.release();
    res.json({ success: true, message: 'Configuracion guardada' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error guardando configuracion:', error);
    res.status(500).json({ error: 'Error al guardar configuracion' });
  }
});

// Obtener calificaciones con valores personalizados + parciales
router.get('/with-custom', async (req, res) => {
  try {
    const { teacherId, semester, subject, group } = req.query;

    // Configuración de columnas
    const [columns] = await db.query(`
      SELECT * FROM grade_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND (group_code = ? OR group_code IS NULL)
      ORDER BY display_order
    `, [teacherId, semester, subject, group]);

    // Datos de estudiantes y calificaciones
    const [grades] = await db.query(`
      SELECT 
        s.matricula, s.first_name, s.last_name,
        fg.id as grade_id, fg.final_grade, fg.status,
        fg.parcial_1, fg.parcial_2, fg.parcial_3, fg.ordinario,
        fg.promedio_parciales
      FROM students s
      LEFT JOIN final_grades fg ON s.matricula = fg.student_matricula
        AND fg.semester_code = ? AND fg.subject_code = ?
        ${group ? 'AND fg.group_code = ?' : ''}
      WHERE s.status = 'active'
      ORDER BY s.last_name, s.first_name
    `, group ? [semester, subject, group] : [semester, subject]);

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

    res.json({ grades: result, columns });
  } catch (error) {
    console.error('Error obteniendo calificaciones:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Calcular calificación final
function calcularFinal(columns, valores, promedioParciales, ordinario) {
  let total = 0, pesoTotal = 0;

  // Promedio de parciales (columna especial)
  const special = columns.find(c => c.is_special === 1);
  if (special && promedioParciales !== null) {
    total += (promedioParciales * (special.weight / 100));
    pesoTotal += special.weight;
  }

  // Columnas personalizadas
  for (const col of columns) {
    if (col.column_type === 'numeric' && !col.is_special) {
      const val = valores[col.id];
      if (val && !isNaN(val)) {
        const v = parseFloat(val);
        const max = parseFloat(col.max_value) || 10;
        const w = parseFloat(col.weight) || 0;
        total += ((v / max) * 10) * (w / 100);
        pesoTotal += w;
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

    await connection.beginTransaction();

    // Obtener configuración de columnas
    const [columns] = await connection.query(`
      SELECT * FROM grade_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND (group_code = ? OR group_code IS NULL)
    `, [teacherId, semester, subject, group]);

    // Agrupar valores personalizados por estudiante
    const valoresPorEstudiante = {};
    if (values) {
      for (const val of values) {
        if (!valoresPorEstudiante[val.matricula]) valoresPorEstudiante[val.matricula] = {};
        valoresPorEstudiante[val.matricula][val.columnId] = val.value;
      }
    }

    // Obtener todos los estudiantes activos (para asegurar que todos tengan registro)
    const [students] = await connection.query(`SELECT matricula FROM students WHERE status = 'active'`);

    for (const student of students) {
      const matricula = student.matricula;

      // Obtener o crear final_grades
      let [grades] = await connection.query(`
        SELECT id, parcial_1, parcial_2, parcial_3, ordinario, promedio_parciales
        FROM final_grades
        WHERE student_matricula = ? AND semester_code = ? AND subject_code = ? AND group_code = ?
      `, [matricula, semester, subject, group]);

      let gradeId;
      let p1 = null, p2 = null, p3 = null, ord = null, prom = null;

      if (grades.length === 0) {
        const [result] = await connection.query(`
          INSERT INTO final_grades (student_matricula, semester_code, subject_code, group_code, teacher_id, status)
          VALUES (?, ?, ?, ?, ?, 'in_progress')
        `, [matricula, semester, subject, group, teacherId]);
        gradeId = result.insertId;
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
        p1 = parciales[matricula].parcial_1 !== undefined ? parciales[matricula].parcial_1 : p1;
        p2 = parciales[matricula].parcial_2 !== undefined ? parciales[matricula].parcial_2 : p2;
        p3 = parciales[matricula].parcial_3 !== undefined ? parciales[matricula].parcial_3 : p3;
        await connection.query(`
          UPDATE final_grades SET parcial_1 = ?, parcial_2 = ?, parcial_3 = ?
          WHERE id = ?
        `, [p1, p2, p3, gradeId]);
      }

      // Actualizar ordinario si se envió
      if (ordinarios && ordinarios[matricula] !== undefined) {
        ord = ordinarios[matricula];
        await connection.query(`
          UPDATE final_grades SET ordinario = ? WHERE id = ?
        `, [ord, gradeId]);
      }

      // Calcular promedio de parciales
      if (p1 !== null && p2 !== null && p3 !== null) {
        prom = (p1 + p2 + p3) / 3;
        await connection.query(`
          UPDATE final_grades SET promedio_parciales = ? WHERE id = ?
        `, [prom, gradeId]);
      }

      // Guardar valores personalizados
      const valores = valoresPorEstudiante[matricula] || {};
      for (const [colId, valor] of Object.entries(valores)) {
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
    res.status(500).json({ error: 'Error al guardar: ' + error.message });
  }
});

export default router;