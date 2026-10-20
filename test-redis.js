import 'dotenv/config';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, { tls: {} });

redis.on('ready', async () => {
  console.log('✅ Redis connected to Aiven Valkey!');
  const pong = await redis.ping();
  console.log('PING →', pong);
  await redis.quit();
  process.exit(0);
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
  process.exit(1);
});
