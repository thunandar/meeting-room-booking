import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../errors.js';
import { findConflict, validateRange, type TimeRange } from '../domain/booking-rules.js';
import { canDeleteBooking, type Actor } from '../domain/permissions.js';

const bookingWithUser = { include: { user: { select: { id: true, name: true, role: true } } } } as const;

export function listBookings() {
  return prisma.booking.findMany({ ...bookingWithUser, orderBy: { startTime: 'asc' } });
}

/** Serializable-transaction attempts before giving up on a contended slot. */
const MAX_CREATE_ATTEMPTS = 3;

/**
 * Creates a booking after checking the range is valid and free. The overlap
 * check and insert run inside a SERIALIZABLE transaction so two concurrent
 * requests for the same slot cannot both pass the check. On a serialization
 * conflict (Prisma P2034) the transaction is retried up to MAX_CREATE_ATTEMPTS
 * times; if the last attempt still conflicts, the contention is reported as a
 * clean 409 BOOKING_OVERLAP rather than a 500 — under this workload a
 * serialization failure means another booking for the same window won the race.
 */
export async function createBooking(actor: Actor, range: TimeRange) {
  const rangeError = validateRange(range);
  if (rangeError) {
    throw ApiError.badRequest(rangeError, 'startTime must be strictly before endTime.');
  }

  const attempt = () =>
    prisma.$transaction(
      async (tx) => {
        const overlapping = await tx.booking.findMany({
          where: { startTime: { lt: range.endTime }, endTime: { gt: range.startTime } },
          ...bookingWithUser,
        });
        const conflict = findConflict(range, overlapping);
        if (conflict) {
          throw ApiError.conflict('BOOKING_OVERLAP', 'The room is already booked during this time.', {
            conflictingBooking: {
              id: conflict.id,
              startTime: conflict.startTime,
              endTime: conflict.endTime,
              bookedBy: conflict.user.name,
            },
          });
        }
        return tx.booking.create({
          data: { userId: actor.id, startTime: range.startTime, endTime: range.endTime },
          ...bookingWithUser,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

  for (let attemptNo = 1; ; attemptNo++) {
    try {
      return await attempt();
    } catch (err) {
      const isSerializationFailure = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034';
      if (!isSerializationFailure) {
        throw err;
      }
      if (attemptNo >= MAX_CREATE_ATTEMPTS) {
        throw ApiError.conflict(
          'BOOKING_OVERLAP',
          'The room was booked by someone else while processing your request. Please pick another time.',
        );
      }
    }
  }
}

export async function deleteBooking(actor: Actor, bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw ApiError.notFound('Booking not found.');
  }
  if (!canDeleteBooking(actor, booking)) {
    throw ApiError.forbidden('You can only delete your own bookings.');
  }
  await prisma.booking.delete({ where: { id: bookingId } });
}
