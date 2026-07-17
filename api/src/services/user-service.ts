import { prisma } from '../lib/prisma.js';
import { ApiError } from '../errors.js';
import { wouldRemoveLastAdmin, type Role } from '../domain/permissions.js';

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
  const adminCount = await prisma.user.count({ where: { role: 'admin' } });
  if (wouldRemoveLastAdmin(user, adminCount, role)) {
    throw ApiError.badRequest('LAST_ADMIN', 'Cannot demote the last admin — at least one admin must remain.');
  }
  return prisma.user.update({ where: { id: userId }, data: { role }, select: publicUser });
}

/**
 * Deleting a user cascades to their bookings (defined in the Prisma schema),
 * freeing the room slots they held. The last remaining admin can never be
 * deleted (or demoted, above) — the system always keeps at least one admin,
 * so user management cannot be locked out.
 */
export async function deleteUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw ApiError.notFound('User not found.');
  }
  const adminCount = await prisma.user.count({ where: { role: 'admin' } });
  if (wouldRemoveLastAdmin(user, adminCount)) {
    throw ApiError.badRequest('LAST_ADMIN', 'Cannot delete the last admin — at least one admin must remain.');
  }
  await prisma.user.delete({ where: { id: userId } });
}
