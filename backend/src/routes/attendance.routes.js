import express from 'express';
import db from '../config/database.js';
import { sendServerError } from '../middleware/security.js';
import { validateId, validateMatricula, safeNumber, safeDivision } from '../utils/validation.js';
import { getEnrolledStudents } from '../utils/enrolledStudents.js';

const router = express.Router();
function allowRoles(req, res, roles) {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403).json({ error: 'Acceso no autorizado' });
    return false;
  }
  return true;
}

// GET /dates
router.get('/dates', async (req, res) => {
  try {
    if (!allowRoles(req, res, ['admin', 'director', 'maestro'])) return;
    let { teacherId, semester, subject, group } = req.query;
    if (!teacherId || !semester || !subject) return res.status(400).json({ error: 'Faltan parámetros' });
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');
    
    let query = `
      SELECT id, DATE_FORMAT(class_date, '%Y-%m-%d') as class_date 
      FROM attendance_dates
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
    `;
    const params = [validatedTeacherId, semester, subject];
    if (group && group !== '') { query += ` AND group_code = ?`; params.push(group); }
    else query += ` AND group_code IS NULL`;
    query += ` ORDER BY class_date ASC`;

    const [dates] = await db.query(query, params);
    res.json({ dates: dates || [] });
  } catch (error) {
    console.error('Error obteniendo fechas:', error);
    sendServerError(res);
  }
});

// POST /dates
router.post('/dates', async (req, res) => {
  try {
    if (!allowRoles(req, res, ['admin', 'director', 'maestro'])) return;
    let { teacherId, semester, subject, group, date } = req.body;
    if (!teacherId || !semester || !subject || !date) return res.status(400).json({ error: 'Faltan parámetros' });
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');
    const groupValue = group === '' ? null : group;

    await db.query(`
      INSERT INTO attendance_dates (teacher_id, semester_code, subject_code, group_code, class_date)
      VALUES (?, ?, ?, ?, ?)
    `, [validatedTeacherId, semester, subject, groupValue, date]);

    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Esa fecha ya está registrada.' });
    }
    console.error('Error agregando fecha:', error);
    sendServerError(res, 'Error al agregar fecha');
  }
});

