import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Obtener calificaciones de un grupo/materia
router.get('/', async (req, res) => {
  try {
    const { semester, subject, group } = req.query;

    if (!semester || !subject) {
      return res.status(400).json({ error: 'Semestre y materia requeridos' });
    }

    const query = `
      SELECT 
        s.matricula,
        s.first_name,
        s.last_name,
        fg.id as grade_id,
        fg.parcial_1,
        fg.parcial_2,
        fg.parcial_3,
        fg.ordinario,
        fg.attended_classes,
        fg.total_classes,
        fg.promedio_parciales,
        fg.attendance_percentage,
        fg.is_exempt,
        fg.final_grade,
        fg.status
      FROM students s
      LEFT JOIN final_grades fg ON s.matricula = fg.student_matricula 
        AND fg.semester_code = ? 
        AND fg.subject_code = ?
        ${group ? 'AND fg.group_code = ?' : ''}
      WHERE s.status = 'active'
      ORDER BY s.last_name, s.first_name
    `;

    const params = group ? [semester, subject, group] : [semester, subject];
    const [grades] = await db.query(query, params);

    res.json({ grades });

  } catch (error) {
    console.error('Error obteniendo calificaciones:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Guardar/actualizar calificaciones (batch)
router.post('/batch-update', async (req, res) => {
  try {
    const { grades, semester, subject, group, teacherId, teacherName } = req.body;

    if (!grades || !semester || !subject) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      for (const grade of grades) {
        const { matricula, parcial_1, parcial_2, parcial_3, ordinario, attended_classes, total_classes } = grade;

        // Calcular final_grade si tiene ordinario
        let finalGrade = null;
        let status = 'in_progress';

        if (ordinario !== null && ordinario !== undefined) {
          finalGrade = ordinario;
          status = ordinario >= 6 ? 'passed' : 'failed';
        } else if (parcial_1 !== null && parcial_2 !== null && parcial_3 !== null) {
          const promedio = (parcial_1 + parcial_2 + parcial_3) / 3;
          const attendance = total_classes > 0 ? (attended_classes / total_classes) * 100 : 0;
          
          if (promedio >= 9.0 && attendance >= 80) {
            finalGrade = 10;
            status = 'exempt';
          }
        }

        await connection.query(`
          INSERT INTO final_grades 
          (student_matricula, semester_code, subject_code, group_code, 
           parcial_1, parcial_2, parcial_3, ordinario,
           attended_classes, total_classes, final_grade, status,
           teacher_id, teacher_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            parcial_1 = VALUES(parcial_1),
            parcial_2 = VALUES(parcial_2),
            parcial_3 = VALUES(parcial_3),
            ordinario = VALUES(ordinario),
            attended_classes = VALUES(attended_classes),
            total_classes = VALUES(total_classes),
            final_grade = VALUES(final_grade),
            status = VALUES(status),
            updated_at = CURRENT_TIMESTAMP
        `, [
          matricula, semester, subject, group,
          parcial_1, parcial_2, parcial_3, ordinario,
          attended_classes || 0, total_classes || 0, finalGrade, status,
          teacherId, teacherName
        ]);
      }

      await connection.commit();
      connection.release();

      res.json({ success: true, message: 'Calificaciones guardadas exitosamente' });

    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }

  } catch (error) {
    console.error('Error guardando calificaciones:', error);
    res.status(500).json({ error: 'Error al guardar calificaciones' });
  }
});

// Obtener calificaciones en formato tabla plana para alumnos
router.get('/student/:matricula/tabla', async (req, res) => {
  try {
    const { matricula } = req.params;

    console.log('Obteniendo calificaciones de:', matricula);

    // Obtener calificaciones de actividades
    const [actividades] = await db.query(`
      SELECT 
        fg.semester_code as semestre,
        fg.subject_code as materia,
        fg.group_code as grupo,
        CONCAT(u.first_name, ' ', u.last_name) as maestro,
        gcc.column_name as actividad,
        gcv.value as calificacion,
        gcc.weight as peso,
        NULL as final
      FROM final_grades fg
      LEFT JOIN users u ON fg.teacher_id = u.id
      LEFT JOIN grade_custom_values gcv ON fg.id = gcv.grade_id
      LEFT JOIN grade_columns_config gcc ON gcv.column_config_id = gcc.id
      WHERE fg.student_matricula = ?
        AND gcc.id IS NOT NULL
      ORDER BY fg.semester_code DESC, fg.subject_code, gcc.display_order
    `, [matricula]);

    console.log('Actividades encontradas:', actividades.length);

    // Obtener calificaciones finales (una por materia)
    const [finales] = await db.query(`
      SELECT DISTINCT
        fg.semester_code as semestre,
        fg.subject_code as materia,
        fg.group_code as grupo,
        CONCAT(u.first_name, ' ', u.last_name) as maestro,
        '--- CALIFICACION FINAL ---' as actividad,
        NULL as calificacion,
        NULL as peso,
        fg.final_grade as final
      FROM final_grades fg
      LEFT JOIN users u ON fg.teacher_id = u.id
      WHERE fg.student_matricula = ?
        AND fg.final_grade IS NOT NULL
      ORDER BY fg.semester_code DESC, fg.subject_code
    `, [matricula]);

    console.log('Finales encontradas:', finales.length);

    // Combinar ambos resultados
    const calificaciones = [...actividades, ...finales];

    console.log('Total calificaciones:', calificaciones.length);

    res.json({ calificaciones });

  } catch (error) {
    console.error('Error obteniendo tabla de calificaciones:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Calcular promedio general del alumno
router.get('/student/:matricula/promedio', async (req, res) => {
  try {
    const { matricula } = req.params;

    const [result] = await db.query(`
      SELECT 
        AVG(final_grade) as promedio_general,
        COUNT(*) as total_materias,
        SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as materias_aprobadas,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as materias_reprobadas
      FROM final_grades
      WHERE student_matricula = ?
        AND final_grade IS NOT NULL
    `, [matricula]);

    res.json({
      promedioGeneral: result[0].promedio_general || 0,
      totalMaterias: result[0].total_materias || 0,
      materiasAprobadas: result[0].materias_aprobadas || 0,
      materiasReprobadas: result[0].materias_reprobadas || 0
    });

  } catch (error) {
    console.error('Error calculando promedio:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

export default router;