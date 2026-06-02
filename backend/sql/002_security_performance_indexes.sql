-- Security/performance indexes for CalSys
-- Run manually: mysql -u USER -p calsys_db < backend/sql/002_security_performance_indexes.sql

DELIMITER //

CREATE PROCEDURE add_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_index_sql TEXT
)
BEGIN
  SET @idx_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND INDEX_NAME = p_index_name
  );

  IF @idx_exists = 0 THEN
    SET @sql = p_index_sql;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

DELIMITER ;

CALL add_index_if_missing('users', 'idx_users_username_role_active',
  'CREATE INDEX idx_users_username_role_active ON users (username, role, is_active)');
CALL add_index_if_missing('users', 'idx_users_email',
  'CREATE INDEX idx_users_email ON users (email)');
CALL add_index_if_missing('users', 'idx_users_role_status_active',
  'CREATE INDEX idx_users_role_status_active ON users (role, status, is_active)');

CALL add_index_if_missing('students', 'idx_students_email',
  'CREATE INDEX idx_students_email ON students (email)');
CALL add_index_if_missing('students', 'idx_students_status_group',
  'CREATE INDEX idx_students_status_group ON students (status, group_id)');

CALL add_index_if_missing('materias', 'idx_materias_subject_code',
  'CREATE INDEX idx_materias_subject_code ON materias (subject_code)');

CALL add_index_if_missing('final_grades', 'idx_final_grades_class',
  'CREATE INDEX idx_final_grades_class ON final_grades (teacher_id, semester_code, subject_code, group_code)');
CALL add_index_if_missing('final_grades', 'idx_final_grades_student_subject',
  'CREATE INDEX idx_final_grades_student_subject ON final_grades (student_matricula, subject_code)');
CALL add_index_if_missing('final_grades', 'idx_final_grades_subject_teacher_semester_group',
  'CREATE INDEX idx_final_grades_subject_teacher_semester_group ON final_grades (subject_code, teacher_id, semester_code, group_code)');

CALL add_index_if_missing('partial_columns_config', 'idx_partial_columns_class_partial',
  'CREATE INDEX idx_partial_columns_class_partial ON partial_columns_config (teacher_id, semester_code, subject_code, group_code, partial_id, is_special)');
CALL add_index_if_missing('partial_columns_config', 'idx_partial_columns_lookup',
  'CREATE INDEX idx_partial_columns_lookup ON partial_columns_config (teacher_id, semester_code, subject_code, partial_id, column_name)');

CALL add_index_if_missing('partial_grades', 'idx_partial_grades_class_partial_student',
  'CREATE INDEX idx_partial_grades_class_partial_student ON partial_grades (teacher_id, semester_code, subject_code, group_code, partial_id, student_matricula)');
CALL add_index_if_missing('partial_grades', 'idx_partial_grades_column_lookup',
  'CREATE INDEX idx_partial_grades_column_lookup ON partial_grades (teacher_id, semester_code, subject_code, partial_id, column_name)');
CALL add_index_if_missing('partial_grades', 'idx_partial_grades_student_subject',
  'CREATE INDEX idx_partial_grades_student_subject ON partial_grades (student_matricula, subject_code)');

CALL add_index_if_missing('grade_columns_config', 'idx_grade_columns_class',
  'CREATE INDEX idx_grade_columns_class ON grade_columns_config (teacher_id, semester_code, subject_code, group_code, is_special)');

CALL add_index_if_missing('grade_custom_values', 'idx_grade_custom_values_grade',
  'CREATE INDEX idx_grade_custom_values_grade ON grade_custom_values (grade_id)');
CALL add_index_if_missing('grade_custom_values', 'idx_grade_custom_values_column',
  'CREATE INDEX idx_grade_custom_values_column ON grade_custom_values (column_config_id)');

CALL add_index_if_missing('attendance_dates', 'idx_attendance_dates_class',
  'CREATE INDEX idx_attendance_dates_class ON attendance_dates (teacher_id, semester_code, subject_code, group_code, class_date)');
CALL add_index_if_missing('attendance_records', 'idx_attendance_records_date_student',
  'CREATE INDEX idx_attendance_records_date_student ON attendance_records (date_id, student_matricula)');
CALL add_index_if_missing('attendance_records', 'idx_attendance_records_student',
  'CREATE INDEX idx_attendance_records_student ON attendance_records (student_matricula)');

DROP PROCEDURE add_index_if_missing;
