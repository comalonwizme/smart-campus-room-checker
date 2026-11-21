/**
 * "Explain availability" — input/output contract.
 *
 * Trust boundary: the deterministic checker (`checkAvailability`) decides
 * availability. This module only describes that decision. Everything that
 * crosses into or out of the LLM adapter is treated as untrusted data and is
 * validated here.
 */
import { parseLocal, type Request, type Result, type Room } from '../availability';

export const REASON_CODES = ['OK', 'INVALID', 'PAST', 'DURATION', 'BLOCKED', 'OVERLAP', 'DATA_ERROR'] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

/** Minimal context sent to the model. No booking titles, no people, no ids. */
export interface ExplainInput {
  roomLabel: string;
  /** Requested start/end as "YYYY-MM-DDTHH:MM", or null when the user's input was not a valid time. */
  start: string | null;
  end: string | null;
  isAvailable: boolean;
  reasonCode: ReasonCode;
}

export interface ExplainOutput {
  explanation: string;
}

export const LIMITS = {
  roomLabelMax: 60,
  timeFieldMax: 16, // "YYYY-MM-DDTHH:MM"
  explanationMin: 10,
  explanationMax: 280,
  maxSentences: 2,
  timeoutMs: 4000,
} as const;

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

const INPUT_KEYS = ['roomLabel', 'start', 'end', 'isAvailable', 'reasonCode'];
// Letters, digits, spaces and a little punctuation. No angle brackets, braces, quotes or control chars.
const ROOM_LABEL = /^[\p{L}\p{N} ().,\-–/#]+$/u;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validateTime(v: unknown, field: string): Validation<string | null> {
  if (v === null) return { ok: true, value: null };
  if (typeof v !== 'string') return { ok: false, error: `${field} must be a string or null.` };
  if (v.length === 0) return { ok: false, error: `${field} is empty.` };
  if (v.length > LIMITS.timeFieldMax) return { ok: false, error: `${field} is too long.` };
  if (!parseLocal(v)) return { ok: false, error: `${field} is not a valid "YYYY-MM-DDTHH:MM" time.` };
  return { ok: true, value: v };
}

/** AC3: reject empty, malformed, overly long or inconsistent input before any adapter call. */
export function validateExplainInput(raw: unknown): Validation<ExplainInput> {
  if (!isPlainObject(raw)) return { ok: false, error: 'Input must be an object.' };
  const extra = Object.keys(raw).filter((k) => !INPUT_KEYS.includes(k));
  if (extra.length) return { ok: false, error: `Unexpected field(s): ${extra.join(', ')}.` };

  const { roomLabel, start, end, isAvailable, reasonCode } = raw;
  if (typeof roomLabel !== 'string' || roomLabel.trim().length === 0) {
    return { ok: false, error: 'Room label is empty.' };
  }
  if (roomLabel.length > LIMITS.roomLabelMax) return { ok: false, error: 'Room label is too long.' };
  if (!ROOM_LABEL.test(roomLabel)) return { ok: false, error: 'Room label contains unsupported characters.' };

  const s = validateTime(start, 'start');
  if (!s.ok) return s;
  const e = validateTime(end, 'end');
  if (!e.ok) return e;

  if (typeof isAvailable !== 'boolean') return { ok: false, error: 'isAvailable must be a boolean.' };
  if (typeof reasonCode !== 'string' || !(REASON_CODES as readonly string[]).includes(reasonCode)) {
    return { ok: false, error: 'Unknown reasonCode.' };
  }
  if (isAvailable !== (reasonCode === 'OK')) {
    return { ok: false, error: 'isAvailable and reasonCode disagree.' };
  }
  // Only an INVALID result may lack times; every other decision was made on valid times.
  if (reasonCode !== 'INVALID' && (s.value === null || e.value === null)) {
    return { ok: false, error: 'start and end are required for this result.' };
  }
  return {
    ok: true,
    value: { roomLabel: roomLabel.trim(), start: s.value, end: e.value, isAvailable, reasonCode: reasonCode as ReasonCode },
  };
}

/** Build the contract input from the deterministic result. Never changes the result. */
export function toExplainInput(room: Room, req: Request, result: Result): ExplainInput {
  const reasonCode = (result.available ? 'OK' : result.code) as ReasonCode;
  const safeTime = (t: string) => (t.length <= LIMITS.timeFieldMax && parseLocal(t) ? t : null);
  return {
    roomLabel: room.name,
    start: safeTime(req.start),
    end: safeTime(req.end),
    isAvailable: result.available,
    reasonCode,
  };
}

