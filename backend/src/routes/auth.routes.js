import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username y password requeridos' });
    }
    const [users] = await db.query('SELECT * FROM users WHERE username = ? AND status = ?', [username, 'active']);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }
    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, user: { id: user.id, username: user.username, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role } });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.post('/login-student', async (req, res) => {
  try {
    const { matricula, password } = req.body;
    if (!matricula || !password) {
      return res.status(400).json({ error: 'Matricula y password requeridos' });
    }
    const [students] = await db.query('SELECT * FROM students WHERE matricula = ? AND status = ?', [matricula, 'active']);
    if (students.length === 0) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }
    const student = students[0];
    const passwordMatch = await bcrypt.compare(password, student.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }
    const token = jwt.sign({ matricula: student.matricula, role: 'student' }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, user: { matricula: student.matricula, firstName: student.first_name, lastName: student.last_name, email: student.email, role: 'student' } });
  } catch (error) {
    console.error('Error en login alumno:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === 'student') {
      const [students] = await db.query(
        'SELECT matricula, first_name, last_name, email FROM students WHERE matricula = ?',
        [decoded.matricula]
      );
      
      if (students.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      return res.json({
        user: {
          matricula: students[0].matricula,
          firstName: students[0].first_name,
          lastName: students[0].last_name,
          email: students[0].email,
          role: 'student'
        }
      });
    } else {
      const [users] = await db.query(
        'SELECT id, username, first_name, last_name, email, role FROM users WHERE id = ?',
        [decoded.id]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      return res.json({
        user: {
          id: users[0].id,
          username: users[0].username,
          firstName: users[0].first_name,
          lastName: users[0].last_name,
          email: users[0].email,
          role: users[0].role
        }
      });
    }

  } catch (error) {
    console.error('Error en verificacion:', error);
    res.status(401).json({ error: 'Token invalido' });
  }
});
export default router;