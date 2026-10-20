import { Queue, Worker } from 'bullmq';
import 'dotenv/config';
import pool from '../config/db.js';
import redis from '../config/redis.js';
import { getIO } from '../config/socket.js';

/**
 * BullMQ requires a plain connection config object (NOT a shared ioredis instance).
 * The Worker specifically needs maxRetriesPerRequest: null because it uses
 * blocking Redis commands (BRPOPLPUSH / BLMOVE) that must never time out.
 *
 * We build the config from the same REDIS_URL used by ioredis so there is
 * still one source of truth in .env.
 */
const redisUrl = new URL(process.env.REDIS_URL);

const bullConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
  maxRetriesPerRequest: null, // Required by BullMQ workers
};

// ─── Queue ────────────────────────────────────────────────────────────────────
/**
 * ticket-ttl queue
 * Jobs represent "pending payment windows".
 * A job with delay: 180 000 ms fires 3 minutes after a ticket is locked,
 * allowing the worker to rollback if payment never arrived.
 */
const ticketQueue = new Queue('ticket-ttl', { connection: bullConnection });

ticketQueue.on('error', (err) => {
  console.error('❌ BullMQ Queue error:', err.message);
});

console.log('📋 BullMQ Queue "ticket-ttl" initialized');

// ─── Worker ───────────────────────────────────────────────────────────────────
/**
 * Processes jobs from the ticket-ttl queue after the 3-minute delay.
 * In a future prompt this will check DB payment status and rollback
 * the Redis counter if payment never came through.
 */
const ticketWorker = new Worker(
  'ticket-ttl',
  async (job) => {
    const { eventId } = job.data;

    console.log(`Verifying payment status for event ${eventId}...`);

    // Check the DB for any ticket that was fully paid for this event
    const [rows] = await pool.query(
      'SELECT * FROM tickets WHERE event_id = ? AND status = "PAID"',
      [eventId]
    );

    if (rows.length === 0) {
      // No paid ticket found — the user's payment window expired.
      // Rollback: increment the available seat counter in Redis so the
      // seat can be claimed by another user.
      await redis.incr(`event:${eventId}:tickets_available`);
      console.log(`Payment timeout. Seat released back to Redis queue for event ${eventId}.`);

      // Broadcast seat release to all clients watching this event room
      getIO().to(`event:${eventId}`).emit('ticket-update', { action: 'RELEASED' });
    } else {
      console.log(`✅ Payment confirmed for event ${eventId}. No rollback needed.`);
    }
  },
  { connection: bullConnection }
);

ticketWorker.on('completed', (job) => {
  console.log(`✅ TTL job ${job.id} completed for eventId=${job.data.eventId}`);
});

ticketWorker.on('failed', (job, err) => {
  console.error(`❌ TTL job ${job?.id} failed:`, err.message);
});

ticketWorker.on('error', (err) => {
  console.error('❌ BullMQ Worker error:', err.message);
});

console.log('⚙️  BullMQ Worker "ticket-ttl" started and listening for jobs');

export { ticketQueue };