// --- output validation -------------------------------------------------------

const SAYS_UNAVAILABLE =
  /\b(not available|unavailable|isn't available|is not free|not free|cannot be booked|can't be booked|conflicts?|overlaps?|blocked|already booked|is taken|occupied|in the past|invalid)\b/i;
const SAYS_AVAILABLE = /\b(is available|is free|you can book|can be booked|is open for)\b/i;
/** The explanation must never pretend an action happened. */
const CLAIMS_ACTION =
  /\b(booked (it )?for you|i (have )?(booked|reserved)|has been (booked|reserved|confirmed)|booking (is )?confirmed|confirmation (number|code)|reservation (is )?confirmed)\b/i;
const MARKUP = /[<>{}`]|\]\(|https?:\/\//i;

function countSentences(text: string): number {
  return text.split(/[.!?]+(?:\s+|$)/).filter((s) => s.trim().length > 0).length;
}

function allowedClockTimes(input: ExplainInput): Set<string> {
  const out = new Set<string>();
  for (const t of [input.start, input.end]) {
    if (!t) continue;
    const hhmm = t.slice(11);
    out.add(hhmm);
    out.add(String(Number(hhmm.slice(0, 2))) + hhmm.slice(2)); // "09:00" -> "9:00"
  }
  return out;
}

/**
 * AC2: the model output must be `{ explanation: string }`, short, plain text,
 * at most two sentences, consistent with the deterministic decision, and must
 * not mention clock times or dates that were not in the input.
 */
export function validateExplanation(raw: unknown, input: ExplainInput): Validation<ExplainOutput> {
  if (!isPlainObject(raw)) return { ok: false, error: 'Output must be an object.' };
  const keys = Object.keys(raw);
  if (keys.length !== 1 || keys[0] !== 'explanation') return { ok: false, error: 'Output must be { explanation }.' };
  if (typeof raw.explanation !== 'string') return { ok: false, error: 'explanation must be a string.' };

  const text = raw.explanation.replace(/\s+/g, ' ').trim();
  if (text.length < LIMITS.explanationMin) return { ok: false, error: 'Explanation is too short.' };
  if (text.length > LIMITS.explanationMax) return { ok: false, error: 'Explanation is too long.' };
  if (MARKUP.test(text)) return { ok: false, error: 'Explanation contains markup or links.' };
  if (countSentences(text) > LIMITS.maxSentences) return { ok: false, error: 'Explanation has more than two sentences.' };
  if (CLAIMS_ACTION.test(text)) return { ok: false, error: 'Explanation claims a booking action.' };

  if (input.isAvailable && SAYS_UNAVAILABLE.test(text)) {
    return { ok: false, error: 'Explanation contradicts the result (says unavailable).' };
  }
  if (!input.isAvailable && SAYS_AVAILABLE.test(text)) {
    return { ok: false, error: 'Explanation contradicts the result (says available).' };
  }

  const allowed = allowedClockTimes(input);
  for (const m of text.matchAll(/\b\d{1,2}:\d{2}\b/g)) {
    if (!allowed.has(m[0])) return { ok: false, error: `Explanation mentions a time not in the input (${m[0]}).` };
  }
  const dates = new Set([input.start, input.end].filter(Boolean).map((t) => (t as string).slice(0, 10)));
  for (const m of text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) {
    if (!dates.has(m[0])) return { ok: false, error: `Explanation mentions a date not in the input (${m[0]}).` };
  }
  return { ok: true, value: { explanation: text } };
}

// --- deterministic fallback ----------------------------------------------------

const FALLBACK: Record<ReasonCode, string> = {
  OK: 'The requested time passed every booking rule, so the room is free for that slot.',
  INVALID: 'The times entered could not be checked, so please enter a valid start time and a later end time.',
  PAST: 'The requested start time has already passed, and bookings can only be made for future times.',
  DURATION: 'Bookings must last between 30 and 120 minutes, and the requested slot is outside that range.',
  BLOCKED: 'This room is currently blocked, so no time slot in it can be booked.',
  OVERLAP: 'The requested time overlaps an existing booking, so the room is not free for that slot.',
  DATA_ERROR: 'Availability could not be verified because some stored booking data is invalid, so the request was refused to be safe.',
};

/** Template explanation used when the model is unavailable or its output is rejected (AC4). */
export function fallbackExplanation(input: ExplainInput): string {
  return FALLBACK[input.reasonCode];
}
