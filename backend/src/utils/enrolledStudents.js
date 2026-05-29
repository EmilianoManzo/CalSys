/**
 * Returns students enrolled in a teacher's class context (final_grades).
 * groupCode: string or null/empty for "sin grupo" (NULL group_code rows).
 */
export async function getEnrolledStudents(db, { teacherId, semester, subject, groupCode }) {
  const group = groupCode && String(groupCode).trim() !== '' ? groupCode : null;
  const [students] = await db.query(
    `SELECT DISTINCT s.matricula, s.first_name, s.last_name
     FROM students s
     INNER JOIN final_grades fg ON fg.student_matricula = s.matricula
     WHERE s.status = 'active'
       AND fg.teacher_id = ?
       AND fg.semester_code = ?
       AND fg.subject_code = ?
       AND (fg.group_code <=> ?)
     ORDER BY s.last_name, s.first_name`,
    [teacherId, semester, subject, group]
  );
  return students || [];
}

/**
 * Returns matriculas only (for bulk save loops).
 */
export async function getEnrolledMatriculas(db, { teacherId, semester, subject, groupCode }) {
  const students = await getEnrolledStudents(db, { teacherId, semester, subject, groupCode });
  return students.map((s) => s.matricula);
}
