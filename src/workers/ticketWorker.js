import { Queue, Worker } from 'bullmq';
import 'dotenv/config';

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
    console.log('⏳ 3-minute TTL expired for event:', job.data.eventId);
    // TODO (Prompt 6): query DB — if ticket still LOCKED, rollback Redis counter
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
