import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const useSsl = process.env.DB_SSL === 'true';

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME     || 'CalSysJS',
  port:             Number(process.env.DB_PORT || 3306),
  charset:          'utf8mb4',
  connectTimeout:   Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
  ssl:              useSsl ? {
    rejectUnauthorized: process.env.NODE_ENV === 'production',
    minVersion: 'TLSv1.2'
  } : undefined,
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0
});

export default pool;
