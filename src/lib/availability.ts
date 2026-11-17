export interface Room {
  id: string;
  name: string;
  blocked: boolean;
}

export interface Booking {
  id: string;
  title: string;
  start: string; // local "YYYY-MM-DDTHH:MM"
  end: string;
}

export interface Request {
  start: string;
  end: string;
}

export type Result =
  | { available: true; message: string }
  | { available: false; code: string; message: string };

export const MIN_MINUTES = 30;
export const MAX_MINUTES = 120;

const LOCAL_DT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Strict parser for local "YYYY-MM-DDTHH:MM". Returns null for any other
 * format and for calendar dates that do not exist (e.g. 2099-02-31), which
 * `new Date()` would silently roll over.
 */
export function parseLocal(s: string): Date | null {
  const m = LOCAL_DT.exec(s);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  const ok =
    date.getFullYear() === y &&
    date.getMonth() === mo - 1 &&
    date.getDate() === d &&
    date.getHours() === h &&
    date.getMinutes() === mi;
  return ok ? date : null;
}

/**
 * Check whether `room` can be booked for `req` given existing `bookings`.
 * Pure: never mutates its arguments.
 */
export function checkAvailability(
  room: Room,
  bookings: Booking[],
  req: Request,
  now: Date = new Date(),
): Result {
  // AC1 – invalid input
  const start = parseLocal(req.start);
  const end = parseLocal(req.end);
  if (!start || !end) {
    return { available: false, code: 'INVALID', message: 'Please enter a valid start and end time.' };
  }
  if (end <= start) {
    return { available: false, code: 'INVALID', message: 'End time must be after start time.' };
  }

  // AC2 – past times
  if (start < now) {
    return { available: false, code: 'PAST', message: 'The start time is in the past.' };
  }

  // AC3 – allowed duration
  const minutes = (end.getTime() - start.getTime()) / 60000;
  if (minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
    return {
      available: false,
      code: 'DURATION',
      message: `Booking must last between ${MIN_MINUTES} and ${MAX_MINUTES} minutes.`,
    };
  }

  // AC5 – blocked room
  if (room.blocked) {
    return { available: false, code: 'BLOCKED', message: 'This room is blocked and cannot be booked.' };
  }

  // AC4 – overlap with an existing booking (back-to-back is allowed)
  for (const b of bookings) {
    const bs = parseLocal(b.start);
    const be = parseLocal(b.end);
    if (!bs || !be || be <= bs) {
      // Fail closed: a corrupt stored booking must never produce "available".
      return {
        available: false,
        code: 'DATA_ERROR',
        message: `Cannot verify availability: stored booking "${b.id}" has invalid data.`,
      };
    }
    if (start < be && end > bs) {
      return {
        available: false,
        code: 'OVERLAP',
        message: `Conflicts with "${b.title}" (${b.start.slice(11)}–${b.end.slice(11)}).`,
      };
    }
  }

  return { available: true, message: 'Room is available for the requested time.' };
}
