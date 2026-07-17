/**
 * Pure booking-domain rules. No framework or database imports so the core
 * logic can be unit-tested in isolation.
 *
 * Time semantics: bookings are half-open intervals [startTime, endTime).
 * A booking that ends at 10:00 does NOT conflict with one starting at 10:00,
 * so back-to-back bookings are allowed. All comparisons are on UTC instants.
 */

export interface TimeRange {
  startTime: Date;
  endTime: Date;
}

/** Doubles as the API error code so callers can pass it through directly. */
export type RangeValidationError = 'INVALID_TIME_RANGE';

export function validateRange(range: TimeRange): RangeValidationError | null {
  if (range.startTime.getTime() >= range.endTime.getTime()) {
    return 'INVALID_TIME_RANGE';
  }
  return null;
}

/** Two half-open intervals overlap iff each starts before the other ends. */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return (
    a.startTime.getTime() < b.endTime.getTime() &&
    b.startTime.getTime() < a.endTime.getTime()
  );
}

/** Returns the first existing range that conflicts with the candidate, or null. */
export function findConflict<T extends TimeRange>(
  candidate: TimeRange,
  existing: readonly T[],
): T | null {
  return existing.find((range) => rangesOverlap(candidate, range)) ?? null;
}
