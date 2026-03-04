import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Obtener configuración de columnas
router.get('/config', async (req, res) => {
  try {
    const { teacherId, semester, subject, group } = req.query;

    if (!teacherId || !semester || !subject) {
      return res.status(400).json({ error: 'Parametros incompletos' });
    }

    const [columns] = await db.query(`
      SELECT * FROM grade_columns_config
      WHERE teacher_id = ? 
        AND semester_code = ? 
        AND subject_code = ?
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

    // Eliminar configuración anterior
    await connection.query(`
      DELETE FROM grade_columns_config
      WHERE teacher_id = ? 
        AND semester_code = ? 
        AND subject_code = ?
        AND (group_code = ? OR (group_code IS NULL AND ? IS NULL))
    `, [teacherId, semester, subject, group, group]);

    // Insertar nueva configuración
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      await connection.query(`
        INSERT INTO grade_columns_config 
        (teacher_id, semester_code, subject_code, group_code, 
         column_name, column_type, max_value, weight, is_required, display_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        teacherId, semester, subject, group,
        col.name, col.type || 'numeric', col.maxValue || 10, 
        col.weight || 1, col.required || false, i
      ]);
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

// Obtener calificaciones con valores personalizados
router.get('/with-custom', async (req, res) => {
  try {
    const { teacherId, semester, subject, group } = req.query;

    // Obtener configuración de columnas
    const [columns] = await db.query(`
      SELECT * FROM grade_columns_config
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
        AND (group_code = ? OR group_code IS NULL)
      ORDER BY display_order
    `, [teacherId, semester, subject, group]);

    // Obtener alumnos y calificaciones base
    const [grades] = await db.query(`
      SELECT 
        s.matricula,
        s.first_name,
        s.last_name,
        fg.id as grade_id
      FROM students s
      LEFT JOIN final_grades fg ON s.matricula = fg.student_matricula
        AND fg.semester_code = ?
        AND fg.subject_code = ?
        ${group ? 'AND fg.group_code = ?' : ''}
      WHERE s.status = 'active'
      ORDER BY s.last_name, s.first_name
    `, group ? [semester, subject, group] : [semester, subject]);

    // Obtener valores personalizados
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

    // Combinar datos
    const result = grades.map(g => {
      const row = {
        matricula: g.matricula,
        nombre: `${g.first_name} ${g.last_name}`,
        grade_id: g.grade_id
      };

      // Agregar valores de columnas personalizadas
      columns.forEach(col => {
        const value = customValues.find(
          v => v.grade_id === g.grade_id && v.column_config_id === col.id
        );
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

// Guardar valores personalizados
router.post('/save-custom', async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { values, semester, subject, group, teacherId } = req.body;

    await connection.beginTransaction();

    for (const val of values) {
      const { matricula, columnId, value } = val;

      // Obtener o crear grade_id
      let [grades] = await connection.query(`
        SELECT id FROM final_grades
        WHERE student_matricula = ? 
          AND semester_code = ? 
          AND subject_code = ?
      `, [matricula, semester, subject]);

      let gradeId;
      if (grades.length === 0) {
        const [result] = await connection.query(`
          INSERT INTO final_grades 
          (student_matricula, semester_code, subject_code, group_code, teacher_id)
          VALUES (?, ?, ?, ?, ?)
        `, [matricula, semester, subject, group, teacherId]);
        gradeId = result.insertId;
      } else {
        gradeId = grades[0].id;
      }

      // Guardar valor personalizado
      await connection.query(`
        INSERT INTO grade_custom_values (grade_id, column_config_id, value)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE value = VALUES(value)
      `, [gradeId, columnId, value]);
    }

    await connection.commit();
    connection.release();

    res.json({ success: true });

  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error guardando valores:', error);
    res.status(500).json({ error: 'Error al guardar' });
  }
});

export default router;