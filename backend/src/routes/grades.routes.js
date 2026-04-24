import express from 'express';
import db from '../config/database.js';

const router = express.Router();

router.get('/teacher/subjects', async (req, res) => {
  try {
    const { teacherId, semester } = req.query;
    if (!teacherId) return res.status(400).json({ error: 'Teacher ID requerido' });
    let query = `
      SELECT DISTINCT subject_code, semester_code, group_code, COUNT(*) as total_students
      FROM final_grades
      WHERE teacher_id = ?
    `;
    const params = [teacherId];
    if (semester) {
      query += ` AND semester_code = ?`;
      params.push(semester);
    }
    query += ` GROUP BY subject_code, semester_code, group_code ORDER BY subject_code`;
    const [subjects] = await db.query(query, params);
    res.json({ subjects });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.get('/subject/groups', async (req, res) => {
  try {
    const { teacherId, semester, subjectCode } = req.query;
    if (!teacherId || !semester || !subjectCode) {
      return res.status(400).json({ error: 'Parámetros incompletos' });
    }
    const [groups] = await db.query(`
      SELECT DISTINCT group_code, COUNT(*) as total_students
      FROM final_grades
      WHERE teacher_id = ? AND semester_code = ? AND subject_code = ? AND group_code IS NOT NULL
      GROUP BY group_code
    `, [teacherId, semester, subjectCode]);
    res.json({ groups });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

export default router;