-- Add first-login password change requirement to users and students.
-- Run manually: mysql -u USER -p calsys_db < backend/sql/005_must_change_password.sql

SET @users_col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'must_change_password'
);

SET @sql_users = IF(@users_col_exists = 0,
  'ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 1 AFTER password_hash',
  'SELECT 1'
);
PREPARE stmt_users FROM @sql_users;
EXECUTE stmt_users;
DEALLOCATE PREPARE stmt_users;

SET @students_col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'students'
    AND COLUMN_NAME = 'must_change_password'
);

SET @sql_students = IF(@students_col_exists = 0,
  'ALTER TABLE students ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 1 AFTER password_hash',
  'SELECT 1'
);
PREPARE stmt_students FROM @sql_students;
EXECUTE stmt_students;
DEALLOCATE PREPARE stmt_students;
