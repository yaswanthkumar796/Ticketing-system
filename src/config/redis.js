import 'dotenv/config';
import Redis from 'ioredis';

/**
 * ioredis client for the high-concurrency ticketing system.
 *
 * Supports two connection modes:
 *   - REDIS_URL set  → connects via full Redis URL (e.g. rediss://... for TLS)
 *   - REDIS_URL blank → connects to localhost:6379 (local dev fallback)
 *
 * ioredis automatically handles reconnection with exponential back-off.
 */
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      // Required for TLS-enabled Redis services (Aiven, Upstash, etc.)
      tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    })
  : new Redis({
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });

redis.on('connect', () => {
  console.log('✅ Redis client connected successfully');
});

redis.on('ready', () => {
  console.log('🟢 Redis client is ready to accept commands');
});

redis.on('error', (err) => {
  console.error('❌ Redis client error:', err.message);
});

redis.on('close', () => {
  console.warn('⚠️  Redis connection closed');
});

export default redis;
