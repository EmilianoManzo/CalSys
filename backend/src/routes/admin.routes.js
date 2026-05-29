import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../config/database.js';
import { validateId, validateMatricula, validateEmail, validateNonEmptyString, safeNumber, safeAverage } from '../utils/validation.js';
import { deleteAsignacion, deleteAllSubjectData, deleteStudentRecords, deleteTeacherRecords } from '../utils/deleteAssignment.js';

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
    const average = safeNumber(avgResult[0]?.promedio, 0);

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
      const prom = safeNumber(row.promedio_final);
      if (prom !== null && prom >= 6) passed++;
      else if (prom !== null && prom < 6) failed++;
    }
    const totalStudentsCount = safeNumber(totalStudents[0]?.total, 0);
    let inProgress = totalStudentsCount - (passed + failed);
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
      students: safeNumber(totalStudents[0]?.total, 0),
      teachers: safeNumber(totalTeachers[0]?.total, 0),
      subjects: safeNumber(totalSubjects[0]?.total, 0),
      grades: safeNumber(totalGrades[0]?.total, 0),
      average: average,
      passed: passed,
      failed: failed,
      inProgress: inProgress,
      subjectStats: subjectStats || []
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: error.message || 'Error en el servidor' });
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
    res.json({ materias: materias || [] });
  } catch (error) {
    console.error('Error obteniendo materias:', error);
    res.status(500).json({ error: error.message || 'Error en el servidor' });
  }
});

router.post('/materias', async (req, res) => {
  try {
    const { subject_code, subject_name, credits, description } = req.body;
    if (!subject_code || !subject_name) {
      return res.status(400).json({ error: 'Código y nombre son requeridos' });
    }
    const validatedCode = validateNonEmptyString(subject_code, 'Código');
    const validatedName = validateNonEmptyString(subject_name, 'Nombre');
    const validatedCredits = safeNumber(credits, 5);
    
    const [existing] = await db.query('SELECT id FROM materias WHERE subject_code = ?', [validatedCode.toUpperCase()]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'La materia ya existe' });
    }
    await db.query(`
      INSERT INTO materias (subject_code, subject_name, credits, description)
      VALUES (?, ?, ?, ?)
    `, [validatedCode.toUpperCase(), validatedName, validatedCredits, description || null]);
    res.json({ success: true, message: 'Materia creada exitosamente' });
  } catch (error) {
    console.error('Error creando materia:', error);
    res.status(500).json({ error: error.message || 'Error al crear materia' });
  }
});

