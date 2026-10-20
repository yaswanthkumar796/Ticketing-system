import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Activity, Ticket, ShieldCheck, AlertCircle, Clock } from 'lucide-react';
import './index.css';

export default function App() {
  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    const socket = io("http://localhost:3000");

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-event', 1);
      addLog('SYSTEM', 'Connected to secure WebSocket stream', '#10b981', <ShieldCheck size={18} />);
    });

    socket.on('disconnect', () => setIsConnected(false));

    socket.on('ticket-update', (data) => {
      if (data.action === 'LOCKED')   addLog('LOCKED',   'A user locked a ticket. Awaiting payment...',      '#f59e0b', <Clock size={18} />);
      if (data.action === 'RELEASED') addLog('RELEASED', 'Payment timeout. Ticket restored to pool.',        '#0ea5e9', <Activity size={18} />);
      if (data.action === 'SOLD')     addLog('SOLD',     'Checkout complete. Ticket permanently claimed.',   '#ef4444', <Ticket size={18} />);
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (type, message, color, icon) => {
    setLogs(prev => [...prev, {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString(),
      type, message, color, icon
    }]);
  };

  const reserveTicket = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/tickets/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: 1 })
      });
      if (!res.ok) addLog('ERROR', 'Tickets sold out or queue full.', '#ef4444', <AlertCircle size={18} />);
    } catch (err) {
      addLog('ERROR', 'Failed to connect to API.', '#ef4444', <AlertCircle size={18} />);
    }
    setIsLoading(false);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px' }}>Ticketing Ops Console</h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Live Event Sync: Event #1</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '20px', color: '#10b981', fontSize: '13px', fontWeight: '600' }}>
          {isConnected ? <><div className="pulse"></div> Live</> : 'Connecting...'}
        </div>
      </header>

      <div style={{ display: 'grid', gap: '24px' }}>
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '600' }}>Test Ingress Traffic</h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>Simulate a user hitting the Redis queue</p>
          </div>
          <button className="btn" onClick={reserveTicket} disabled={isLoading || !isConnected}>
            <Ticket size={18} /> {isLoading ? 'Processing...' : 'Simulate User Lock'}
          </button>
        </div>

        <div className="glass-panel" style={{ minHeight: '400px', maxHeight: '500px', overflowY: 'auto' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Event Stream</h2>
          {logs.length === 0 && (
            <p style={{ color: '#475569', textAlign: 'center', marginTop: '40px' }}>Awaiting network activity...</p>
          )}
          {logs.map((log) => (
            <div key={log.id} className="feed-item">
              <div style={{ color: log.color, background: `${log.color}20`, padding: '8px', borderRadius: '8px', display: 'flex' }}>
                {log.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ color: log.color, fontWeight: '600', fontSize: '13px' }}>{log.type}</span>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>{log.time}</span>
                </div>
                <div style={{ color: '#e2e8f0', fontSize: '14px' }}>{log.message}</div>
              </div>
            </div>
          ))}
          <div ref={endOfMessagesRef} />
        </div>
      </div>
    </div>
  );
}
