import { describe, expect, it } from 'vitest';
import { checkAvailability, type Booking, type Room } from '../src/lib/availability';

const room: Room = { id: 'R', name: 'R', blocked: false };
const now = new Date('2099-01-01T00:00');
const good: Booking[] = [{ id: 'b', title: 'Seminar', start: '2099-01-15T09:00', end: '2099-01-15T10:00' }];

describe('R-01 invalid calendar dates / non-canonical formats must be rejected (AC1)', () => {
  it.each([
    ['2099-02-31T10:00', '2099-02-31T11:00'],
    ['2099-13-01T10:00', '2099-13-01T11:00'],
    ['2099-01-15 10:00', '2099-01-15 11:00'],
    ['2099-01-15T10:00:30', '2099-01-15T11:00'],
    ['2099-01-15T25:00', '2099-01-15T26:00'],
  ])('rejects %s → %s', (start, end) => {
    expect(checkAvailability(room, good, { start, end }, now)).toMatchObject({ available: false, code: 'INVALID' });
  });
  it('still accepts a valid leap day', () => {
    expect(checkAvailability(room, [], { start: '2104-02-29T10:00', end: '2104-02-29T11:00' }, now).available).toBe(true);
  });
});

describe('R-02 malformed stored bookings must fail closed (AC4)', () => {
  it('does not report "available" when a stored booking cannot be parsed', () => {
    const bad: Booking[] = [{ id: 'x', title: 'corrupt', start: 'garbage', end: 'garbage' }];
    const r = checkAvailability(room, bad, { start: '2099-01-15T10:00', end: '2099-01-15T11:00' }, now);
    expect(r).toMatchObject({ available: false, code: 'DATA_ERROR' });
  });
  it('does not mutate bookings while failing closed (AC6)', () => {
    const bad: Booking[] = [{ id: 'x', title: 'corrupt', start: 'garbage', end: 'garbage' }];
    const snap = JSON.stringify(bad);
    checkAvailability(room, bad, { start: '2099-01-15T10:00', end: '2099-01-15T11:00' }, now);
    expect(JSON.stringify(bad)).toBe(snap);
  });
});