// DELETE /dates/:id
router.delete('/dates/:id', async (req, res) => {
  try {
    if (!allowRoles(req, res, ['admin', 'director', 'maestro'])) return;
    const validatedId = validateId(req.params.id, 'ID de fecha');
    await db.query(`DELETE FROM attendance_dates WHERE id = ?`, [validatedId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando fecha:', error);
    sendServerError(res, 'Error al eliminar fecha');
  }
});

// GET /records
router.get('/records', async (req, res) => {
  try {
    if (!allowRoles(req, res, ['admin', 'director', 'maestro'])) return;
    let { teacherId, semester, subject, group } = req.query;
    if (!teacherId || !semester || !subject) return res.status(400).json({ error: 'Faltan parámetros' });
    const validatedTeacherId = validateId(teacherId, 'Teacher ID');

    const groupCode = group && group !== '' ? group : null;
    const students = await getEnrolledStudents(db, {
      teacherId: validatedTeacherId,
      semester,
      subject,
      groupCode
    });

    // 2. Obtener fechas de la clase
    let qDates = `
      SELECT id, DATE_FORMAT(class_date, '%Y-%m-%d') as class_date 
      FROM attendance_dates
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
    `;
    const paramsDates = [validatedTeacherId, semester, subject];
    if (group && group !== '') { qDates += ` AND group_code = ?`; paramsDates.push(group); }
    else qDates += ` AND group_code IS NULL`;
    qDates += ` ORDER BY class_date ASC`;

    const [dates] = await db.query(qDates, paramsDates);
    if (!dates || dates.length === 0) return res.json({ dates: [], records: [] });

    // 3. Obtener registros
    const dateIds = dates.map(d => d.id);
    const placeholders = dateIds.map(() => '?').join(',');
    const [recordsData] = await db.query(`
      SELECT student_matricula, date_id, is_present
      FROM attendance_records
      WHERE date_id IN (${placeholders})
    `, [...dateIds]);

    // Formatear
    const result = students.map(s => {
      const row = { matricula: s.matricula, nombre: `${s.first_name} ${s.last_name}` };
      let attended = 0;
      dates.forEach(d => {
        const r = recordsData.find(x => x.student_matricula === s.matricula && x.date_id === d.id);
        row[`date_${d.id}`] = r ? r.is_present : null;
        if (r && r.is_present) attended++;
      });
      row.total_attended = attended;
      row.total_classes = dates.length;
      row.percentage = dates.length > 0 ? safeDivision((attended / dates.length) * 100, 1, 0) : 0;
      return row;
    });

    res.json({ dates: dates || [], records: result || [] });
  } catch (error) {
    console.error('Error obteniendo registros:', error);
    sendServerError(res);
  }
});

// POST /records
router.post('/records', async (req, res) => {
  const connection = await db.getConnection();
  try {
    if (!allowRoles(req, res, ['admin', 'director', 'maestro'])) {
      connection.release();
      return;
    }
    const { updates } = req.body; // updates: [{ matricula, dateId, isPresent }]
    if (!updates || !Array.isArray(updates)) {
      connection.release();
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    await connection.beginTransaction();
    for (const u of updates) {
      if (!u.matricula || !u.dateId) continue;
      const validatedMatricula = validateMatricula(u.matricula);
      const validatedDateId = validateId(u.dateId, 'ID de fecha');
      const isPresent = u.isPresent ? 1 : 0;
      await connection.query(`
        INSERT INTO attendance_records (student_matricula, date_id, is_present)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE is_present = VALUES(is_present)
      `, [validatedMatricula, validatedDateId, isPresent]);
    }
    await connection.commit();
    connection.release();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error guardando registros:', error);
    sendServerError(res, 'Error al guardar registros');
  }
});

// GET /student
router.get('/student', async (req, res) => {
  try {
    if (!allowRoles(req, res, ['admin', 'director', 'alumno'])) return;
    const { matricula, subjectCode } = req.query;
    if (!matricula || !subjectCode) return res.status(400).json({ error: 'Parámetros incompletos' });
    const validatedMatricula = validateMatricula(matricula);

    // Obtener contexto (teacher, semester, group)
    const [context] = await db.query(`
      SELECT teacher_id, semester_code, group_code
      FROM final_grades
      WHERE student_matricula = ? AND subject_code = ?
      LIMIT 1
    `, [validatedMatricula, subjectCode]);

    if (!context || context.length === 0) return res.json({ dates: [], summary: { total: 0, attended: 0, percentage: 0 } });

    const { teacher_id, semester_code, group_code } = context[0];

    // Obtener fechas
    let qDates = `
      SELECT id, DATE_FORMAT(class_date, '%Y-%m-%d') as class_date 
      FROM attendance_dates
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
    `;
    const paramsDates = [teacher_id, semester_code, subjectCode];
    if (group_code) { qDates += ` AND group_code = ?`; paramsDates.push(group_code); }
    else qDates += ` AND group_code IS NULL`;
    qDates += ` ORDER BY class_date ASC`;

    const [dates] = await db.query(qDates, paramsDates);
    if (!dates || dates.length === 0) return res.json({ dates: [], summary: { total: 0, attended: 0, percentage: 0 } });

    const dateIds = dates.map(d => d.id);
    const placeholders = dateIds.map(() => '?').join(',');

    // Obtener registros
    const [records] = await db.query(`
      SELECT date_id, is_present
      FROM attendance_records
      WHERE student_matricula = ? AND date_id IN (${placeholders})
    `, [validatedMatricula, ...dateIds]);

    const recordsMap = {};
    records.forEach(r => { recordsMap[r.date_id] = r.is_present; });

    let attended = 0;
    const finalDates = dates.map(d => {
      const present = recordsMap[d.id] !== undefined ? recordsMap[d.id] : null;
      if (present) attended++;
      return {
        id: d.id,
        date: d.class_date,
        present: present
      };
    });

    const summary = {
      total: dates.length,
      attended,
      percentage: dates.length > 0 ? safeDivision((attended / dates.length) * 100, 1, 0) : 0
    };

    res.json({ dates: finalDates || [], summary });
  } catch (error) {
    console.error('Error obteniendo asistencia del estudiante:', error);
    sendServerError(res);
  }
});

export default router;
