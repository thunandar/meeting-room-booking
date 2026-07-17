import { prisma } from '../lib/prisma.js';

export interface UserUsageSummary {
  user: { id: string; name: string; role: string };
  totalBookings: number;
  totalMinutes: number;
  bookings: { id: string; startTime: Date; endTime: Date; createdAt: Date }[];
}

/**
 * Bookings grouped by user with basic usage totals, for the owner/admin
 * summary view. Aggregation is done in application code: with one room the
 * dataset is small, and this keeps the grouped bookings and the totals
 * consistent from a single query.
 */
export async function getUsageSummary(): Promise<UserUsageSummary[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      role: true,
      bookings: {
        select: { id: true, startTime: true, endTime: true, createdAt: true },
        orderBy: { startTime: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return users.map(({ bookings, ...user }) => ({
    user,
    totalBookings: bookings.length,
    totalMinutes: bookings.reduce(
      (sum, b) => sum + Math.round((b.endTime.getTime() - b.startTime.getTime()) / 60_000),
      0,
    ),
    bookings,
  }));
}
