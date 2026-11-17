import { describe, expect, it } from 'vitest';
import { checkAvailability, type Booking, type Room } from '../src/lib/availability';

const room: Room = { id: 'R', name: 'R', blocked: false };
const bookings: Booking[] = [{ id: 'b', title: 'Seminar', start: '2099-01-15T09:00', end: '2099-01-15T10:00' }];
const now = new Date('2099-01-01T00:00');
const check = (start: string, end: string, r = room) => checkAvailability(r, bookings, { start, end }, now);

describe('acceptance contract', () => {
  it('AC1 rejects empty / reversed input', () => {
    expect(check('', '')).toMatchObject({ available: false, code: 'INVALID' });
    expect(check('2099-01-15T12:00', '2099-01-15T11:00')).toMatchObject({ code: 'INVALID' });
  });
  it('AC2 rejects past times', () => {
    expect(check('2098-12-31T10:00', '2098-12-31T11:00')).toMatchObject({ code: 'PAST' });
  });
  it('AC3 enforces duration 30–120 min', () => {
    expect(check('2099-01-15T12:00', '2099-01-15T12:20')).toMatchObject({ code: 'DURATION' });
    expect(check('2099-01-15T12:00', '2099-01-15T14:30')).toMatchObject({ code: 'DURATION' });
    expect(check('2099-01-15T12:00', '2099-01-15T12:30').available).toBe(true);
    expect(check('2099-01-15T12:00', '2099-01-15T14:00').available).toBe(true);
  });
  it('AC4 rejects overlap, allows back-to-back', () => {
    expect(check('2099-01-15T09:30', '2099-01-15T10:30')).toMatchObject({ code: 'OVERLAP' });
    expect(check('2099-01-15T10:00', '2099-01-15T11:00').available).toBe(true);
    expect(check('2099-01-15T08:00', '2099-01-15T09:00').available).toBe(true);
  });
  it('AC5 rejects blocked room', () => {
    expect(check('2099-01-15T12:00', '2099-01-15T13:00', { ...room, blocked: true })).toMatchObject({ code: 'BLOCKED' });
  });
  it('AC6 does not mutate stored bookings', () => {
    const snapshot = JSON.stringify(bookings);
    check('2099-01-15T09:30', '2099-01-15T10:30');
    expect(JSON.stringify(bookings)).toBe(snapshot);
  });
});
