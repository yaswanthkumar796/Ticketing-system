import './workers/ticketWorker.js';
import 'dotenv/config';
import express from 'express';
import pool from './config/db.js';
import ticketRoutes from './routes/ticketRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/tickets', ticketRoutes);

/**
 * GET /api/health
 * Quick liveness check — confirms the server is running and DB pool is ready.
 */
app.get('/api/health', async (req, res) => {
  try {
    // Ping the DB pool to verify database connectivity on health check
    await pool.query('SELECT 1');
    return res.status(200).json({
      status: 'ok',
      message: 'Ticketing system is up and running',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(503).json({
      status: 'error',
      message: 'Database unavailable',
      error: err.message,
    });
  }
});

// ─── 404 Fallback ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Ticketing System server is running on http://localhost:${PORT}`);
  console.log(`   Health check → http://localhost:${PORT}/api/health`);
});

export default app;
