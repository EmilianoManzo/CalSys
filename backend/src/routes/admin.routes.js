import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../config/database.js';

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const [totalStudents] = await db.query(`SELECT COUNT(*) as total FROM students WHERE status = 'active'`);
    const [totalTeachers] = await db.query(`SELECT COUNT(*) as total FROM users WHERE role IN ('maestro', 'admin', 'director') AND status = 'active' AND is_active = 1`);
    const [totalSubjects] = await db.query(`SELECT COUNT(DISTINCT subject_code) as total FROM final_grades`);
    const [totalGrades] = await db.query(`SELECT COUNT(*) as total FROM partial_grades WHERE column_name NOT IN ('__promedio', '📊 Promedio Parcial', '🎯 CALIFICACIÓN FINAL GLOBAL')`);
    
    // Promedio general usando valores reales de partial_grades
    const [avgResult] = await db.query(`
      SELECT ROUND(AVG((pg.value / pc.max_value) * 10), 2) as promedio
      FROM partial_grades pg
      JOIN partial_columns_config pc ON pg.column_name = pc.column_name 
        AND pg.teacher_id = pc.teacher_id 
        AND pg.semester_code = pc.semester_code 
        AND pg.subject_code = pc.subject_code
        AND pg.partial_id = pc.partial_id
      WHERE pg.value IS NOT NULL AND pg.column_name != '__promedio'
    `);
    const average = avgResult[0]?.promedio || 0;

    // Estudiantes con al menos una calificación de parcial (tienen __promedio)
    const [studentsWithGrades] = await db.query(`SELECT COUNT(DISTINCT student_matricula) as total FROM partial_grades WHERE column_name = '__promedio' AND value IS NOT NULL`);
    const totalStudentsWithGrades = studentsWithGrades[0].total;

    // Clasificación por promedio final (promedio de los tres parciales)
    const [gradeStatus] = await db.query(`
      SELECT 
        student_matricula,
        AVG(value) as promedio_final
      FROM partial_grades
      WHERE column_name = '__promedio' AND value IS NOT NULL
      GROUP BY student_matricula
    `);
    let passed = 0, failed = 0;
    for (const row of gradeStatus) {
      const prom = parseFloat(row.promedio_final);
      if (prom >= 6) passed++;
      else if (prom < 6) failed++;
    }
    let inProgress = totalStudents[0].total - (passed + failed);
    if (inProgress < 0) inProgress = 0;

    // Estadísticas por materia (promedio por materia)
    const [subjectStats] = await db.query(`
      SELECT 
        pg.subject_code,
        COUNT(DISTINCT pg.student_matricula) as estudiantes,
        ROUND(AVG((pg.value / pc.max_value) * 10), 2) as promedio
      FROM partial_grades pg
      JOIN partial_columns_config pc ON pg.column_name = pc.column_name 
        AND pg.teacher_id = pc.teacher_id 
        AND pg.semester_code = pc.semester_code 
        AND pg.subject_code = pc.subject_code
        AND pg.partial_id = pc.partial_id
      WHERE pg.column_name != '__promedio' AND pg.value IS NOT NULL
      GROUP BY pg.subject_code
      ORDER BY promedio DESC
    `);

    res.json({
      students: totalStudents[0].total,
      teachers: totalTeachers[0].total,
      subjects: totalSubjects[0].total,
      grades: totalGrades[0].total,
      average: average,
      passed: passed,
      failed: failed,
      inProgress: inProgress,
      subjectStats: subjectStats
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ============================================
// ENDPOINTS PARA MATERIAS (CRUD COMPLETO)
// ============================================
router.get('/materias', async (req, res) => {
  try {
    const [materias] = await db.query(`
      SELECT m.*, 
        COUNT(DISTINCT fg.student_matricula) as total_estudiantes,
        COUNT(DISTINCT fg.teacher_id) as total_maestros
      FROM materias m
      LEFT JOIN final_grades fg ON m.subject_code = fg.subject_code
      GROUP BY m.id
      ORDER BY m.subject_code
    `);
    res.json({ materias });
  } catch (error) {
    console.error('Error obteniendo materias:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.post('/materias', async (req, res) => {
  try {
    const { subject_code, subject_name, credits, description } = req.body;
    if (!subject_code || !subject_name) {
      return res.status(400).json({ error: 'Código y nombre son requeridos' });
    }
    const [existing] = await db.query('SELECT id FROM materias WHERE subject_code = ?', [subject_code]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'La materia ya existe' });
    }
    await db.query(`
      INSERT INTO materias (subject_code, subject_name, credits, description)
      VALUES (?, ?, ?, ?)
    `, [subject_code.toUpperCase(), subject_name, credits || 5, description || null]);
    res.json({ success: true, message: 'Materia creada exitosamente' });
  } catch (error) {
    console.error('Error creando materia:', error);
    res.status(500).json({ error: 'Error al crear materia' });
  }
});

router.put('/materias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { subject_name, credits, description } = req.body;
    await db.query(`
      UPDATE materias 
      SET subject_name = ?, credits = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [subject_name, credits, description, id]);
    res.json({ success: true, message: 'Materia actualizada' });
  } catch (error) {
    console.error('Error actualizando materia:', error);
    res.status(500).json({ error: 'Error al actualizar materia' });
  }
});

router.delete('/materias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [materia] = await db.query('SELECT subject_code FROM materias WHERE id = ?', [id]);
    if (materia.length === 0) {
      return res.status(404).json({ error: 'Materia no encontrada' });
    }
    const [asignaciones] = await db.query(`
      SELECT COUNT(*) as total FROM final_grades WHERE subject_code = ?
    `, [materia[0].subject_code]);
    if (asignaciones[0].total > 0) {
      return res.status(400).json({ error: 'No se puede eliminar la materia porque tiene calificaciones asignadas' });
    }
    await db.query('DELETE FROM materias WHERE id = ?', [id]);
    res.json({ success: true, message: 'Materia eliminada exitosamente' });
  } catch (error) {
    console.error('Error eliminando materia:', error);
    res.status(500).json({ error: 'Error al eliminar materia' });
  }
});

router.get('/profesores', async (req, res) => {
  try {
    const [profesores] = await db.query(`
      SELECT id, username, first_name, last_name, email, role
      FROM users 
      WHERE role IN ('maestro', 'admin')
      AND status = 'active'
      AND is_active = 1
      ORDER BY first_name, last_name
    `);
    res.json({ profesores });
  } catch (error) {
    console.error('Error obteniendo profesores:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.get('/grupos', async (req, res) => {
  try {
    const [grupos] = await db.query(`
      SELECT DISTINCT group_code 
      FROM final_grades 
      WHERE group_code IS NOT NULL
      ORDER BY group_code
    `);
    res.json({ grupos: grupos.map(g => g.group_code) });
  } catch (error) {
    console.error('Error obteniendo grupos:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.post('/asignar-materia', async (req, res) => {
  try {
    const { subject_code, teacher_id, semester_code, group_code } = req.body;
    if (!subject_code || !teacher_id || !semester_code) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }
    const [materia] = await db.query('SELECT subject_code FROM materias WHERE subject_code = ?', [subject_code]);
    if (materia.length === 0) {
      return res.status(400).json({ error: 'La materia no existe en el catálogo' });
    }
    const [existing] = await db.query(`
      SELECT id FROM final_grades 
      WHERE subject_code = ? AND teacher_id = ? AND semester_code = ? AND group_code = ?
      LIMIT 1
    `, [subject_code, teacher_id, semester_code, group_code]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Esta materia ya está asignada a este profesor para este semestre/grupo' });
    }
    const [students] = await db.query(`SELECT matricula FROM students WHERE status = 'active'`);
    if (students.length === 0) {
      return res.status(400).json({ error: 'No hay estudiantes activos para asignar' });
    }
    for (const student of students) {
      await db.query(`
        INSERT INTO final_grades 
        (student_matricula, semester_code, subject_code, group_code, teacher_id, status)
        VALUES (?, ?, ?, ?, ?, 'in_progress')
      `, [student.matricula, semester_code, subject_code, group_code, teacher_id]);
    }
    res.json({ success: true, message: `Materia asignada a ${students.length} estudiantes` });
  } catch (error) {
    console.error('Error asignando materia:', error);
    res.status(500).json({ error: 'Error al asignar materia' });
  }
});

router.get('/asignaciones', async (req, res) => {
  try {
    const { teacher_id } = req.query;
    let query = `
      SELECT DISTINCT 
        fg.subject_code,
        m.subject_name,
        fg.semester_code,
        fg.group_code,
        COUNT(DISTINCT fg.student_matricula) as total_estudiantes,
        CONCAT(u.first_name, ' ', u.last_name) as teacher_name,
        fg.teacher_id
      FROM final_grades fg
      LEFT JOIN users u ON fg.teacher_id = u.id
      LEFT JOIN materias m ON fg.subject_code = m.subject_code
      WHERE 1=1
    `;
    const params = [];
    if (teacher_id) {
      query += ` AND fg.teacher_id = ?`;
      params.push(teacher_id);
    }
    query += ` GROUP BY fg.subject_code, m.subject_name, fg.semester_code, fg.group_code, u.first_name, u.last_name, fg.teacher_id
               ORDER BY fg.semester_code DESC, fg.subject_code`;
    const [asignaciones] = await db.query(query, params);
    res.json({ asignaciones });
  } catch (error) {
    console.error('Error obteniendo asignaciones:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ============================================
// ENDPOINTS PARA CALIFICACIONES (necesarios para admin)
// ============================================
router.get('/subjects', async (req, res) => {
  try {
    const [subjects] = await db.query(`
      SELECT DISTINCT 
        fg.subject_code,
        fg.teacher_id,
        COUNT(DISTINCT fg.student_matricula) as total_estudiantes,
        COUNT(DISTINCT fg.teacher_id) as total_maestros
      FROM final_grades fg
      GROUP BY fg.subject_code, fg.teacher_id
      ORDER BY fg.subject_code
    `);
    res.json({ subjects });
  } catch (error) {
    console.error('Error obteniendo materias:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.get('/subject-groups', async (req, res) => {
  try {
    const { subjectCode, semester, teacherId } = req.query;
    if (!subjectCode) {
      return res.status(400).json({ error: 'Subject code requerido' });
    }
    let query = `
      SELECT DISTINCT 
        fg.group_code,
        COUNT(DISTINCT fg.student_matricula) as total_students,
        CONCAT(u.first_name, ' ', u.last_name) as teacher_name,
        fg.teacher_id
      FROM final_grades fg
      LEFT JOIN users u ON fg.teacher_id = u.id
      WHERE fg.subject_code = ?
    `;
    const params = [subjectCode];
    if (semester) {
      query += ` AND fg.semester_code = ?`;
      params.push(semester);
    }
    if (teacherId) {
      query += ` AND fg.teacher_id = ?`;
      params.push(teacherId);
    }
    query += ` AND fg.group_code IS NOT NULL
               GROUP BY fg.group_code, u.first_name, u.last_name, fg.teacher_id
               ORDER BY fg.group_code`;
    const [groups] = await db.query(query, params);
    res.json({ groups });
  } catch (error) {
    console.error('Error obteniendo grupos:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.get('/teachers', async (req, res) => {
  try {
    const [teachers] = await db.query(`
      SELECT id, username, first_name, last_name, email, role
      FROM users 
      WHERE role IN ('maestro', 'admin', 'director')
      AND status = 'active'
      AND is_active = 1
      ORDER BY first_name, last_name
    `);
    res.json({ teachers });
  } catch (error) {
    console.error('Error obteniendo maestros:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.get('/semesters', async (req, res) => {
  try {
    const [semesters] = await db.query(`
      SELECT DISTINCT semester_code
      FROM final_grades
      ORDER BY semester_code DESC
    `);
    res.json({ semesters: semesters.map(s => s.semester_code) });
  } catch (error) {
    console.error('Error obteniendo semestres:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ============================================
// ENDPOINTS PARA ESTUDIANTES
// ============================================
router.get('/students', async (req, res) => {
  try {
    const [students] = await db.query(`SELECT * FROM students ORDER BY created_at DESC`);
    res.json({ students });
  } catch (error) {
    console.error('Error obteniendo estudiantes:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.post('/students', async (req, res) => {
  try {
    const { matricula, firstName, lastName, email, password, dateOfBirth, phone, address, status } = req.body;
    const [existing] = await db.query('SELECT matricula FROM students WHERE matricula = ? OR email = ?', [matricula, email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Matrícula o email ya existe' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await db.query(`
      INSERT INTO students (matricula, first_name, last_name, email, password_hash, date_of_birth, phone, address, status, admission_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())
    `, [matricula, firstName, lastName, email, passwordHash, dateOfBirth, phone || null, address || null, status || 'active']);
    res.json({ success: true, message: 'Estudiante creado exitosamente' });
  } catch (error) {
    console.error('Error creando estudiante:', error);
    res.status(500).json({ error: 'Error al crear estudiante' });
  }
});

router.put('/students/:matricula', async (req, res) => {
  try {
    const { matricula } = req.params;
    const { firstName, lastName, email, password, dateOfBirth, phone, address, status } = req.body;
    let query = 'UPDATE students SET first_name = ?, last_name = ?, email = ?, date_of_birth = ?, phone = ?, address = ?, status = ?';
    const params = [firstName, lastName, email, dateOfBirth, phone || null, address || null, status];
    if (password && password.trim() !== '') {
      const passwordHash = await bcrypt.hash(password, 10);
      query += ', password_hash = ?';
      params.push(passwordHash);
    }
    query += ' WHERE matricula = ?';
    params.push(matricula);
    await db.query(query, params);
    res.json({ success: true, message: 'Estudiante actualizado' });
  } catch (error) {
    console.error('Error actualizando estudiante:', error);
    res.status(500).json({ error: 'Error al actualizar estudiante' });
  }
});

router.delete('/students/:matricula', async (req, res) => {
  try {
    const { matricula } = req.params;
    await db.query('UPDATE students SET status = "inactive" WHERE matricula = ?', [matricula]);
    res.json({ success: true, message: 'Estudiante desactivado' });
  } catch (error) {
    console.error('Error desactivando estudiante:', error);
    res.status(500).json({ error: 'Error al desactivar estudiante' });
  }
});

// ============================================
// ENDPOINTS PARA USUARIOS (staff)
// ============================================
router.get('/users', async (req, res) => {
  try {
    const [users] = await db.query(`SELECT id, username, first_name, last_name, email, role, is_active, phone, created_at FROM users ORDER BY created_at DESC`);
    res.json({ users });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { username, firstName, lastName, email, password, role, phone, isActive } = req.body;
    const [existing] = await db.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Usuario o email ya existe' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await db.query(`
      INSERT INTO users (username, first_name, last_name, email, password_hash, role, phone, is_active, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [username, firstName, lastName, email, passwordHash, role, phone || null, isActive !== false]);
    res.json({ success: true, message: 'Usuario creado' });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, firstName, lastName, email, password, role, phone, isActive } = req.body;
    let query = 'UPDATE users SET username = ?, first_name = ?, last_name = ?, email = ?, role = ?, phone = ?, is_active = ?';
    const params = [username, firstName, lastName, email, role, phone || null, isActive !== false];
    if (password && password.trim() !== '') {
      const passwordHash = await bcrypt.hash(password, 10);
      query += ', password_hash = ?';
      params.push(passwordHash);
    }
    query += ' WHERE id = ?';
    params.push(id);
    await db.query(query, params);
    res.json({ success: true, message: 'Usuario actualizado' });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE users SET is_active = FALSE, status = "inactive" WHERE id = ?', [id]);
    res.json({ success: true, message: 'Usuario desactivado' });
  } catch (error) {
    console.error('Error desactivando usuario:', error);
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
});

export default router;