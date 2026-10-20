import { Router } from 'express';
import { reserveTicket, checkoutTicket } from '../services/ticketService.js';

const router = Router();

/**
 * POST /api/tickets/reserve
 * Body: { eventId: number }
 *
 * Atomically reserves one ticket for the given event using
 * the Redis Lua shield in ticketService.js.
 */
router.post('/reserve', async (req, res) => {
  const { eventId } = req.body;

  if (!eventId) {
    return res.status(422).json({ error: 'eventId is required' });
  }

  try {
    const reserved = await reserveTicket(eventId);

    if (reserved) {
      return res.status(200).json({ message: 'Ticket locked successfully' });
    } else {
      return res.status(400).json({ error: 'Tickets sold out' });
    }
  } catch (err) {
    console.error(`[reserveTicket] Error for eventId=${eventId}:`, err.message);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

/**
 * POST /api/tickets/checkout
 * Body: { eventId: number, userId: string }
 *
 * Finalises a ticket purchase using OCC:
 *   - 200 → checkout succeeded, PAID ticket written to DB
 *   - 409 → OCC conflict or event not found — client should retry
 */
router.post('/checkout', async (req, res) => {
  const { eventId, userId } = req.body;

  if (!eventId || !userId) {
    return res.status(422).json({ error: 'eventId and userId are required' });
  }

  try {
    const result = await checkoutTicket(eventId, userId);

    if (result.success) {
      return res.status(200).json({ message: result.message });
    } else {
      return res.status(409).json({ error: result.error });
    }
  } catch (err) {
    console.error(`[checkoutTicket] Error for eventId=${eventId}:`, err.message);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

export default router;
