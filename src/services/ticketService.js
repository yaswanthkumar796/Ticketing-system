import redis from '../config/redis.js';
import { ticketQueue } from '../workers/ticketWorker.js';
import { getIO } from '../config/socket.js';
import pool from '../config/db.js';

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

/**
 * Checks out a ticket for a user using Optimistic Concurrency Control (OCC).
 *
 * OCC pattern:
 *   1. Read the current version of the event row.
 *   2. Attempt UPDATE with WHERE version = currentVersion.
 *   3. If another request updated first, affectedRows === 0 → conflict detected.
 *   4. On success, INSERT a PAID ticket record and emit SOLD event.
 *
 * @param {number|string} eventId - The event to check out a ticket for.
 * @param {string}        userId  - The user completing the purchase.
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
export async function checkoutTicket(eventId, userId) {
  // Step 1: Read the current event version
  const [rows] = await pool.query(
    'SELECT version FROM events WHERE id = ?',
    [eventId]
  );

  if (rows.length === 0) {
    return { success: false, error: 'Event not found' };
  }

  const currentVersion = rows[0].version;

  // Step 2: Attempt atomic version bump — only succeeds if no one else updated first
  const [updateResult] = await pool.query(
    'UPDATE events SET version = version + 1 WHERE id = ? AND version = ?',
    [eventId, currentVersion]
  );

  // Step 3: OCC conflict check — another request slipped in between read and update
  if (updateResult.affectedRows === 0) {
    return { success: false, error: 'Concurrency conflict during checkout. Try again.' };
  }

  // Step 4: Version bump won — safely write the PAID ticket record
  await pool.query(
    'INSERT INTO tickets (event_id, user_id, status) VALUES (?, ?, "PAID")',
    [eventId, userId]
  );

  // Broadcast sale to all clients watching this event room
  getIO().to(`event:${eventId}`).emit('ticket-update', { action: 'SOLD' });

  return { success: true, message: 'Checkout complete' };
}
