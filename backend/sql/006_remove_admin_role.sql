-- Replace the duplicated admin role with director.
-- Run manually: mysql -u USER -p calsys_db < backend/sql/006_remove_admin_role.sql

UPDATE users
SET role = 'director'
WHERE role = 'admin';

ALTER TABLE users
  MODIFY role ENUM('director', 'maestro') NOT NULL DEFAULT 'maestro';
