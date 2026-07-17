import { describe, expect, it } from 'vitest';
import { findConflict, rangesOverlap, validateRange, type TimeRange } from '../src/domain/booking-rules.js';

const range = (start: string, end: string): TimeRange => ({
  startTime: new Date(`2026-07-20T${start}:00Z`),
  endTime: new Date(`2026-07-20T${end}:00Z`),
});

describe('validateRange', () => {
  it('accepts start strictly before end', () => {
    expect(validateRange(range('09:00', '10:00'))).toBeNull();
  });

  it('rejects start equal to end', () => {
    expect(validateRange(range('09:00', '09:00'))).toBe('EMPTY_OR_NEGATIVE_RANGE');
  });

  it('rejects start after end', () => {
    expect(validateRange(range('10:00', '09:00'))).toBe('EMPTY_OR_NEGATIVE_RANGE');
  });
});

describe('rangesOverlap (half-open intervals [start, end))', () => {
  it('detects identical ranges', () => {
    expect(rangesOverlap(range('09:00', '10:00'), range('09:00', '10:00'))).toBe(true);
  });

  it('detects partial overlap at the start', () => {
    expect(rangesOverlap(range('08:30', '09:30'), range('09:00', '10:00'))).toBe(true);
  });

  it('detects partial overlap at the end', () => {
    expect(rangesOverlap(range('09:30', '10:30'), range('09:00', '10:00'))).toBe(true);
  });

  it('detects a range fully inside another', () => {
    expect(rangesOverlap(range('09:15', '09:45'), range('09:00', '10:00'))).toBe(true);
  });

  it('detects a range fully containing another', () => {
    expect(rangesOverlap(range('08:00', '11:00'), range('09:00', '10:00'))).toBe(true);
  });

  it('allows back-to-back bookings: new starts exactly when existing ends', () => {
    expect(rangesOverlap(range('10:00', '11:00'), range('09:00', '10:00'))).toBe(false);
  });

  it('allows back-to-back bookings: new ends exactly when existing starts', () => {
    expect(rangesOverlap(range('08:00', '09:00'), range('09:00', '10:00'))).toBe(false);
  });

  it('ignores disjoint ranges', () => {
    expect(rangesOverlap(range('11:00', '12:00'), range('09:00', '10:00'))).toBe(false);
  });

  it('is symmetric', () => {
    const a = range('08:30', '09:30');
    const b = range('09:00', '10:00');
    expect(rangesOverlap(a, b)).toBe(rangesOverlap(b, a));
  });
});

describe('findConflict', () => {
  const existing = [
    { id: 'b1', ...range('09:00', '10:00') },
    { id: 'b2', ...range('13:00', '14:00') },
  ];

  it('returns the conflicting booking', () => {
    expect(findConflict(range('13:30', '15:00'), existing)?.id).toBe('b2');
  });

  it('returns null when the slot is free', () => {
    expect(findConflict(range('10:00', '13:00'), existing)).toBeNull();
  });

  it('returns null when there are no bookings', () => {
    expect(findConflict(range('09:00', '10:00'), [])).toBeNull();
  });
});
