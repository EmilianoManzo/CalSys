import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './config/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    message: '🎓 Calsys API', 
    version: '1.0.0', 
    status: 'running' 
  });
});

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'OK', database: 'connected' });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Calsys Backend: http://localhost:${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});