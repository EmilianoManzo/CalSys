import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';

const router = express.Router();

// Login para usuarios (staff)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const [users] = await db.query(
      'SELECT * FROM users WHERE username = ? AND is_active = ?',
      [username, true]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Login para estudiantes
router.post('/login-student', async (req, res) => {
  try {
    const { matricula, password } = req.body;

    console.log('Login de alumno:', matricula);

    if (!matricula || !password) {
      return res.status(400).json({ error: 'Matricula y password requeridos' });
    }

    const [students] = await db.query(
      'SELECT * FROM students WHERE matricula = ? AND status = ?',
      [matricula, 'active']
    );

    console.log('Alumno encontrado:', students.length > 0);

    if (students.length === 0) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const student = students[0];
    const passwordMatch = await bcrypt.compare(password, student.password_hash);

    console.log('Password coincide:', passwordMatch);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const token = jwt.sign(
      { matricula: student.matricula, role: 'student' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        matricula: student.matricula,
        firstName: student.first_name,
        lastName: student.last_name,
        email: student.email,
        role: 'student'
      }
    });

  } catch (error) {
    console.error('Error en login alumno:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Verificar sesión (GET /me)
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === 'student') {
      const [students] = await db.query(
        'SELECT * FROM students WHERE matricula = ? AND status = ?',
        [decoded.matricula, 'active']
      );

      if (students.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const student = students[0];
      return res.json({
        user: {
          matricula: student.matricula,
          firstName: student.first_name,
          lastName: student.last_name,
          email: student.email,
          role: 'student'
        }
      });

    } else {
      const [users] = await db.query(
        'SELECT * FROM users WHERE id = ? AND is_active = ?',
        [decoded.id, true]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const user = users[0];
      return res.json({
        user: {
          id: user.id,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          role: user.role
        }
      });
    }

  } catch (error) {
    console.error('Error verificando sesión:', error);
    res.status(401).json({ error: 'Token invalido' });
  }
});

export default router;