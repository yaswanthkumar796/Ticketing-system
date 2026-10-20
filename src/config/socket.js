import { Server } from 'socket.io';

/**
 * Singleton Socket.IO instance.
 * Initialized once via initSocket(server), then accessed globally via getIO().
 */
let io;

/**
 * Initializes Socket.IO on top of an existing HTTP server.
 * Must be called before any code calls getIO().
 *
 * @param {import('http').Server} server - The Node.js HTTP server instance.
 */
export function initSocket(server) {
  io = new Server(server, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    /**
     * join-event — client subscribes to real-time updates for a specific event.
     * The socket is added to the room "event:{eventId}" so targeted emits
     * only reach clients watching that event.
     */
    socket.on('join-event', (eventId) => {
      socket.join(`event:${eventId}`);
      console.log(`   ↳ Socket ${socket.id} joined room event:${eventId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  console.log('🔗 Socket.IO initialized');
  return io;
}

/**
 * Returns the initialized Socket.IO instance.
 * Throws if called before initSocket().
 *
 * @returns {import('socket.io').Server}
 */
export function getIO() {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initSocket(server) first.');
  }
  return io;
}
