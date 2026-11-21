import { useMemo, useRef, useState } from 'react';
import { BOOKINGS, ROOM } from './data/bookings';
import { checkAvailability, type Request, type Result } from './lib/availability';
import { toExplainInput } from './lib/explain/contract';
import { explainAvailability, type ExplainOutcome } from './lib/explain/explain';
import { MockLlmAdapter, mockModeFromSearch } from './lib/explain/mockAdapter';

const FALLBACK_REASON_TEXT = {
  timeout: 'the AI service took too long',
  adapter_error: 'the AI service is unavailable',
  invalid_output: 'the AI answer failed our safety checks',
} as const;

type ExplainState = { status: 'idle' } | { status: 'loading' } | { status: 'done'; outcome: ExplainOutcome };

export function App() {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  // The deterministic result together with the exact request it was computed for.
  const [checked, setChecked] = useState<{ req: Request; result: Result } | null>(null);
  const [explain, setExplain] = useState<ExplainState>({ status: 'idle' });
  const pending = useRef<AbortController | null>(null);

  const mockMode = useMemo(() => mockModeFromSearch(window.location.search), []);
  const adapter = useMemo(() => new MockLlmAdapter(mockMode), [mockMode]);

  function cancelExplanation() {
    pending.current?.abort();
    pending.current = null;
    setExplain({ status: 'idle' });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    cancelExplanation();
    const req = { start, end };
    setChecked({ req, result: checkAvailability(ROOM, BOOKINGS, req) });
  }

  async function onExplain() {
    if (!checked) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setExplain({ status: 'loading' });
    const outcome = await explainAvailability(toExplainInput(ROOM, checked.req, checked.result), adapter, {
      signal: controller.signal,
    });
    // Ignore answers for a check that is no longer on screen.
    if (pending.current !== controller) return;
    pending.current = null;
    setExplain({ status: 'done', outcome });
  }

  const result = checked?.result;

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
        <div role="status" className={result.available ? 'result ok' : 'result bad'} data-testid="decision">
          <span className="tag tag-rule">Rule check · authoritative</span>
          <p className="decision">
            {result.available ? '✅ ' : '❌ '}
            {result.message}
          </p>
        </div>
      )}

      {result && (
        <section className="explain" aria-labelledby="explain-title">
          <div className="explain-head">
            <h2 id="explain-title">Why?</h2>
            <button
              type="button"
              className="secondary"
              onClick={onExplain}
              disabled={explain.status === 'loading'}
              data-testid="explain-btn"
            >
              {explain.status === 'loading' ? 'Explaining…' : 'Explain availability'}
            </button>
          </div>
          {mockMode !== 'ok' && (
            <p className="demo-note">Demo mode: the mock AI is simulating “{mockMode}”.</p>
          )}
          <ExplanationPanel state={explain} />
        </section>
      )}
    </main>
  );
}

function ExplanationPanel({ state }: { state: ExplainState }) {
  if (state.status === 'idle') return null;
  if (state.status === 'loading') {
    return (
      <p className="explanation pending" aria-live="polite">
        Generating explanation…
      </p>
    );
  }
  const o = state.outcome;
  if (o.kind === 'rejected') {
    return (
      <div className="explanation error" aria-live="polite" data-testid="explanation">
        <span className="tag tag-warn">Explanation unavailable</span>
        <p>We could not explain this result ({o.error}). The availability result above is unaffected.</p>
      </div>
    );
  }
  if (o.kind === 'fallback') {
    return (
      <div className="explanation fallback" aria-live="polite" data-testid="explanation">
        <span className="tag tag-warn">Standard explanation · AI not used</span>
        <p>{o.explanation}</p>
        <p className="fineprint">Shown because {FALLBACK_REASON_TEXT[o.reason]}. The availability result above is unaffected.</p>
      </div>
    );
  }
  return (
    <div className="explanation ai" aria-live="polite" data-testid="explanation">
      <span className="tag tag-ai">AI-generated explanation · {o.source}</span>
      <p>{o.explanation}</p>
      <p className="fineprint">
        This text was written by an AI from the rule-check result. It is not a booking confirmation and does not change
        availability.
      </p>
    </div>
  );
}
