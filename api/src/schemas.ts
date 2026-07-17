import { z } from 'zod';

/**
 * Request-body schemas. Times must be ISO 8601 with an explicit offset
 * (e.g. 2026-07-20T09:00:00Z) so there is never ambiguity about the
 * intended instant; they are converted to UTC Dates here at the boundary.
 */
const isoInstant = z
  .string()
  .datetime({ offset: true, message: 'Must be an ISO 8601 datetime with timezone, e.g. 2026-07-20T09:00:00Z' })
  .transform((value) => new Date(value));

export const createBookingSchema = z.object({
  startTime: isoInstant,
  endTime: isoInstant,
});

export const loginSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  role: z.enum(['admin', 'owner', 'user']),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['admin', 'owner', 'user']),
});
