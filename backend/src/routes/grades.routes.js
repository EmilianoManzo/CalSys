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

    await db.beginTransaction();

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

      await db.query(`
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

    await db.commit();

    res.json({ success: true, message: 'Calificaciones guardadas exitosamente' });

  } catch (error) {
    await db.rollback();
    console.error('Error guardando calificaciones:', error);
    res.status(500).json({ error: 'Error al guardar calificaciones' });
  }
});

export default router;