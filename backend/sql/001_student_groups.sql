-- Student groups migration for CalSys
-- Run manually: mysql -u USER -p calsys_db < backend/sql/001_student_groups.sql

CREATE TABLE IF NOT EXISTS student_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add group_id only if column does not exist (safe re-run)
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'students'
    AND COLUMN_NAME = 'group_id'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE students ADD COLUMN group_id INT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add FK if not present
SET @fk_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'students'
    AND CONSTRAINT_NAME = 'fk_students_group'
);

SET @sql_fk = IF(@fk_exists = 0,
  'ALTER TABLE students ADD CONSTRAINT fk_students_group FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

-- Optional backfill from existing final_grades group codes:
-- INSERT INTO student_groups (group_code, name)
-- SELECT DISTINCT group_code, CONCAT('Grupo ', group_code)
-- FROM final_grades
-- WHERE group_code IS NOT NULL
--   AND group_code NOT IN (SELECT group_code FROM student_groups);
