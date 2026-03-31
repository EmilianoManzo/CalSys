import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../config/database.js';

const router = express.Router();

// ==================== ESTUDIANTES ====================

// Obtener todos los estudiantes
router.get('/students', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = 'SELECT * FROM students';
    let params = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY last_name, first_name';
    
    const [students] = await db.query(query, params);
    res.json({ students });

  } catch (error) {
    console.error('Error obteniendo estudiantes:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Crear estudiante
router.post('/students', async (req, res) => {
  try {
    const { matricula, firstName, lastName, email, password, dateOfBirth, phone, address } = req.body;

    if (!matricula || !firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Verificar que no exista
    const [existing] = await db.query('SELECT matricula FROM students WHERE matricula = ?', [matricula]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'La matrícula ya existe' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.query(`
      INSERT INTO students 
      (matricula, first_name, last_name, email, password_hash, date_of_birth, phone, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [matricula, firstName, lastName, email, passwordHash, dateOfBirth || null, phone || null, address || null]);

    res.json({ success: true, message: 'Estudiante creado exitosamente' });

  } catch (error) {
    console.error('Error creando estudiante:', error);
    res.status(500).json({ error: 'Error al crear estudiante' });
  }
});

// Actualizar estudiante
router.put('/students/:matricula', async (req, res) => {
  try {
    const { matricula } = req.params;
    const { firstName, lastName, email, phone, address, status, password } = req.body;

    let query = `
      UPDATE students 
      SET first_name = ?, last_name = ?, email = ?, phone = ?, address = ?, status = ?
    `;
    let params = [firstName, lastName, email, phone, address, status];

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      query += ', password_hash = ?';
      params.push(passwordHash);
    }

    query += ' WHERE matricula = ?';
    params.push(matricula);

    await db.query(query, params);

    res.json({ success: true, message: 'Estudiante actualizado exitosamente' });

  } catch (error) {
    console.error('Error actualizando estudiante:', error);
    res.status(500).json({ error: 'Error al actualizar estudiante' });
  }
});

// Eliminar estudiante (soft delete)
router.delete('/students/:matricula', async (req, res) => {
  try {
    const { matricula } = req.params;

    await db.query('UPDATE students SET status = ? WHERE matricula = ?', ['inactive', matricula]);

    res.json({ success: true, message: 'Estudiante desactivado exitosamente' });

  } catch (error) {
    console.error('Error eliminando estudiante:', error);
    res.status(500).json({ error: 'Error al eliminar estudiante' });
  }
});

// ==================== USUARIOS (STAFF) ====================

// Obtener todos los usuarios
router.get('/users', async (req, res) => {
  try {
    const { role } = req.query;
    
    let query = 'SELECT id, username, first_name, last_name, email, role, phone, is_active FROM users';
    let params = [];
    
    if (role) {
      query += ' WHERE role = ?';
      params.push(role);
    }
    
    query += ' ORDER BY last_name, first_name';
    
    const [users] = await db.query(query, params);
    res.json({ users });

  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Crear usuario
router.post('/users', async (req, res) => {
  try {
    const { username, firstName, lastName, email, password, role, phone } = req.body;

    if (!username || !firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Verificar que no exista
    const [existing] = await db.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'El usuario o email ya existe' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.query(`
      INSERT INTO users 
      (username, password_hash, first_name, last_name, email, role, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [username, passwordHash, firstName, lastName, email, role, phone || null]);

    res.json({ success: true, message: 'Usuario creado exitosamente' });

  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// Actualizar usuario
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, role, isActive, password } = req.body;

    let query = `
      UPDATE users 
      SET first_name = ?, last_name = ?, email = ?, phone = ?, role = ?, is_active = ?
    `;
    let params = [firstName, lastName, email, phone, role, isActive];

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      query += ', password_hash = ?';
      params.push(passwordHash);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await db.query(query, params);

    res.json({ success: true, message: 'Usuario actualizado exitosamente' });

  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// Eliminar usuario (soft delete)
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db.query('UPDATE users SET is_active = ? WHERE id = ?', [false, id]);

    res.json({ success: true, message: 'Usuario desactivado exitosamente' });

  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// ==================== ESTADÍSTICAS ====================

// Obtener estadísticas generales
router.get('/stats', async (req, res) => {
  try {
    // Total de estudiantes
    const [studentsCount] = await db.query(
      'SELECT COUNT(*) as total FROM students WHERE status = ?', 
      ['active']
    );

    // Total de maestros
    const [teachersCount] = await db.query(
      'SELECT COUNT(*) as total FROM users WHERE role = ? AND is_active = ?', 
      ['maestro', true]
    );

    // Estudiantes con promedio >= 9
    const [excellentStudents] = await db.query(`
      SELECT COUNT(DISTINCT student_matricula) as total 
      FROM final_grades 
      WHERE final_grade >= 9
    `);

    // Estudiantes con alguna materia reprobada
    const [failingStudents] = await db.query(`
      SELECT COUNT(DISTINCT student_matricula) as total 
      FROM final_grades 
      WHERE status = 'failed'
    `);

    // Promedio general de la institución
    const [avgGrade] = await db.query(`
      SELECT AVG(final_grade) as promedio 
      FROM final_grades 
      WHERE final_grade IS NOT NULL
    `);

    // Total de materias con calificaciones
    const [subjectsCount] = await db.query(`
      SELECT COUNT(DISTINCT CONCAT(semester_code, subject_code)) as total 
      FROM final_grades
    `);

    res.json({
      totalEstudiantes: studentsCount[0].total,
      totalMaestros: teachersCount[0].total,
      estudiantesExcelentes: excellentStudents[0].total,
      estudiantesReprobados: failingStudents[0].total,
      promedioGeneral: avgGrade[0].promedio || 0,
      totalMaterias: subjectsCount[0].total
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Obtener todas las calificaciones (con filtros)
router.get('/all-grades', async (req, res) => {
  try {
    const { semester, subject, group } = req.query;

    let query = `
      SELECT 
        s.matricula,
        CONCAT(s.first_name, ' ', s.last_name) as alumno,
        fg.semester_code,
        fg.subject_code,
        fg.group_code,
        CONCAT(u.first_name, ' ', u.last_name) as maestro,
        fg.final_grade,
        fg.status
      FROM final_grades fg
      JOIN students s ON fg.student_matricula = s.matricula
      LEFT JOIN users u ON fg.teacher_id = u.id
      WHERE 1=1
    `;
    
    let params = [];

    if (semester) {
      query += ' AND fg.semester_code = ?';
      params.push(semester);
    }

    if (subject) {
      query += ' AND fg.subject_code = ?';
      params.push(subject);
    }

    if (group) {
      query += ' AND fg.group_code = ?';
      params.push(group);
    }

    query += ' ORDER BY s.last_name, s.first_name, fg.semester_code DESC';

    const [grades] = await db.query(query, params);

    res.json({ grades });

  } catch (error) {
    console.error('Error obteniendo calificaciones:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

export default router;