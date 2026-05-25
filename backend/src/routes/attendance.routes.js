import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// GET /dates
router.get('/dates', async (req, res) => {
  try {
    let { teacherId, semester, subject, group } = req.query;
    if (!teacherId || !semester || !subject) return res.status(400).json({ error: 'Faltan parámetros' });
    
    let query = `
      SELECT id, DATE_FORMAT(class_date, '%Y-%m-%d') as class_date 
      FROM attendance_dates
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
    `;
    const params = [teacherId, semester, subject];
    if (group && group !== '') { query += ` AND group_code = ?`; params.push(group); }
    else query += ` AND group_code IS NULL`;
    query += ` ORDER BY class_date ASC`;

    const [dates] = await db.query(query, params);
    res.json({ dates });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// POST /dates
router.post('/dates', async (req, res) => {
  try {
    let { teacherId, semester, subject, group, date } = req.body;
    if (!teacherId || !semester || !subject || !date) return res.status(400).json({ error: 'Faltan parámetros' });
    const groupValue = group === '' ? null : group;

    await db.query(`
      INSERT INTO attendance_dates (teacher_id, semester_code, subject_code, group_code, class_date)
      VALUES (?, ?, ?, ?, ?)
    `, [teacherId, semester, subject, groupValue, date]);

    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Esa fecha ya está registrada.' });
    }
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /dates/:id
router.delete('/dates/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM attendance_dates WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// GET /records
router.get('/records', async (req, res) => {
  try {
    let { teacherId, semester, subject, group } = req.query;
    if (!teacherId || !semester || !subject) return res.status(400).json({ error: 'Faltan parámetros' });

    // 1. Obtener alumnos
    const [students] = await db.query(`
      SELECT matricula, first_name, last_name
      FROM students
      WHERE status = 'active'
      ORDER BY last_name, first_name
    `);

    // 2. Obtener fechas de la clase
    let qDates = `
      SELECT id, DATE_FORMAT(class_date, '%Y-%m-%d') as class_date 
      FROM attendance_dates
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ?
    `;
    const paramsDates = [teacherId, semester, subject];
    if (group && group !== '') { qDates += ` AND group_code = ?`; paramsDates.push(group); }
    else qDates += ` AND group_code IS NULL`;
    qDates += ` ORDER BY class_date ASC`;

    const [dates] = await db.query(qDates, paramsDates);
    if (dates.length === 0) return res.json({ dates: [], records: [] });

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
      row.percentage = dates.length > 0 ? ((attended / dates.length) * 100).toFixed(1) : 0;
      return row;
    });

    res.json({ dates, records: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// POST /records
router.post('/records', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { updates } = req.body; // updates: [{ matricula, dateId, isPresent }]
    if (!updates || !Array.isArray(updates)) {
      connection.release();
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    await connection.beginTransaction();
    for (const u of updates) {
      await connection.query(`
        INSERT INTO attendance_records (student_matricula, date_id, is_present)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE is_present = VALUES(is_present)
      `, [u.matricula, u.dateId, u.isPresent ? 1 : 0]);
    }
    await connection.commit();
    connection.release();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// GET /student
router.get('/student', async (req, res) => {
  try {
    const { matricula, subjectCode } = req.query;
    if (!matricula || !subjectCode) return res.status(400).json({ error: 'Parámetros incompletos' });

    // Obtener contexto (teacher, semester, group)
    const [context] = await db.query(`
      SELECT teacher_id, semester_code, group_code
      FROM final_grades
      WHERE student_matricula = ? AND subject_code = ?
      LIMIT 1
    `, [matricula, subjectCode]);

    if (context.length === 0) return res.json({ dates: [], summary: { total: 0, attended: 0, percentage: 0 } });

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
    if (dates.length === 0) return res.json({ dates: [], summary: { total: 0, attended: 0, percentage: 0 } });

    const dateIds = dates.map(d => d.id);
    const placeholders = dateIds.map(() => '?').join(',');

    // Obtener registros
    const [records] = await db.query(`
      SELECT date_id, is_present
      FROM attendance_records
      WHERE student_matricula = ? AND date_id IN (${placeholders})
    `, [matricula, ...dateIds]);

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
      percentage: dates.length > 0 ? ((attended / dates.length) * 100).toFixed(1) : 0
    };

    res.json({ dates: finalDates, summary });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
