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

/** The explanation must never pretend an action happened or invite the user to treat it as a booking (AC5). */
const CLAIMS_ACTION =
  /\b(booked (it )?for you|i (have )?(booked|reserved)|has been (booked|reserved|confirmed)|booking (is )?confirmed|confirmation (number|code)|reservation (is )?confirmed|all set|go ahead)\b/i;
const MARKUP = /[<>{}`]|\]\(|https?:\/\//i;

/**
 * Words that say "this decision is negative". A match only counts when it is
 * not negated ("does not overlap", "no conflict", "nothing is blocked").
 */
const NEGATIVE_DECISION =
  /\b(not available|unavailable|isn't available|not free|cannot be|can't be|could not be|couldn't be|refused|in the past|already passed|outside|overlaps?|overlapping|conflicts?|blocked|already booked|is taken|occupied|invalid)\b/gi;
/** Words that say "this slot can be used". Also only counted when not negated. */
const POSITIVE_DECISION =
  /\b(available|free|bookable|you can book|you can reserve|you may book|you may reserve|can be booked|can be reserved|is open for)\b/gi;

/** At least one of these (negated or not) must appear, so the stated reason matches `reasonCode`. */
const REASON_TERMS: Record<ReasonCode, RegExp> = {
  OK: /\b(available|free)\b/i,
  OVERLAP: /\b(overlaps?|overlapping|conflicts?|already booked|existing booking)\b/i,
  BLOCKED: /\bblocked\b/i,
  PAST: /\b(past|already passed|has passed|already started)\b/i,
  DURATION: /\b(minutes?|duration|length|too short|too long)\b/i,
  INVALID: /\b(valid|invalid|missing|malformed|entered|could not be checked|couldn't be checked)\b/i,
  DATA_ERROR: /\b(data|verif\w*)\b/i,
};

const NEGATORS = /^(not|no|never|nothing|none|nobody|without|cannot|nor|neither|\w+n't)$/i;
const CLAUSE_BREAK = /^(because|but|so|since|although|though|however|while|yet|whereas)$/i;

/** True when one of the (up to) four words before `index`, in the same clause, is a negator. */
function isNegated(text: string, index: number): boolean {
  const before = text.slice(0, index);
  const clause = before.split(/[,;:.!?()]/).pop() ?? '';
  const words = clause.trim().split(/\s+/).filter(Boolean);
  for (let i = words.length - 1, seen = 0; i >= 0 && seen < 4; i--, seen++) {
    if (CLAUSE_BREAK.test(words[i])) return false;
    if (NEGATORS.test(words[i].replace(/[’]/g, "'"))) return true;
  }
  return false;
}

function hasAffirmed(text: string, pattern: RegExp): string | null {
  for (const m of text.matchAll(pattern)) if (!isNegated(text, m.index ?? 0)) return m[0];
  return null;
}

function countSentences(text: string): number {
  return text.split(/[.!?]+(?:\s+|$)/).filter((s) => s.trim().length > 0).length;
}

// --- invented time / date detection (FIX-2) --------------------------------------

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTH_RE = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';

function toMinutes(h: number, m: number, ampm?: string): number {
  let hh = h;
  if (ampm) {
    const pm = ampm.toLowerCase() === 'pm';
    if (hh === 12) hh = pm ? 12 : 0;
    else if (pm) hh += 12;
  }
  return hh * 60 + m;
}

interface DateFacts {
  minutes: Set<number>;
  days: { y: number; m: number; d: number; weekday: number }[];
}

function factsOf(input: ExplainInput): DateFacts {
  const minutes = new Set<number>();
  const days: DateFacts['days'] = [];
  for (const t of [input.start, input.end]) {
    if (!t) continue;
    const date = parseLocal(t);
    if (!date) continue;
    minutes.add(date.getHours() * 60 + date.getMinutes());
    days.push({ y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate(), weekday: date.getDay() });
  }
  return { minutes, days };
}

/** Returns the first clock time, date or weekday in `text` that is not one of the input's. */
function findInventedDateTime(text: string, input: ExplainInput): string | null {
  const facts = factsOf(input);
  const dayKnown = (d: number, m: number, y?: number) =>
    facts.days.some((f) => f.d === d && f.m === m && (y === undefined || f.y === y));
  // "2099-01-15T09:30" -> "2099-01-15 09:30" so both halves are checked.
  const t = text.replace(/(\d{4}-\d{2}-\d{2})T(\d{1,2}:\d{2})/g, '$1 $2');

  // Clock times: "09:30", "9:30 am", "10:45pm", "8am".
  for (const m of t.matchAll(/\b(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?(?![\w])/gi)) {
    const ampm = m[3]?.replace(/\./g, '');
    if (!facts.minutes.has(toMinutes(Number(m[1]), Number(m[2]), ampm))) return m[0];
  }
  for (const m of t.matchAll(/(?<![:.\d])\b(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)(?![\w])/gi)) {
    if (!facts.minutes.has(toMinutes(Number(m[1]), 0, m[2].replace(/\./g, '')))) return m[0];
  }
  // ISO dates.
  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    if (!dayKnown(Number(m[3]), Number(m[2]), Number(m[1]))) return m[0];
  }
  // "15 January 2099", "15th Jan".
  for (const m of t.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}(?:,?\\s+(\\d{4}))?`, 'gi'))) {
    if (!dayKnown(Number(m[1]), MONTHS.indexOf(m[2].toLowerCase()) + 1, m[3] ? Number(m[3]) : undefined)) return m[0];
  }
  // "January 15, 2099", "Jan 15".
  for (const m of t.matchAll(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, 'gi'))) {
    if (!dayKnown(Number(m[2]), MONTHS.indexOf(m[1].toLowerCase()) + 1, m[3] ? Number(m[3]) : undefined)) return m[0];
  }
  // "16/01/2099" or "01/16/2099": accepted if either reading is the input date.
  for (const m of t.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)) {
    const [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (!dayKnown(a, b, y) && !dayKnown(b, a, y)) return m[0];
  }
  // Weekday names must match the input date.
  for (const m of t.matchAll(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi)) {
    const wd = WEEKDAYS.indexOf(m[1].toLowerCase());
    if (!facts.days.some((f) => f.weekday === wd)) return m[0];
  }
  return null;
}

/**
 * AC2: the model output must be `{ explanation: string }`, short, plain text,
 * at most two sentences, consistent with the deterministic decision AND its
 * reason, and must not mention times, dates or weekdays that are not in the input.
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
  if (CLAIMS_ACTION.test(text)) return { ok: false, error: 'Explanation claims or invites a booking action.' };

  // FIX-1: polarity, negation-aware, fail closed.
  const negative = hasAffirmed(text, NEGATIVE_DECISION);
  const positive = hasAffirmed(text, POSITIVE_DECISION);
  if (input.isAvailable) {
    if (negative) return { ok: false, error: `Explanation contradicts the result (says "${negative}").` };
    if (!positive) return { ok: false, error: 'Explanation does not state that the room is available.' };
  } else {
    if (positive) return { ok: false, error: `Explanation contradicts the result (says "${positive}").` };
    if (!negative) return { ok: false, error: 'Explanation does not state that the request was refused.' };
  }
  if (!REASON_TERMS[input.reasonCode].test(text)) {
    return { ok: false, error: `Explanation does not mention the reason (${input.reasonCode}).` };
  }

  // FIX-2: no invented times, dates or weekdays.
  const invented = findInventedDateTime(text, input);
  if (invented) return { ok: false, error: `Explanation mentions a time or date not in the input (${invented}).` };

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
