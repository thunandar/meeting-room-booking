import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../errors.js';
import { findConflict, validateRange, type TimeRange } from '../domain/booking-rules.js';
import { canDeleteBooking, type Actor } from '../domain/permissions.js';

const bookingWithUser = { include: { user: { select: { id: true, name: true, role: true } } } } as const;

export function listBookings() {
  return prisma.booking.findMany({ ...bookingWithUser, orderBy: { startTime: 'asc' } });
}

/**
 * Creates a booking after checking the range is valid and free. The overlap
 * check and insert run inside a SERIALIZABLE transaction so two concurrent
 * requests for the same slot cannot both pass the check; on a serialization
 * conflict (Prisma P2034) the transaction is retried once, which then
 * surfaces the overlap as a clean 409.
 */
export async function createBooking(actor: Actor, range: TimeRange) {
  if (validateRange(range)) {
    throw ApiError.badRequest('INVALID_TIME_RANGE', 'startTime must be strictly before endTime.');
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

  try {
    return await attempt();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
      return attempt();
    }
    throw err;
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
