import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../errors.js';
import type { Actor, Role } from '../domain/permissions.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      actor?: Actor & { name: string };
    }
  }
}

/**
 * Deliberately simple auth (per the assignment brief): the bearer token IS the
 * user's id. The user is looked up on every request, so deleted users are
 * rejected immediately and role changes take effect on the next request.
 * Roles are still fully enforced server-side from the database record —
 * clients can never claim a role.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : undefined;
  if (!token) {
    throw ApiError.unauthorized('Missing bearer token. Log in and send Authorization: Bearer <token>.');
  }

  const user = await prisma.user.findUnique({ where: { id: token } });
  if (!user) {
    throw ApiError.unauthorized('Invalid or expired token. The user may have been deleted.');
  }

  req.actor = { id: user.id, role: user.role as Role, name: user.name };
  next();
}

/** Returns the authenticated actor; only call behind the authenticate middleware. */
export function requireActor(req: Request): Actor & { name: string } {
  if (!req.actor) {
    throw ApiError.unauthorized();
  }
  return req.actor;
}
