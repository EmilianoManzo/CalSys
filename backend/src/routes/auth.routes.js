import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../config/database.js';
import { authenticateToken, createCsrfToken, logSecurityEvent, signAuthToken } from '../middleware/security.js';
import { clearAuthFailures, recordAuthFailure } from '../middleware/rateLimit.js';
import { validateEnum, validateNonEmptyString } from '../utils/validation.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Faltan datos (username, password, role)' });
    }

    const validatedUsername = validateNonEmptyString(username, 'Usuario');
    const validatedRole = validateEnum(role, ['director', 'maestro', 'alumno'], 'Rol');

    let user = null;
    let userRole = validatedRole;

    if (validatedRole === 'alumno') {
      const [rows] = await db.query(
        'SELECT matricula as id, matricula as username, first_name, last_name, email, password_hash, status, must_change_password FROM students WHERE matricula = ?',
        [validatedUsername]
      );
      if (rows.length > 0 && rows[0].status === 'active') {
        user = rows[0];
      }
    } else {
      const [rows] = await db.query(
        'SELECT id, username, first_name, last_name, email, password_hash, role, is_active, must_change_password FROM users WHERE username = ? AND role = ?',
        [validatedUsername, validatedRole]
      );
      if (rows.length > 0 && rows[0].is_active === 1) {
        user = rows[0];
        userRole = rows[0].role;
      }
    }

    if (!user) {
      recordAuthFailure(validatedUsername, validatedRole);
      logSecurityEvent(req, 'login_failed', { username: validatedUsername, requestedRole: validatedRole });
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const isValid = await bcrypt.compare(String(password), user.password_hash);
    if (!isValid) {
      recordAuthFailure(validatedUsername, validatedRole);
      logSecurityEvent(req, 'login_failed', { username: validatedUsername, requestedRole: validatedRole });
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }
    clearAuthFailures(validatedUsername, validatedRole);
    logSecurityEvent(req, 'login_success', { userId: user.id, requestedRole: validatedRole });

    const csrfToken = createCsrfToken();
    const token = signAuthToken({
      ...user,
      role: userRole,
      matricula: validatedRole === 'alumno' ? user.id : undefined
    });

    res.json({
      token,
      csrfToken,
      user: {
        id: user.id,
        username: user.username,
        role: userRole,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        matricula: validatedRole === 'alumno' ? user.id : undefined,
        mustChangePassword: Boolean(user.must_change_password)
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Completa todos los campos' });
    }

    const password = validateNonEmptyString(newPassword, 'Nueva contrasena');
    if (password.length < 8) {
      return res.status(400).json({ error: 'La nueva contrasena debe tener al menos 8 caracteres' });
    }
    if (password !== String(confirmPassword)) {
      return res.status(400).json({ error: 'Las contrasenas no coinciden' });
    }
    if (password === String(currentPassword)) {
      return res.status(400).json({ error: 'La nueva contrasena debe ser diferente a la actual' });
    }

    const isStudent = req.user.role === 'alumno';
    const table = isStudent ? 'students' : 'users';
    const idColumn = isStudent ? 'matricula' : 'id';
    const selectUserSql = isStudent
      ? 'SELECT matricula as id, matricula as username, first_name, last_name, email, password_hash, must_change_password FROM students WHERE matricula = ?'
      : 'SELECT id, username, first_name, last_name, email, password_hash, role, must_change_password FROM users WHERE id = ?';
    const [rows] = await db.query(selectUserSql, [isStudent ? req.user.matricula : req.user.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = rows[0];
    const isCurrentValid = await bcrypt.compare(String(currentPassword), user.password_hash);
    if (!isCurrentValid) {
      logSecurityEvent(req, 'change_password_failed', { reason: 'invalid_current_password' });
      return res.status(401).json({ error: 'La contrasena actual no es correcta' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.query(
      `UPDATE ${table} SET password_hash = ?, must_change_password = 0 WHERE ${idColumn} = ?`,
      [passwordHash, user.id]
    );

    const updatedUser = {
      ...user,
      role: isStudent ? 'alumno' : user.role,
      matricula: isStudent ? user.id : undefined,
      must_change_password: 0
    };
    const csrfToken = createCsrfToken();
    const token = signAuthToken(updatedUser);

    logSecurityEvent(req, 'change_password_success', { userId: user.id });
    res.json({
      token,
      csrfToken,
      user: {
        id: user.id,
        username: user.username,
        role: updatedUser.role,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        matricula: isStudent ? user.id : undefined,
        mustChangePassword: false
      }
    });
  } catch (error) {
    console.error('Error cambiando contrasena:', error);
    res.status(500).json({ error: 'Error al cambiar contrasena' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { csrfToken, iat, exp, iss, aud, ...user } = req.user;
    res.json({ user });
  } catch {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

export default router;
