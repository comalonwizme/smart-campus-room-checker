/**
 * LLM adapter interface and the classroom mock.
 *
 * A real adapter would run on a server (the API key never reaches the
 * browser), send `prompt` to the model and return the parsed JSON. The mock
 * below honours the same interface but builds its answer from the structured
 * facts only, so the demo works with no network, no key and no cost.
 */
import type { ExplainInput } from './contract';
import type { PromptPayload } from './prompt';

export interface AdapterRequest {
  prompt: PromptPayload;
  facts: ExplainInput;
}

export interface LlmAdapter {
  /** Shown in the UI so users know what produced the text. */
  readonly label: string;
  /** Resolves with the raw (untrusted) model output. Must stop work when `signal` aborts. */
  generate(req: AdapterRequest, signal: AbortSignal): Promise<unknown>;
}

/** Failure modes the mock can simulate (Task #05). */
export const MOCK_MODES = ['ok', 'slow', 'error', 'malformed', 'contradict'] as const;
export type MockMode = (typeof MOCK_MODES)[number];

function friendlyTime(t: string | null): string {
  return t ? t.slice(11) : '';
}

function mockText(f: ExplainInput): string {
  const slot = f.start && f.end ? ` from ${friendlyTime(f.start)} to ${friendlyTime(f.end)}` : '';
  switch (f.reasonCode) {
    case 'OK':
      return `Good news: ${f.roomLabel} is free${slot} because no rule or existing booking stops this request.`;
    case 'OVERLAP':
      return `${f.roomLabel} is not available${slot} because that time overlaps an existing booking. Please try a different time.`;
    case 'BLOCKED':
      return `${f.roomLabel} is blocked right now, so it cannot be booked for any time.`;
    case 'PAST':
      return `The requested start time has already passed, so this slot cannot be booked. Please choose a future time.`;
    case 'DURATION':
      return `Bookings must be between 30 and 120 minutes long, and this request is outside that range.`;
    case 'INVALID':
      return `The times you entered could not be checked. Please enter a valid start time and an end time after it.`;
    case 'DATA_ERROR':
      return `Availability could not be verified because some stored booking data is invalid, so the request was refused to be safe.`;
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const id = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export class MockLlmAdapter implements LlmAdapter {
  readonly label: string;

  constructor(
    private readonly mode: MockMode = 'ok',
    private readonly latencyMs = 400,
  ) {
    this.label = mode === 'ok' ? 'Mock AI (no real model)' : `Mock AI — simulated "${mode}"`;
  }

  async generate({ facts }: AdapterRequest, signal: AbortSignal): Promise<unknown> {
    switch (this.mode) {
      case 'slow':
        await sleep(60_000, signal); // longer than any timeout; aborted by the caller
        return { explanation: mockText(facts) };
      case 'error':
        await sleep(this.latencyMs, signal);
        throw new Error('Simulated API failure (HTTP 503).');
      case 'malformed':
        await sleep(this.latencyMs, signal);
        return { text: 42 };
      case 'contradict':
        await sleep(this.latencyMs, signal);
        return {
          explanation: facts.isAvailable
            ? 'Sorry, this room is not available because it is already booked.'
            : 'Good news, the room is available and you can book it now.',
        };
      default:
        await sleep(this.latencyMs, signal);
        return { explanation: mockText(facts) };
    }
  }
}

/** Read `?mock=<mode>` from the page URL (demo / testing only). Unknown values fall back to "ok". */
export function mockModeFromSearch(search: string): MockMode {
  const v = new URLSearchParams(search).get('mock');
  return (MOCK_MODES as readonly string[]).includes(v ?? '') ? (v as MockMode) : 'ok';
}
