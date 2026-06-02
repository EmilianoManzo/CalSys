function normalizeGroupCode(groupCode) {
  return groupCode && String(groupCode).trim() !== '' ? String(groupCode).trim() : null;
}

/**
 * Deletes one teacher assignment (subject + semester + group) and related grade/attendance data.
 */
export async function deleteAsignacion(conn, { subjectCode, teacherId, semesterCode, groupCode }) {
  const group = normalizeGroupCode(groupCode);

  const [grades] = await conn.query(
    `SELECT id FROM final_grades
     WHERE subject_code = ? AND teacher_id = ? AND semester_code = ? AND (group_code <=> ?)`,
    [subjectCode, teacherId, semesterCode, group]
  );

  const gradeIds = (grades || []).map((g) => g.id);
  if (gradeIds.length > 0) {
    const ph = gradeIds.map(() => '?').join(',');
    await conn.query(`DELETE FROM grade_custom_values WHERE grade_id IN (${ph})`, gradeIds);
  }

  await conn.query(
    `DELETE FROM final_grades
     WHERE subject_code = ? AND teacher_id = ? AND semester_code = ? AND (group_code <=> ?)`,
    [subjectCode, teacherId, semesterCode, group]
  );

  await conn.query(
    `DELETE FROM partial_grades
     WHERE subject_code = ? AND teacher_id = ? AND semester_code = ? AND (group_code <=> ?)`,
    [subjectCode, teacherId, semesterCode, group]
  );

  await conn.query(
    `DELETE FROM partial_columns_config
     WHERE subject_code = ? AND teacher_id = ? AND semester_code = ? AND (group_code <=> ?)`,
    [subjectCode, teacherId, semesterCode, group]
  );

  await conn.query(
    `DELETE FROM grade_columns_config
     WHERE subject_code = ? AND teacher_id = ? AND semester_code = ? AND (group_code <=> ?)`,
    [subjectCode, teacherId, semesterCode, group]
  );

  const [dates] = await conn.query(
    `SELECT id FROM attendance_dates
     WHERE teacher_id = ? AND semester_code = ? AND subject_code = ? AND (group_code <=> ?)`,
    [teacherId, semesterCode, subjectCode, group]
  );

  if (dates && dates.length > 0) {
    const dateIds = dates.map((d) => d.id);
    const ph = dateIds.map(() => '?').join(',');
    await conn.query(`DELETE FROM attendance_records WHERE date_id IN (${ph})`, dateIds);
    await conn.query(`DELETE FROM attendance_dates WHERE id IN (${ph})`, dateIds);
  }
}

/**
 * Deletes all enrollment/grade data for a subject across teachers (before removing catalog entry).
 */
export async function deleteAllSubjectData(conn, subjectCode) {
  const [grades] = await conn.query('SELECT id FROM final_grades WHERE subject_code = ?', [subjectCode]);
  const gradeIds = (grades || []).map((g) => g.id);
  if (gradeIds.length > 0) {
    const ph = gradeIds.map(() => '?').join(',');
    await conn.query(`DELETE FROM grade_custom_values WHERE grade_id IN (${ph})`, gradeIds);
  }

  await conn.query('DELETE FROM final_grades WHERE subject_code = ?', [subjectCode]);
  await conn.query('DELETE FROM partial_grades WHERE subject_code = ?', [subjectCode]);
  await conn.query('DELETE FROM partial_columns_config WHERE subject_code = ?', [subjectCode]);
  await conn.query('DELETE FROM grade_columns_config WHERE subject_code = ?', [subjectCode]);

  const [dates] = await conn.query('SELECT id FROM attendance_dates WHERE subject_code = ?', [subjectCode]);
  if (dates && dates.length > 0) {
    const dateIds = dates.map((d) => d.id);
    const ph = dateIds.map(() => '?').join(',');
    await conn.query(`DELETE FROM attendance_records WHERE date_id IN (${ph})`, dateIds);
    await conn.query(`DELETE FROM attendance_dates WHERE id IN (${ph})`, dateIds);
  }
}

/**
 * Removes all grade/attendance rows for one student (before deleting the student row).
 */
export async function deleteStudentRecords(conn, matricula) {
  const [grades] = await conn.query('SELECT id FROM final_grades WHERE student_matricula = ?', [matricula]);
  const gradeIds = (grades || []).map((g) => g.id);
  if (gradeIds.length > 0) {
    const ph = gradeIds.map(() => '?').join(',');
    await conn.query(`DELETE FROM grade_custom_values WHERE grade_id IN (${ph})`, gradeIds);
  }
  await conn.query('DELETE FROM attendance_records WHERE student_matricula = ?', [matricula]);
  await conn.query('DELETE FROM partial_grades WHERE student_matricula = ?', [matricula]);
  await conn.query('DELETE FROM final_grades WHERE student_matricula = ?', [matricula]);
}

/**
 * Removes all teaching data for one teacher user (before deleting the user row).
 */
export async function deleteTeacherRecords(conn, teacherId) {
  const [grades] = await conn.query('SELECT id FROM final_grades WHERE teacher_id = ?', [teacherId]);
  const gradeIds = (grades || []).map((g) => g.id);
  if (gradeIds.length > 0) {
    const ph = gradeIds.map(() => '?').join(',');
    await conn.query(`DELETE FROM grade_custom_values WHERE grade_id IN (${ph})`, gradeIds);
  }

  const [dates] = await conn.query('SELECT id FROM attendance_dates WHERE teacher_id = ?', [teacherId]);
  if (dates && dates.length > 0) {
    const dateIds = dates.map((d) => d.id);
    const ph = dateIds.map(() => '?').join(',');
    await conn.query(`DELETE FROM attendance_records WHERE date_id IN (${ph})`, dateIds);
    await conn.query(`DELETE FROM attendance_dates WHERE id IN (${ph})`, dateIds);
  }

  await conn.query('DELETE FROM partial_grades WHERE teacher_id = ?', [teacherId]);
  await conn.query('DELETE FROM partial_columns_config WHERE teacher_id = ?', [teacherId]);
  await conn.query('DELETE FROM grade_columns_config WHERE teacher_id = ?', [teacherId]);
  await conn.query('DELETE FROM final_grades WHERE teacher_id = ?', [teacherId]);
}
