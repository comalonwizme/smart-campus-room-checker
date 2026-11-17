import { useState } from 'react';
import { BOOKINGS, ROOM } from './data/bookings';
import { checkAvailability, type Result } from './lib/availability';

export function App() {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(checkAvailability(ROOM, BOOKINGS, { start, end }));
  }

  return (
    <main className="container">
      <h1>Smart Campus</h1>
      <p className="subtitle">Room Availability Checker — {ROOM.name}</p>

      <section aria-labelledby="existing">
        <h2 id="existing">Existing bookings (fictional)</h2>
        <ul className="bookings">
          {BOOKINGS.map((b) => (
            <li key={b.id}>
              <strong>{b.title}</strong>
              <span>
                {b.start.replace('T', ' ')} – {b.end.slice(11)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={onSubmit} className="form">
        <label>
          Start
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          End
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <button type="submit">Check availability</button>
      </form>

      {result && (
        <div role="status" className={result.available ? 'result ok' : 'result bad'}>
          {result.available ? '✅ ' : '❌ '}
          {result.message}
        </div>
      )}
    </main>
  );
}