router.put('/materias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedId = validateId(id, 'ID de materia');
    const { subject_name, credits, description } = req.body;
    const validatedName = validateNonEmptyString(subject_name, 'Nombre');
    const validatedCredits = safeNumber(credits, 5);
    
    await db.query(`
      UPDATE materias 
      SET subject_name = ?, credits = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [validatedName, validatedCredits, description, validatedId]);
    res.json({ success: true, message: 'Materia actualizada' });
  } catch (error) {
    console.error('Error actualizando materia:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar materia' });
  }
});

router.delete('/materias/:id', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const validatedId = validateId(req.params.id, 'ID de materia');
    const [materia] = await connection.query('SELECT subject_code FROM materias WHERE id = ?', [validatedId]);
    if (!materia || materia.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Materia no encontrada' });
    }
    const subjectCode = materia[0].subject_code;
    await connection.beginTransaction();
    await deleteAllSubjectData(connection, subjectCode);
    await connection.query('DELETE FROM materias WHERE id = ?', [validatedId]);
    await connection.commit();
    connection.release();
    res.json({ success: true, message: 'Materia y todas sus asignaciones eliminadas' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error eliminando materia:', error);
    res.status(500).json({ error: error.message || 'Error al eliminar materia' });
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
    res.json({ profesores: profesores || [] });
  } catch (error) {
    console.error('Error obteniendo profesores:', error);
    res.status(500).json({ error: error.message || 'Error en el servidor' });
  }
});

router.get('/grupos', async (req, res) => {
  try {
    const [grupos] = await db.query(`
      SELECT group_code
      FROM student_groups
      WHERE is_active = 1
      ORDER BY group_code
    `);
    res.json({ grupos: grupos ? grupos.map(g => g.group_code) : [] });
  } catch (error) {
    console.error('Error obteniendo grupos:', error);
    res.status(500).json({ error: error.message || 'Error en el servidor' });
  }
});

// ============================================
// ENDPOINTS PARA GRUPOS DE ESTUDIANTES
// ============================================
router.get('/student-groups', async (req, res) => {
  try {
    const [groups] = await db.query(`
      SELECT sg.id, sg.group_code, sg.name, sg.description, sg.is_active, sg.created_at,
        COUNT(CASE WHEN s.status = 'active' THEN s.matricula END) AS member_count
      FROM student_groups sg
      LEFT JOIN students s ON s.group_id = sg.id
      GROUP BY sg.id
      ORDER BY sg.group_code
    `);
    res.json({ groups: groups || [] });
  } catch (error) {
    console.error('Error obteniendo grupos de estudiantes:', error);
    res.status(500).json({ error: error.message || 'Error en el servidor' });
  }
});

router.post('/student-groups', async (req, res) => {
  try {
    const { groupCode, name, description } = req.body;
    const validatedCode = validateNonEmptyString(groupCode, 'Código de grupo').toUpperCase();
    const validatedName = validateNonEmptyString(name, 'Nombre');
    const [existing] = await db.query('SELECT id FROM student_groups WHERE group_code = ?', [validatedCode]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'El código de grupo ya existe' });
    }
    const [result] = await db.query(
      `INSERT INTO student_groups (group_code, name, description) VALUES (?, ?, ?)`,
      [validatedCode, validatedName, description || null]
    );
    res.json({ success: true, id: result.insertId, message: 'Grupo creado' });
  } catch (error) {
    console.error('Error creando grupo:', error);
    res.status(500).json({ error: error.message || 'Error al crear grupo' });
  }
});

router.put('/student-groups/:id', async (req, res) => {
  try {
    const validatedId = validateId(req.params.id, 'ID de grupo');
    const { name, description, isActive } = req.body;
    const validatedName = validateNonEmptyString(name, 'Nombre');
    await db.query(
      `UPDATE student_groups SET name = ?, description = ?, is_active = ? WHERE id = ?`,
      [validatedName, description || null, isActive !== false ? 1 : 0, validatedId]
    );
    if (isActive === false) {
      await db.query('UPDATE students SET group_id = NULL WHERE group_id = ?', [validatedId]);
    }
    res.json({ success: true, message: 'Grupo actualizado' });
  } catch (error) {
    console.error('Error actualizando grupo:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar grupo' });
  }
});

router.delete('/student-groups/:id', async (req, res) => {
  try {
    const validatedId = validateId(req.params.id, 'ID de grupo');
    await db.query('UPDATE students SET group_id = NULL WHERE group_id = ?', [validatedId]);
    await db.query('UPDATE student_groups SET is_active = 0 WHERE id = ?', [validatedId]);
    res.json({ success: true, message: 'Grupo desactivado' });
  } catch (error) {
    console.error('Error desactivando grupo:', error);
    res.status(500).json({ error: error.message || 'Error al desactivar grupo' });
  }
});

router.put('/student-groups/:id/members', async (req, res) => {
  try {
    const validatedId = validateId(req.params.id, 'ID de grupo');
    const { matriculas } = req.body;
    if (!Array.isArray(matriculas)) {
      return res.status(400).json({ error: 'matriculas debe ser un arreglo' });
    }
    const [group] = await db.query('SELECT id FROM student_groups WHERE id = ? AND is_active = 1', [validatedId]);
    if (!group || group.length === 0) {
      return res.status(404).json({ error: 'Grupo no encontrado o inactivo' });
    }
    const validatedMatriculas = [];
    for (const m of matriculas) {
      if (m && String(m).trim()) validatedMatriculas.push(validateMatricula(String(m).trim()));
    }
    await db.query('UPDATE students SET group_id = NULL WHERE group_id = ?', [validatedId]);
    if (validatedMatriculas.length > 0) {
      const placeholders = validatedMatriculas.map(() => '?').join(',');
      await db.query(
        `UPDATE students SET group_id = ? WHERE matricula IN (${placeholders}) AND status = 'active'`,
        [validatedId, ...validatedMatriculas]
      );
    }
    res.json({ success: true, message: `Grupo actualizado con ${validatedMatriculas.length} alumnos` });
  } catch (error) {
    console.error('Error asignando miembros:', error);
    res.status(500).json({ error: error.message || 'Error al asignar miembros' });
  }
});

async function resolveGroupId(groupId) {
  if (groupId === null || groupId === undefined || groupId === '') return null;
  const validatedId = validateId(groupId, 'ID de grupo');
  const [rows] = await db.query('SELECT id FROM student_groups WHERE id = ? AND is_active = 1', [validatedId]);
  if (!rows || rows.length === 0) throw new Error('Grupo no encontrado o inactivo');
  return validatedId;
}

router.post('/asignar-materia', async (req, res) => {
  try {
    const { subject_code, teacher_id, semester_code, group_code } = req.body;
    if (!subject_code || !teacher_id || !semester_code) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }
    const validatedTeacherId = validateId(teacher_id, 'Teacher ID');
    
    const [materia] = await db.query('SELECT subject_code FROM materias WHERE subject_code = ?', [subject_code]);
    if (!materia || materia.length === 0) {
      return res.status(400).json({ error: 'La materia no existe en el catálogo' });
    }
    const [existing] = await db.query(`
      SELECT id FROM final_grades 
      WHERE subject_code = ? AND teacher_id = ? AND semester_code = ? AND group_code = ?
      LIMIT 1
    `, [subject_code, validatedTeacherId, semester_code, group_code]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Esta materia ya está asignada a este profesor para este semestre/grupo' });
    }
    const gc = group_code && String(group_code).trim() !== '' ? String(group_code).trim() : null;
    let students;
    if (gc) {
      [students] = await db.query(`
        SELECT s.matricula FROM students s
        INNER JOIN student_groups g ON s.group_id = g.id
        WHERE s.status = 'active' AND g.group_code = ? AND g.is_active = 1
      `, [gc]);
      if (!students || students.length === 0) {
        return res.status(400).json({ error: `No hay estudiantes activos en el grupo "${gc}"` });
      }
    } else {
      [students] = await db.query(`
        SELECT matricula FROM students WHERE status = 'active' AND group_id IS NULL
      `);
      if (!students || students.length === 0) {
        return res.status(400).json({ error: 'No hay estudiantes activos sin grupo asignado' });
      }
    }
    for (const student of students) {
      await db.query(`
        INSERT INTO final_grades 
        (student_matricula, semester_code, subject_code, group_code, teacher_id, status)
        VALUES (?, ?, ?, ?, ?, 'in_progress')
      `, [student.matricula, semester_code, subject_code, group_code, validatedTeacherId]);
    }
    res.json({ success: true, message: `Materia asignada a ${students.length} estudiantes` });
  } catch (error) {
    console.error('Error asignando materia:', error);
    res.status(500).json({ error: error.message || 'Error al asignar materia' });
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

router.delete('/asignaciones', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { subject_code, teacher_id, semester_code, group_code } = req.query;
    if (!subject_code || !teacher_id || !semester_code) {
      connection.release();
      return res.status(400).json({ error: 'Faltan subject_code, teacher_id o semester_code' });
    }
    const validatedTeacherId = validateId(teacher_id, 'Teacher ID');
    const validatedSubject = validateNonEmptyString(subject_code, 'Código de materia');
    const validatedSemester = validateNonEmptyString(semester_code, 'Semestre');

    await connection.beginTransaction();
    await deleteAsignacion(connection, {
      subjectCode: validatedSubject,
      teacherId: validatedTeacherId,
      semesterCode: validatedSemester,
      groupCode: group_code
    });
    await connection.commit();
    connection.release();
    res.json({ success: true, message: 'Asignación eliminada' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error eliminando asignación:', error);
    res.status(500).json({ error: error.message || 'Error al eliminar asignación' });
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
    const [students] = await db.query(`
      SELECT s.*, s.group_id, g.group_code, g.name AS group_name
      FROM students s
      LEFT JOIN student_groups g ON s.group_id = g.id
      ORDER BY s.created_at DESC
    `);
    res.json({ students: students || [] });
  } catch (error) {
    console.error('Error obteniendo estudiantes:', error);
    res.status(500).json({ error: error.message || 'Error en el servidor' });
  }
});

router.post('/students', async (req, res) => {
  try {
    const { matricula, firstName, lastName, email, password, dateOfBirth, phone, address, status, groupId } = req.body;
    const validatedMatricula = validateMatricula(matricula);
    const validatedEmail = validateEmail(email);
    const validatedFirstName = validateNonEmptyString(firstName, 'Nombre');
    const validatedLastName = validateNonEmptyString(lastName, 'Apellido');
    const resolvedGroupId = groupId ? await resolveGroupId(groupId) : null;
    
    const [existing] = await db.query('SELECT matricula FROM students WHERE matricula = ? OR email = ?', [validatedMatricula, validatedEmail]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Matrícula o email ya existe' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await db.query(`
      INSERT INTO students (matricula, first_name, last_name, email, password_hash, date_of_birth, phone, address, status, admission_date, group_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?)
    `, [validatedMatricula, validatedFirstName, validatedLastName, validatedEmail, passwordHash, dateOfBirth, phone || null, address || null, status || 'active', resolvedGroupId]);
    res.json({ success: true, message: 'Estudiante creado exitosamente' });
  } catch (error) {
    console.error('Error creando estudiante:', error);
    res.status(500).json({ error: error.message || 'Error al crear estudiante' });
  }
});

router.put('/students/:matricula', async (req, res) => {
  try {
    const { matricula } = req.params;
    const validatedMatricula = validateMatricula(matricula);
    const { firstName, lastName, email, password, dateOfBirth, phone, address, status, groupId } = req.body;
    
    const validatedFirstName = validateNonEmptyString(firstName, 'Nombre');
    const validatedLastName = validateNonEmptyString(lastName, 'Apellido');
    const validatedEmail = validateEmail(email);
    const resolvedGroupId = groupId === null || groupId === '' || groupId === undefined
      ? null
      : await resolveGroupId(groupId);
    
    let query = 'UPDATE students SET first_name = ?, last_name = ?, email = ?, date_of_birth = ?, phone = ?, address = ?, status = ?, group_id = ?';
    const params = [validatedFirstName, validatedLastName, validatedEmail, dateOfBirth, phone || null, address || null, status, resolvedGroupId];
    if (password && password.trim() !== '') {
      const passwordHash = await bcrypt.hash(password, 10);
      query += ', password_hash = ?';
      params.push(passwordHash);
    }
    query += ' WHERE matricula = ?';
    params.push(validatedMatricula);
    await db.query(query, params);
    res.json({ success: true, message: 'Estudiante actualizado' });
  } catch (error) {
    console.error('Error actualizando estudiante:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar estudiante' });
  }
});

router.delete('/students/:matricula', async (req, res) => {
  const permanent = req.query.permanent === 'true';
  try {
    const validatedMatricula = validateMatricula(req.params.matricula);
    const [existing] = await db.query('SELECT matricula FROM students WHERE matricula = ?', [validatedMatricula]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    if (!permanent) {
      await db.query('UPDATE students SET status = "inactive" WHERE matricula = ?', [validatedMatricula]);
      return res.json({ success: true, message: 'Estudiante desactivado' });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await deleteStudentRecords(connection, validatedMatricula);
      await connection.query('DELETE FROM students WHERE matricula = ?', [validatedMatricula]);
      await connection.commit();
      connection.release();
      res.json({ success: true, message: 'Estudiante eliminado permanentemente' });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (error) {
    console.error('Error eliminando estudiante:', error);
    res.status(500).json({ error: error.message || 'Error al eliminar estudiante' });
  }
});

// ============================================
// ENDPOINTS PARA USUARIOS (staff)
// ============================================
router.get('/users', async (req, res) => {
  try {
    const [users] = await db.query(`SELECT id, username, first_name, last_name, email, role, is_active, phone, created_at FROM users ORDER BY created_at DESC`);
    res.json({ users: users || [] });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: error.message || 'Error en el servidor' });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { username, firstName, lastName, email, password, role, phone, isActive } = req.body;
    const validatedUsername = validateNonEmptyString(username, 'Usuario');
    const validatedEmail = validateEmail(email);
    const validatedFirstName = validateNonEmptyString(firstName, 'Nombre');
    const validatedLastName = validateNonEmptyString(lastName, 'Apellido');
    
    const [existing] = await db.query('SELECT id FROM users WHERE username = ? OR email = ?', [validatedUsername, validatedEmail]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Usuario o email ya existe' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await db.query(`
      INSERT INTO users (username, first_name, last_name, email, password_hash, role, phone, is_active, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [validatedUsername, validatedFirstName, validatedLastName, validatedEmail, passwordHash, role, phone || null, isActive !== false]);
    res.json({ success: true, message: 'Usuario creado' });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ error: error.message || 'Error al crear usuario' });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedId = validateId(id, 'ID de usuario');
    const { username, firstName, lastName, email, password, role, phone, isActive } = req.body;
    
    const validatedUsername = validateNonEmptyString(username, 'Usuario');
    const validatedEmail = validateEmail(email);
    const validatedFirstName = validateNonEmptyString(firstName, 'Nombre');
    const validatedLastName = validateNonEmptyString(lastName, 'Apellido');
    
    let query = 'UPDATE users SET username = ?, first_name = ?, last_name = ?, email = ?, role = ?, phone = ?, is_active = ?';
    const params = [validatedUsername, validatedFirstName, validatedLastName, validatedEmail, role, phone || null, isActive !== false];
    if (password && password.trim() !== '') {
      const passwordHash = await bcrypt.hash(password, 10);
      query += ', password_hash = ?';
      params.push(passwordHash);
    }
    query += ' WHERE id = ?';
    params.push(validatedId);
    await db.query(query, params);
    res.json({ success: true, message: 'Usuario actualizado' });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar usuario' });
  }
});

router.delete('/users/:id', async (req, res) => {
  const permanent = req.query.permanent === 'true';
  try {
    const validatedId = validateId(req.params.id, 'ID de usuario');
    const [user] = await db.query('SELECT id, role FROM users WHERE id = ?', [validatedId]);
    if (!user || user.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (user[0].role === 'admin') {
      return res.status(400).json({ error: 'No se puede eliminar un usuario administrador desde aquí' });
    }

    if (!permanent) {
      await db.query('UPDATE users SET is_active = FALSE, status = "inactive" WHERE id = ?', [validatedId]);
      return res.json({ success: true, message: 'Usuario desactivado' });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await deleteTeacherRecords(connection, validatedId);
      await connection.query('DELETE FROM users WHERE id = ?', [validatedId]);
      await connection.commit();
      connection.release();
      res.json({ success: true, message: 'Usuario eliminado permanentemente' });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ error: error.message || 'Error al eliminar usuario' });
  }
});

export default router;