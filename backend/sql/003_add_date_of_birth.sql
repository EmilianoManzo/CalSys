-- Add date_of_birth column to students table
-- Run manually: mysql -u USER -p calsys_db < backend/sql/003_add_date_of_birth.sql
--
-- Fixes: "Unknown column 'date_of_birth' in 'field list'" thrown by the
-- INSERT/UPDATE statements in admin.routes.js (lines ~586, ~611).

-- Add date_of_birth only if the column does not already exist (safe re-run)
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'students'
    AND COLUMN_NAME  = 'date_of_birth'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE students ADD COLUMN date_of_birth DATE NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
