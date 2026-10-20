import { Router } from 'express';
import { reserveTicket } from '../services/ticketService.js';

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

export default router;
