/**
 * The role/permission matrix from the assignment, expressed as pure
 * predicates. Route middleware and services call these; they are the single
 * source of truth for authorization decisions.
 */

export type Role = 'admin' | 'owner' | 'user';

export interface Actor {
  id: string;
  role: Role;
}

/** Users may delete only their own bookings; owner and admin may delete any. */
export function canDeleteBooking(actor: Actor, booking: { userId: string }): boolean {
  if (actor.role === 'admin' || actor.role === 'owner') {
    return true;
  }
  return booking.userId === actor.id;
}

/** Only admin manages users (create, delete, change roles, list). */
export function canManageUsers(actor: Actor): boolean {
  return actor.role === 'admin';
}

/** Owner and admin can see bookings grouped by user and usage totals. */
export function canViewSummary(actor: Actor): boolean {
  return actor.role === 'owner' || actor.role === 'admin';
}

/**
 * The system must always keep at least one admin, or user management is
 * permanently locked. True when deleting the target (newRole omitted) or
 * moving them to newRole would leave zero admins.
 */
export function wouldRemoveLastAdmin(
  target: { role: Role },
  adminCount: number,
  newRole?: Role,
): boolean {
  return target.role === 'admin' && newRole !== 'admin' && adminCount <= 1;
}
