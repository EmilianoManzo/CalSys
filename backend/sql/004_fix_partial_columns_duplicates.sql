-- Fix duplicate entries in partial_columns_config and enforce unique constraint
-- Run manually: mysql -u USER -p calsys_db < backend/sql/004_fix_partial_columns_duplicates.sql
--
-- Fixes: duplicate-entry errors caused by concurrent or repeated inserts into
-- partial_columns_config that violate the logical uniqueness of the combination
-- (teacher_id, semester_code, subject_code, group_code, partial_id, column_name, is_special).

-- Step 1: Remove duplicate rows, keeping only the lowest id for each unique key.
-- This is done via a self-join on a derived table so MySQL does not complain
-- about modifying the same table that appears in the subquery.
DELETE pcc
FROM partial_columns_config pcc
INNER JOIN (
  SELECT MIN(id) AS keep_id,
         teacher_id,
         semester_code,
         subject_code,
         group_code,
         partial_id,
         column_name,
         is_special
  FROM partial_columns_config
  GROUP BY teacher_id, semester_code, subject_code, group_code,
           partial_id, column_name, is_special
  HAVING COUNT(*) > 1
) dups
  ON  pcc.teacher_id     = dups.teacher_id
  AND pcc.semester_code  = dups.semester_code
  AND pcc.subject_code   = dups.subject_code
  AND (pcc.group_code    = dups.group_code OR (pcc.group_code IS NULL AND dups.group_code IS NULL))
  AND pcc.partial_id     = dups.partial_id
  AND pcc.column_name    = dups.column_name
  AND pcc.is_special     = dups.is_special
  AND pcc.id            != dups.keep_id;

-- Step 2: Add the unique constraint if it does not already exist.
SET @uc_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA     = DATABASE()
    AND TABLE_NAME       = 'partial_columns_config'
    AND CONSTRAINT_NAME  = 'uq_partial_columns_config'
    AND CONSTRAINT_TYPE  = 'UNIQUE'
);

SET @sql_uc = IF(@uc_exists = 0,
  'ALTER TABLE partial_columns_config
   ADD CONSTRAINT uq_partial_columns_config
   UNIQUE (teacher_id, semester_code, subject_code, group_code, partial_id, column_name, is_special)',
  'SELECT 1'
);
PREPARE stmt_uc FROM @sql_uc;
EXECUTE stmt_uc;
DEALLOCATE PREPARE stmt_uc;
