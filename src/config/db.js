import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false // Strictly required for Aiven
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

(async () => {
  try {
    const connection = await pool.getConnection();
    console.log(`✅ MySQL connection pool established — connected to "${process.env.DB_NAME}" on ${process.env.DB_HOST}`);
    connection.release();
  } catch (err) {
    console.error('❌ EXACT DATABASE ERROR:', err.code, err.message);
    process.exit(1);
  }
})();

export default pool;