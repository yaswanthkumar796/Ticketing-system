import redis from '../config/redis.js';
import { ticketQueue } from '../workers/ticketWorker.js';
import { getIO } from '../config/socket.js';

/**
 * Atomic Lua script — the "Lua Shield" for race-condition-safe ticket reservation.
 *
 * How it works:
 *   1. Reads the current value of  event:{eventId}:tickets_available
 *   2. If count > 0  → atomically DECR by 1 and return 1  (reservation SUCCESS)
 *   3. If count <= 0 → do nothing and return 0             (sold out / FAILURE)
 *
 * Because Redis executes Lua scripts atomically (single-threaded), there is
 * zero chance of a race condition between the check and the decrement —
 * even under thousands of concurrent requests.
 */
const RESERVE_TICKET_LUA = `
  local key   = KEYS[1]
  local count = tonumber(redis.call('GET', key))

  if count == nil then
    return -1
  end

  if count > 0 then
    redis.call('DECR', key)
    return 1
  else
    return 0
  end
`;

/**
 * Attempts to reserve one ticket for the given event.
 *
 * @param {number|string} eventId - The ID of the event to reserve a ticket for.
 * @returns {Promise<boolean>} true if a ticket was successfully reserved, false if sold out.
 * @throws Will throw if the Redis key does not exist (returns -1 from Lua).
 */
export async function reserveTicket(eventId) {
  const key = `event:${eventId}:tickets_available`;

  // eval(script, numkeys, key1, key2, ..., arg1, arg2, ...)
  const result = await redis.eval(RESERVE_TICKET_LUA, 1, key);

  if (result === -1) {
    throw new Error(
      `Redis key "${key}" does not exist. Seed ticket count before reserving.`
    );
  }

  // 1 → success (ticket reserved), 0 → sold out
  if (result === 1) {
    // Enqueue a delayed job — fires after 3 minutes (180 000 ms).
    // The worker will check if payment completed; if not, it will rollback.
    await ticketQueue.add('check-payment', { eventId }, { delay: 180000 });

    // Broadcast seat lock to all clients watching this event room
    getIO().to(`event:${eventId}`).emit('ticket-update', { action: 'LOCKED' });

    return true;
  }

  return false;
}
