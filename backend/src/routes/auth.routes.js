import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';

const router = express.Router();

// Middleware para verificar token (para el endpoint /me)
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Login unificado (recibe username, password, role)
router.post('/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Faltan datos (username, password, role)' });
    }

    let user = null;
    let userRole = role;

    if (role === 'alumno') {
      // Buscar en tabla students
      const [rows] = await db.query(
        'SELECT matricula as id, matricula as username, first_name, last_name, email, password_hash, status FROM students WHERE matricula = ?',
        [username]
      );
      if (rows.length > 0 && rows[0].status === 'active') {
        user = rows[0];
        userRole = 'alumno';
      }
    } else {
      // Buscar en users (admin, director, maestro)
      const [rows] = await db.query(
        'SELECT id, username, first_name, last_name, email, password_hash, role, is_active FROM users WHERE username = ? AND role = ?',
        [username, role]
      );
      if (rows.length > 0 && rows[0].is_active === 1) {
        user = rows[0];
        userRole = rows[0].role;
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: userRole,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        matricula: role === 'alumno' ? user.id : undefined
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: userRole,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        matricula: role === 'alumno' ? user.id : undefined
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Endpoint para obtener información del usuario autenticado (desde el token)
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    // Podrías buscar datos frescos en BD si lo deseas
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

export default router;