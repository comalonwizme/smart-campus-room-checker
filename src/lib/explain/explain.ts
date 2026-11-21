/**
 * Orchestrates one explanation request:
 * validate input -> build prompt -> call adapter with timeout -> validate output -> fallback.
 * It never reads or changes bookings and never returns an availability decision.
 */
import {
  fallbackExplanation,
  LIMITS,
  validateExplainInput,
  validateExplanation,
  type ExplainInput,
} from './contract';
import type { LlmAdapter } from './mockAdapter';
import { buildPrompt } from './prompt';

export type FallbackReason = 'timeout' | 'adapter_error' | 'invalid_output';

export type ExplainOutcome =
  | { kind: 'generated'; explanation: string; source: string; latencyMs: number }
  | { kind: 'fallback'; explanation: string; reason: FallbackReason; detail: string; latencyMs: number }
  | { kind: 'rejected'; error: string };

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Model did not answer within ${ms} ms.`);
    this.name = 'TimeoutError';
  }
}

export interface ExplainOptions {
  timeoutMs?: number;
  /** Lets the caller cancel (e.g. the user started a new check). */
  signal?: AbortSignal;
  now?: () => number;
}

export async function explainAvailability(
  raw: unknown,
  adapter: LlmAdapter,
  { timeoutMs = LIMITS.timeoutMs, signal, now = () => Date.now() }: ExplainOptions = {},
): Promise<ExplainOutcome> {
  // AC3: reject bad input before anything is sent anywhere.
  const parsed = validateExplainInput(raw);
  if (!parsed.ok) return { kind: 'rejected', error: parsed.error };
  const input: ExplainInput = parsed.value;

  const started = now();
  const controller = new AbortController();
  const onOuterAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onOuterAbort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;

  const fallback = (reason: FallbackReason, detail: string): ExplainOutcome => ({
    kind: 'fallback',
    explanation: fallbackExplanation(input),
    reason,
    detail,
    latencyMs: now() - started,
  });

  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const err = new TimeoutError(timeoutMs);
        controller.abort(err);
        reject(err);
      }, timeoutMs);
    });
    const rawOutput = await Promise.race([
      adapter.generate({ prompt: buildPrompt(input), facts: input }, controller.signal),
      timeout,
    ]);

    // AC2: untrusted output must match the contract and agree with the decision.
    const checked = validateExplanation(rawOutput, input);
    if (!checked.ok) return fallback('invalid_output', checked.error);
    return { kind: 'generated', explanation: checked.value.explanation, source: adapter.label, latencyMs: now() - started };
  } catch (err) {
    // AC4: timeout or adapter failure -> safe deterministic fallback, never a crash.
    if (err instanceof TimeoutError) return fallback('timeout', err.message);
    return fallback('adapter_error', err instanceof Error ? err.message : 'Unknown adapter error.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}
