-- CalSys local MySQL schema for MySQL Workbench.
-- Open this file in MySQL Workbench and run the full script.

CREATE DATABASE IF NOT EXISTS `CalSysJS`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `CalSysJS`;

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  role ENUM('director', 'maestro') NOT NULL DEFAULT 'maestro',
  phone VARCHAR(30) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_username_role_active (username, role, is_active),
  KEY idx_users_role_status_active (role, status, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_groups_code (group_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS students (
  matricula VARCHAR(30) PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  date_of_birth DATE NULL,
  phone VARCHAR(30) NULL,
  address VARCHAR(255) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  admission_date DATE NULL,
  group_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_students_email (email),
  KEY idx_students_status_group (status, group_id),
  CONSTRAINT fk_students_group
    FOREIGN KEY (group_id) REFERENCES student_groups(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS materias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject_code VARCHAR(50) NOT NULL,
  subject_name VARCHAR(150) NOT NULL,
  credits INT NOT NULL DEFAULT 5,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_materias_subject_code (subject_code),
  KEY idx_materias_subject_code (subject_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS final_grades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_matricula VARCHAR(30) NOT NULL,
  semester_code VARCHAR(30) NOT NULL,
  subject_code VARCHAR(50) NOT NULL,
  group_code VARCHAR(20) NULL,
  teacher_id INT NOT NULL,
  parcial_1 DECIMAL(5,2) NULL,
  parcial_2 DECIMAL(5,2) NULL,
  parcial_3 DECIMAL(5,2) NULL,
  ordinario DECIMAL(5,2) NULL,
  promedio_parciales DECIMAL(5,2) NULL,
  final_grade DECIMAL(5,2) NULL,
  status ENUM('in_progress', 'passed', 'failed') NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_final_grades_class_student (student_matricula, semester_code, subject_code, teacher_id, group_code),
  KEY idx_final_grades_class (teacher_id, semester_code, subject_code, group_code),
  KEY idx_final_grades_student_subject (student_matricula, subject_code),
  KEY idx_final_grades_subject_teacher_semester_group (subject_code, teacher_id, semester_code, group_code),
  CONSTRAINT fk_final_grades_student
    FOREIGN KEY (student_matricula) REFERENCES students(matricula)
    ON DELETE CASCADE,
  CONSTRAINT fk_final_grades_teacher
    FOREIGN KEY (teacher_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_final_grades_subject
    FOREIGN KEY (subject_code) REFERENCES materias(subject_code)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS grade_columns_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  semester_code VARCHAR(30) NOT NULL,
  subject_code VARCHAR(50) NOT NULL,
  group_code VARCHAR(20) NULL,
  column_name VARCHAR(100) NOT NULL,
  column_type VARCHAR(30) NOT NULL DEFAULT 'numeric',
  max_value DECIMAL(8,2) NOT NULL DEFAULT 10.00,
  weight DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  is_required TINYINT(1) NOT NULL DEFAULT 0,
  display_order INT NOT NULL DEFAULT 0,
  is_special TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_grade_columns_class (teacher_id, semester_code, subject_code, group_code, is_special),
  CONSTRAINT fk_grade_columns_teacher
    FOREIGN KEY (teacher_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_grade_columns_subject
    FOREIGN KEY (subject_code) REFERENCES materias(subject_code)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS grade_custom_values (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grade_id INT NOT NULL,
  column_config_id INT NOT NULL,
  value VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_grade_custom_values (grade_id, column_config_id),
  KEY idx_grade_custom_values_grade (grade_id),
  KEY idx_grade_custom_values_column (column_config_id),
  CONSTRAINT fk_grade_custom_values_grade
    FOREIGN KEY (grade_id) REFERENCES final_grades(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_grade_custom_values_column
    FOREIGN KEY (column_config_id) REFERENCES grade_columns_config(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS partial_columns_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  semester_code VARCHAR(30) NOT NULL,
  subject_code VARCHAR(50) NOT NULL,
  group_code VARCHAR(20) NULL,
  partial_id INT NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  weight DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  max_value DECIMAL(8,2) NOT NULL DEFAULT 10.00,
  display_order INT NOT NULL DEFAULT 0,
  is_special TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_partial_columns_config (teacher_id, semester_code, subject_code, group_code, partial_id, column_name, is_special),
  KEY idx_partial_columns_class_partial (teacher_id, semester_code, subject_code, group_code, partial_id, is_special),
  KEY idx_partial_columns_lookup (teacher_id, semester_code, subject_code, partial_id, column_name),
  CONSTRAINT fk_partial_columns_teacher
    FOREIGN KEY (teacher_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_partial_columns_subject
    FOREIGN KEY (subject_code) REFERENCES materias(subject_code)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS partial_grades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_matricula VARCHAR(30) NOT NULL,
  teacher_id INT NOT NULL,
  semester_code VARCHAR(30) NOT NULL,
  subject_code VARCHAR(50) NOT NULL,
  group_code VARCHAR(20) NULL,
  partial_id INT NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  value DECIMAL(8,2) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_partial_grades_value (student_matricula, teacher_id, semester_code, subject_code, group_code, partial_id, column_name),
  KEY idx_partial_grades_class_partial_student (teacher_id, semester_code, subject_code, group_code, partial_id, student_matricula),
  KEY idx_partial_grades_column_lookup (teacher_id, semester_code, subject_code, partial_id, column_name),
  KEY idx_partial_grades_student_subject (student_matricula, subject_code),
  CONSTRAINT fk_partial_grades_student
    FOREIGN KEY (student_matricula) REFERENCES students(matricula)
    ON DELETE CASCADE,
  CONSTRAINT fk_partial_grades_teacher
    FOREIGN KEY (teacher_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_partial_grades_subject
    FOREIGN KEY (subject_code) REFERENCES materias(subject_code)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance_dates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  semester_code VARCHAR(30) NOT NULL,
  subject_code VARCHAR(50) NOT NULL,
  group_code VARCHAR(20) NULL,
  class_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance_dates_class_date (teacher_id, semester_code, subject_code, group_code, class_date),
  KEY idx_attendance_dates_class (teacher_id, semester_code, subject_code, group_code, class_date),
  CONSTRAINT fk_attendance_dates_teacher
    FOREIGN KEY (teacher_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_attendance_dates_subject
    FOREIGN KEY (subject_code) REFERENCES materias(subject_code)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_matricula VARCHAR(30) NOT NULL,
  date_id INT NOT NULL,
  is_present TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance_records_date_student (date_id, student_matricula),
  KEY idx_attendance_records_student (student_matricula),
  CONSTRAINT fk_attendance_records_student
    FOREIGN KEY (student_matricula) REFERENCES students(matricula)
    ON DELETE CASCADE,
  CONSTRAINT fk_attendance_records_date
    FOREIGN KEY (date_id) REFERENCES attendance_dates(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Starter password for all seed users: admin123
INSERT INTO users (username, first_name, last_name, email, password_hash, must_change_password, role, phone, status, is_active)
VALUES
  ('maestro', 'Maestro', 'Local', 'maestro@calsys.local', '$2a$10$XiLwhBq2nh7Xcry/RUjf2uTaoAaNxpDCdUWkUDfkdL3kyO4r35EI2', 1, 'maestro', NULL, 'active', 1),
  ('director', 'Director', 'Local', 'director@calsys.local', '$2a$10$XiLwhBq2nh7Xcry/RUjf2uTaoAaNxpDCdUWkUDfkdL3kyO4r35EI2', 1, 'director', NULL, 'active', 1)
ON DUPLICATE KEY UPDATE
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  role = VALUES(role),
  status = VALUES(status),
  is_active = VALUES(is_active);

INSERT INTO student_groups (group_code, name, description)
VALUES ('1A', 'Grupo 1A', 'Grupo local de prueba')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), is_active = 1;

INSERT INTO materias (subject_code, subject_name, credits, description)
VALUES ('MAT101', 'Matematicas', 5, 'Materia local de prueba')
ON DUPLICATE KEY UPDATE subject_name = VALUES(subject_name), credits = VALUES(credits), description = VALUES(description);

INSERT INTO students (matricula, first_name, last_name, email, password_hash, must_change_password, status, admission_date, group_id)
SELECT 'A001', 'Alumno', 'Local', 'alumno@calsys.local',
       '$2a$10$XiLwhBq2nh7Xcry/RUjf2uTaoAaNxpDCdUWkUDfkdL3kyO4r35EI2',
       1, 'active', CURDATE(), sg.id
FROM student_groups sg
WHERE sg.group_code = '1A'
ON DUPLICATE KEY UPDATE
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  status = VALUES(status),
  group_id = VALUES(group_id);

INSERT INTO final_grades (student_matricula, semester_code, subject_code, group_code, teacher_id, status)
SELECT 'A001', '2026-1', 'MAT101', '1A', u.id, 'in_progress'
FROM users u
WHERE u.username = 'maestro'
ON DUPLICATE KEY UPDATE status = VALUES(status);
