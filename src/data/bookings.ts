import type { Booking, Room } from '../lib/availability';

/** One fictional room. No real people, no real data. */
export const ROOM: Room = { id: 'R-101', name: 'Room A-101 (Seminar)', blocked: false };

/** Fictional bookings, "HH:MM" on a fixed demo date offset (days from today). */
export const BOOKINGS: Booking[] = [
  { id: 'b1', title: 'Algorithms seminar', start: '2099-01-15T09:00', end: '2099-01-15T10:30' },
  { id: 'b2', title: 'Study group', start: '2099-01-15T13:00', end: '2099-01-15T14:00' },
  { id: 'b3', title: 'Club meeting', start: '2099-01-15T16:00', end: '2099-01-15T17:00' },
];
