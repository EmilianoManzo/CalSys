import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

function sslConfig() {
  if (process.env.DB_SSL_CA) {
    return {
      ca: process.env.DB_SSL_CA,
      rejectUnauthorized: true
    };
  }
  if (process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production') {
    return { rejectUnauthorized: true };
  }
  return undefined;
}

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME     || 'calsys_db',
  port:             process.env.DB_PORT     || 3306,
  charset:          'utf8mb4',
  connectTimeout:   Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
  ssl:              sslConfig(),
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0
});

export default pool;
