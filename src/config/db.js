import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * MySQL connection pool for high-concurrency ticketing system.
 * Uses mysql2/promise for async/await support.
 * Pool settings are tuned for concurrent workloads.
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,   // Queue requests when all connections are in use
  connectionLimit: 10,         // Max concurrent connections in the pool
  queueLimit: 0,               // Unlimited queued requests (0 = no limit)
  enableKeepAlive: true,       // Keep idle connections alive
  keepAliveInitialDelay: 0,    // Start keepalive immediately
});

// Verify connectivity at startup by acquiring and releasing a test connection
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log(`✅ MySQL connection pool established — connected to "${process.env.DB_NAME}" on ${process.env.DB_HOST}`);
    connection.release();
  } catch (err) {
    console.error('❌ Failed to connect to MySQL database:', err.message);
    process.exit(1); // Exit early — app cannot run without DB
  }
})();

export default pool;
