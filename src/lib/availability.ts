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

function toDate(s: string): Date {
  return new Date(s);
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
  const start = toDate(req.start);
  const end = toDate(req.end);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
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
    const bs = toDate(b.start);
    const be = toDate(b.end);
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
