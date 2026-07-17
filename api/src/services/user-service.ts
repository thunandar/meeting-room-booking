import { prisma } from '../lib/prisma.js';
import { ApiError } from '../errors.js';
import type { Actor, Role } from '../domain/permissions.js';

const publicUser = { id: true, name: true, role: true, createdAt: true } as const;

export function listUsers() {
  return prisma.user.findMany({ select: publicUser, orderBy: { createdAt: 'asc' } });
}

export function createUser(input: { name: string; role: Role }) {
  return prisma.user.create({ data: input, select: publicUser });
}

export async function updateUserRole(userId: string, role: Role) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw ApiError.notFound('User not found.');
  }
  return prisma.user.update({ where: { id: userId }, data: { role }, select: publicUser });
}

/**
 * Deleting a user cascades to their bookings (defined in the Prisma schema),
 * freeing the room slots they held. Admins cannot delete their own account —
 * this prevents a lone admin from locking everyone out of user management.
 */
export async function deleteUser(actor: Actor, userId: string): Promise<void> {
  if (actor.id === userId) {
    throw ApiError.badRequest('CANNOT_DELETE_SELF', 'You cannot delete your own account.');
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw ApiError.notFound('User not found.');
  }
  await prisma.user.delete({ where: { id: userId } });
}
